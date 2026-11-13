"""Loan Application Pre-Validator - Flask REST API.

Serves JSON REST endpoints under /api.
Enables CORS for frontend development server.
"""

from __future__ import annotations

import os
from typing import Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

from automata import validate_report_fields
from engine import Engine


def create_app(db_path: str = "loans.db") -> Flask:
    """Application factory for Flask REST backend."""
    app = Flask(__name__)
    CORS(app)

    engine = Engine(db_path=db_path)
    app.engine = engine  # type: ignore[attr-defined]

    @app.route("/api/validate", methods=["POST"])
    def api_validate():
        if not request.is_json:
            data = request.get_json(silent=True) or {}
        else:
            data = request.get_json() or {}

        val = validate_report_fields(data)
        return jsonify({
            "valid": val["valid"],
            "errors": val["errors"],
            "category": val["category"],
            "class_note": val["class_note"],
            "band": val["band"],
            "zone_used": val["zone_used"],
            "zone_fallback": val["zone_fallback"],
        }), 200

    @app.route("/api/reports", methods=["POST"])
    def api_submit_report():
        if not request.is_json:
            return jsonify({
                "error": "Bad Request",
                "message": "Expected JSON payload with application details.",
            }), 400

        data = request.get_json()
        if not isinstance(data, dict):
            return jsonify({
                "error": "Bad Request",
                "message": "Expected JSON object.",
            }), 400

        status_code, res = engine.submit_report(data)
        return jsonify(res), status_code

    @app.route("/api/reports", methods=["GET"])
    def api_list_reports():
        q = request.args.get("q")
        status = request.args.get("status")
        category = request.args.get("category")
        result = engine.list_reports(q=q, status=status, category=category)
        return jsonify(result), 200

    @app.route("/api/reports/<report_id>", methods=["GET"])
    def api_get_report(report_id: str):
        result = engine.get_report(report_id)
        if not result:
            return jsonify({
                "error": "Not Found",
                "message": f"Report '{report_id}' not found.",
            }), 404
        return jsonify(result), 200

    @app.route("/api/reports/<report_id>/correct", methods=["POST"])
    def api_correct_report(report_id: str):
        if not request.is_json:
            return jsonify({
                "error": "Bad Request",
                "message": "Expected JSON payload with corrected details.",
            }), 400

        data = request.get_json()
        if not isinstance(data, dict):
            return jsonify({
                "error": "Bad Request",
                "message": "Expected JSON object.",
            }), 400

        status_code, res = engine.correct_report(report_id, data)
        return jsonify(res), status_code

    @app.route("/api/reports/<report_id>/status", methods=["PATCH"])
    def api_patch_status(report_id: str):
        if not request.is_json:
            return jsonify({
                "error": "Bad Request",
                "message": "Expected JSON payload.",
            }), 400

        body = request.get_json() or {}
        new_status = body.get("status")
        if not new_status:
            return jsonify({
                "error": "Bad Request",
                "message": "Field 'status' is required.",
            }), 400

        status_code, res = engine.update_report_status(report_id, new_status)
        return jsonify(res), status_code

    @app.route("/api/handlers", methods=["GET"])
    def api_list_handlers():
        handlers = engine.list_handlers()
        return jsonify(handlers), 200

    @app.route("/api/handlers/<int:handler_id>", methods=["PATCH"])
    def api_patch_handler(handler_id: int):
        if not request.is_json:
            return jsonify({
                "error": "Bad Request",
                "message": "Expected JSON payload.",
            }), 400

        body = request.get_json() or {}
        available = body.get("available")
        capacity = body.get("capacity")

        status_code, res = engine.update_handler(handler_id, available, capacity)
        return jsonify(res), status_code

    @app.route("/api/handlers/<int:handler_id>/reports", methods=["GET"])
    def api_handler_reports(handler_id: int):
        reports = engine.get_handler_reports(handler_id)
        return jsonify(reports), 200

    @app.route("/api/routing", methods=["GET"])
    def api_list_routing():
        rows = engine.list_routing()
        return jsonify(rows), 200

    @app.route("/api/queue", methods=["GET"])
    def api_get_queue():
        queues = engine.get_queues()
        return jsonify(queues), 200

    @app.route("/api/queue/process", methods=["POST"])
    def api_process_queue():
        count = engine.process_waiting_queue()
        return jsonify({"processed": count}), 200

    @app.route("/api/analytics", methods=["GET"])
    def api_get_analytics():
        data = engine.get_analytics()
        return jsonify(data), 200

    @app.route("/api/demo-seed", methods=["POST"])
    def api_demo_seed():
        count = engine.seed_demo_reports()
        return jsonify({"seeded": count}), 200

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="127.0.0.1", port=port, debug=True)

