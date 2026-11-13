"""Routing and Dispatch Engine for Loan Application Pre-Validator.

PART B:
- SQLite schema: reports, handlers, routing, events.
- 60 routing combinations (5 zones x 4 categories x 3 bands).
- 40 handlers (Primary auth 2 / cap 3, Backup auth 3 / cap 2 per zone & category).
- Central zone handlers act as escalation path.
- Partial unique index on application_code where validation_ok = 1.
- Deterministic dispatch:
  1) Extract routing key "zone|category|band" (Central fallback for unknown zone)
  2) Lookup routing table (branch, team, depot, authority)
  3) Candidate scan: zone-primary -> zone-backup -> central-primary -> central-backup
  4) Eligibility check (authority >= required, available == 1, load < capacity [+1 for critical])
  5) Assign or place in waiting queue with full audit log & history event
- Forward-only status lifecycle: Pending -> Assigned -> In Progress -> Resolved.
- Global lock and BEGIN IMMEDIATE transactions for concurrent submission safety.
- Automatic waiting queue re-evaluation on report resolution and handler updates.
"""

from __future__ import annotations

import contextlib
import datetime
import json
import sqlite3
import threading
from typing import Any, Dict, List, Optional, Tuple

from automata import (
    CATEGORY_RULES,
    URGENCIES,
    URGENCY_PRIORITY,
    VALID_TYPE_LETTERS,
    ZONES,
    calculate_band,
    validate_report_fields,
)

# Global lock for SQLite concurrency safety
DB_LOCK = threading.Lock()

# Status Lifecycle
VALID_STATUSES = ["Pending", "Assigned", "In Progress", "Resolved"]
STATUS_ORDER = {
    "Pending": 0,
    "Assigned": 1,
    "In Progress": 2,
    "Resolved": 3,
}

LEGAL_TRANSITIONS = {
    "Pending": {"Assigned"},
    "Assigned": {"In Progress"},
    "In Progress": {"Resolved"},
    "Resolved": set(),  # Terminal state
}


def get_timestamp() -> str:
    """Returns current UTC timestamp in ISO 8601 format."""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def init_db(conn: sqlite3.Connection) -> None:
    """Initializes SQLite schema and seeds routing table and handlers."""
    with conn:
        conn.execute("PRAGMA foreign_keys = ON;")

        # 1. Handlers table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS handlers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                category TEXT NOT NULL,
                zone TEXT NOT NULL,
                role TEXT NOT NULL,
                authority INTEGER NOT NULL,
                capacity INTEGER NOT NULL,
                available INTEGER NOT NULL DEFAULT 1
            );
        """)

        # 2. Routing table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS routing (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zone TEXT NOT NULL,
                category TEXT NOT NULL,
                band TEXT NOT NULL,
                branch TEXT NOT NULL,
                team TEXT NOT NULL,
                depot TEXT NOT NULL,
                authority INTEGER NOT NULL,
                UNIQUE(zone, category, band)
            );
        """)

        # 3. Reports table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id TEXT UNIQUE NOT NULL,
                application_code TEXT NOT NULL,
                reporter_name TEXT NOT NULL,
                contact TEXT NOT NULL DEFAULT '',
                income REAL,
                amount REAL,
                description TEXT NOT NULL DEFAULT '',
                urgency TEXT NOT NULL DEFAULT 'normal',
                priority_rank INTEGER NOT NULL DEFAULT 2,
                zone TEXT NOT NULL,
                zone_used TEXT NOT NULL,
                zone_fallback TEXT,
                category TEXT NOT NULL,
                band TEXT,
                class_note TEXT,
                validation_ok INTEGER NOT NULL DEFAULT 0,
                validation_msg TEXT NOT NULL DEFAULT '',
                errors_json TEXT NOT NULL DEFAULT '{}',
                raw_input TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'Pending',
                queue TEXT,
                handler_id INTEGER,
                handler_name TEXT,
                branch TEXT,
                team TEXT,
                depot TEXT,
                routing_reason TEXT,
                escalated INTEGER NOT NULL DEFAULT 0,
                priority_override INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (handler_id) REFERENCES handlers(id)
            );
        """)

        # Partial unique index on application_code where validation_ok = 1
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_app_code_valid
            ON reports(application_code)
            WHERE validation_ok = 1;
        """)

        # 4. Events (history) table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id TEXT NOT NULL,
                ts TEXT NOT NULL,
                event TEXT NOT NULL
            );
        """)

        # 5. Metadata table for atomic sequence counters
        conn.execute("""
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value INTEGER NOT NULL
            );
        """)
        conn.execute("""
            INSERT OR IGNORE INTO meta (key, value) VALUES ('report_seq', 0);
        """)

    # Seed routing and handlers
    seed_routing_and_handlers(conn)


def seed_routing_and_handlers(conn: sqlite3.Connection) -> None:
    """Seeds the 60 routing combinations and 40 handlers if not already populated."""
    with conn:
        # Check if routing table is already seeded
        cursor = conn.execute("SELECT COUNT(*) FROM routing;")
        count = cursor.fetchone()[0]
        if count == 0:
            categories = ["Home", "Vehicle", "Personal", "Education"]
            bands = [
                ("Standard", 1),
                ("Senior", 2),
                ("Executive", 3),
            ]

            for zone in ZONES:
                for category in categories:
                    branch = f"{category} Loans Branch"
                    team = f"{zone} {category} Team"
                    depot = f"{zone}-{category[:3].upper()}-DEPOT"

                    for band_name, auth in bands:
                        conn.execute(
                            """
                            INSERT INTO routing (zone, category, band, branch, team, depot, authority)
                            VALUES (?, ?, ?, ?, ?, ?, ?);
                        """,
                            (zone, category, band_name, branch, team, depot, auth),
                        )

        # Check if handlers table is already seeded
        cursor = conn.execute("SELECT COUNT(*) FROM handlers;")
        h_count = cursor.fetchone()[0]
        if h_count == 0:
            categories = ["Home", "Vehicle", "Personal", "Education"]
            for zone in ZONES:
                for category in categories:
                    # Primary handler: authority 2, capacity 3
                    conn.execute(
                        """
                        INSERT INTO handlers (name, category, zone, role, authority, capacity, available)
                        VALUES (?, ?, ?, 'Primary', 2, 3, 1);
                    """,
                        (f"{zone} {category} Primary", category, zone),
                    )
                    # Backup handler: authority 3, capacity 2
                    conn.execute(
                        """
                        INSERT INTO handlers (name, category, zone, role, authority, capacity, available)
                        VALUES (?, ?, ?, 'Backup', 3, 2, 1);
                    """,
                        (f"{zone} {category} Backup", category, zone),
                    )


class Engine:
    """Main database and workflow engine for loan application processing."""

    def __init__(self, db_path: str = "loans.db"):
        self.db_path = db_path
        self._is_mem = db_path == ":memory:"
        if self._is_mem:
            self._mem_conn = sqlite3.connect(":memory:", timeout=30.0, check_same_thread=False)
            self._mem_conn.row_factory = sqlite3.Row
            init_db(self._mem_conn)
        else:
            with self._connection_scope() as conn:
                init_db(conn)

    def _get_connection(self) -> sqlite3.Connection:
        if getattr(self, "_is_mem", False):
            return self._mem_conn
        conn = sqlite3.connect(
            self.db_path, timeout=30.0, check_same_thread=False
        )
        conn.row_factory = sqlite3.Row
        return conn

    def _close_connection(self, conn: sqlite3.Connection) -> None:
        if not getattr(self, "_is_mem", False):
            conn.close()

    @contextlib.contextmanager
    def _connection_scope(self):
        conn = self._get_connection()
        try:
            yield conn
        finally:
            self._close_connection(conn)

    def next_report_id(self, conn: sqlite3.Connection) -> str:
        """Generates sequential report ID in RPT-000001 format."""
        cursor = conn.execute(
            "UPDATE meta SET value = value + 1 WHERE key = 'report_seq' RETURNING value;"
        )
        row = cursor.fetchone()
        if row is not None:
            seq = row[0]
        else:
            conn.execute(
                "INSERT INTO meta (key, value) VALUES ('report_seq', 1);"
            )
            seq = 1
        return f"RPT-{seq:06d}"

    def get_handler_load(
        self, conn: sqlite3.Connection, handler_id: int
    ) -> int:
        """Calculates current load: count of active reports (Assigned or In Progress)."""
        cursor = conn.execute(
            """
            SELECT COUNT(*) FROM reports
            WHERE handler_id = ? AND status IN ('Assigned', 'In Progress');
        """,
            (handler_id,),
        )
        return cursor.fetchone()[0]

    def try_dispatch(
        self, conn: sqlite3.Connection, report_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Runs the 6-step dispatch algorithm for a validated report.

        1) Build routing key 'zone|category|band'
        2) Look up routing row (branch, team, depot, required authority)
        3) Candidate scan: zone-primary, zone-backup, central-primary, central-backup
        4) Check eligibility (authority, availability, capacity [+1 for critical])
        5) Assign first eligible or place in waiting queue
        6) Record decision, reason, skipped handlers and history event
        """
        zone = report_data.get("zone_used", "Central")
        category = report_data.get("category", "")
        band = report_data.get("band", "Standard")
        urgency = report_data.get("urgency") or report_data.get("cleaned", {}).get("urgency", "normal")

        # 1. Build key
        routing_key = f"{zone}|{category}|band={band}"

        # 2. Look up routing table
        cursor = conn.execute(
            """
            SELECT branch, team, depot, authority FROM routing
            WHERE zone = ? AND category = ? AND band = ?;
        """,
            (zone, category, band),
        )
        routing_row = cursor.fetchone()
        if not routing_row:
            # Fallback to Central routing if not found
            cursor = conn.execute(
                """
                SELECT branch, team, depot, authority FROM routing
                WHERE zone = 'Central' AND category = ? AND band = ?;
            """,
                (category, band),
            )
            routing_row = cursor.fetchone()

        if routing_row:
            branch = routing_row["branch"]
            team = routing_row["team"]
            depot = routing_row["depot"]
            required_authority = routing_row["authority"]
        else:
            branch = f"{category} Loans Branch"
            team = f"{zone} {category} Team"
            depot = f"{zone}-{category[:3].upper()}-DEPOT"
            required_authority = (
                1 if band == "Standard" else (2 if band == "Senior" else 3)
            )

        # 3. Candidate scan list in deterministic order:
        # zone-primary, zone-backup, central-primary, central-backup
        candidate_specs: List[Tuple[str, str]] = [
            (zone, "Primary"),
            (zone, "Backup"),
        ]
        if zone != "Central":
            candidate_specs.append(("Central", "Primary"))
            candidate_specs.append(("Central", "Backup"))

        selected_handler: Optional[sqlite3.Row] = None
        skipped_notes: List[str] = []
        is_override = 0
        is_escalated = 0

        for cand_zone, cand_role in candidate_specs:
            cursor = conn.execute(
                """
                SELECT id, name, category, zone, role, authority, capacity, available
                FROM handlers
                WHERE zone = ? AND category = ? AND role = ?;
            """,
                (cand_zone, category, cand_role),
            )
            handler = cursor.fetchone()
            if not handler:
                continue

            h_name = handler["name"]
            h_auth = handler["authority"]
            h_cap = handler["capacity"]
            h_avail = handler["available"]
            current_load = self.get_handler_load(conn, handler["id"])

            # Check authority
            if h_auth < required_authority:
                skipped_notes.append(
                    f"{h_name} skipped (insufficient authority: auth {h_auth} < required {required_authority})"
                )
                continue

            # Check availability
            if not h_avail:
                skipped_notes.append(f"{h_name} skipped (unavailable)")
                continue

            # Check capacity
            # Emergency override: critical urgency may exceed capacity by 1
            effective_cap = h_cap + 1 if urgency == "critical" else h_cap
            if current_load >= effective_cap:
                skipped_notes.append(
                    f"{h_name} skipped (at capacity: {current_load}/{h_cap})"
                )
                continue

            # Eligible!
            selected_handler = handler
            if cand_zone == "Central" and zone != "Central":
                is_escalated = 1

            if urgency == "critical" and current_load >= h_cap:
                is_override = 1
            break

        if selected_handler:
            h_name = selected_handler["name"]
            status = "Assigned"
            queue = None
            handler_id = selected_handler["id"]
            handler_name = h_name

            reason_parts = [f"Assigned to {h_name}"]
            if is_escalated:
                reason_parts.append("(escalated to Central)")
            if is_override:
                reason_parts.append("(critical emergency capacity override +1)")
            if skipped_notes:
                reason_parts.append(f"[Skipped: {'; '.join(skipped_notes)}]")
            routing_reason = " ".join(reason_parts)
        else:
            status = "Pending"
            queue = "waiting"
            handler_id = None
            handler_name = None
            routing_reason = (
                f"Placed in waiting queue: all candidate handlers unavailable or at capacity. "
                f"[{'; '.join(skipped_notes)}]"
            )

        return {
            "status": status,
            "queue": queue,
            "handler_id": handler_id,
            "handler_name": handler_name,
            "branch": branch,
            "team": team,
            "depot": depot,
            "routing_reason": routing_reason,
            "escalated": is_escalated,
            "priority_override": is_override,
        }

    def submit_report(self, data: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        """Handles submission of a new report.

        Returns (http_status_code, response_dict).
        - 201: Valid and dispatched / waiting
        - 422: Invalid but stored in correction queue
        - 409: Duplicate valid application code
        - 400: Malformed input
        """
        val = validate_report_fields(data)
        cleaned = val["cleaned"]
        now = get_timestamp()

        with DB_LOCK:
            conn = self._get_connection()
            try:
                conn.execute("BEGIN IMMEDIATE;")

                # Check for duplicate valid application code
                app_code = cleaned.get("application_code", "")
                if val["valid"]:
                    cursor = conn.execute(
                        """
                        SELECT report_id FROM reports
                        WHERE application_code = ? AND validation_ok = 1;
                    """,
                        (app_code,),
                    )
                    dup = cursor.fetchone()
                    if dup:
                        conn.rollback()
                        return 409, {
                            "error": "Duplicate report",
                            "message": f"A report with application code '{app_code}' already exists.",
                            "existing_report_id": dup["report_id"],
                        }

                report_id = self.next_report_id(conn)

                if not val["valid"]:
                    # Store invalid report in correction queue
                    err_msg = "; ".join(val["errors"].values())
                    conn.execute(
                        """
                        INSERT INTO reports (
                            report_id, application_code, reporter_name, contact,
                            income, amount, description, urgency, priority_rank,
                            zone, zone_used, zone_fallback, category, band, class_note,
                            validation_ok, validation_msg, errors_json, raw_input,
                            status, queue, routing_reason, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'Pending', 'correction', ?, ?, ?);
                    """,
                        (
                            report_id,
                            app_code,
                            cleaned.get("reporter_name", ""),
                            cleaned.get("contact", ""),
                            cleaned.get("income"),
                            cleaned.get("amount"),
                            cleaned.get("description", ""),
                            cleaned.get("urgency", "normal"),
                            val["priority_rank"],
                            cleaned.get("zone", ""),
                            val["zone_used"],
                            val["zone_fallback"],
                            "Invalid",
                            val["band"],
                            val["class_note"],
                            err_msg,
                            json.dumps(val["errors"]),
                            json.dumps(data),
                            f"Validation failed: {err_msg}",
                            now,
                            now,
                        ),
                    )

                    conn.execute(
                        """
                        INSERT INTO events (report_id, ts, event)
                        VALUES (?, ?, ?);
                    """,
                        (
                            report_id,
                            now,
                            f"Report submitted: validation failed ({err_msg}). Placed in correction queue.",
                        ),
                    )

                    conn.commit()
                    return 422, {
                        "error": "Validation failed",
                        "message": err_msg,
                        "report_id": report_id,
                        "errors": val["errors"],
                        "category": "Invalid",
                    }

                # Report is valid -> dispatch
                dispatch_res = self.try_dispatch(conn, val)

                conn.execute(
                    """
                    INSERT INTO reports (
                        report_id, application_code, reporter_name, contact,
                        income, amount, description, urgency, priority_rank,
                        zone, zone_used, zone_fallback, category, band, class_note,
                        validation_ok, validation_msg, errors_json, raw_input,
                        status, queue, handler_id, handler_name, branch, team, depot,
                        routing_reason, escalated, priority_override, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '', '{}', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                    (
                        report_id,
                        app_code,
                        cleaned.get("reporter_name", ""),
                        cleaned.get("contact", ""),
                        cleaned.get("income"),
                        cleaned.get("amount"),
                        cleaned.get("description", ""),
                        cleaned.get("urgency", "normal"),
                        val["priority_rank"],
                        cleaned.get("zone", ""),
                        val["zone_used"],
                        val["zone_fallback"],
                        val["category"],
                        val["band"],
                        val["class_note"],
                        json.dumps(data),
                        dispatch_res["status"],
                        dispatch_res["queue"],
                        dispatch_res["handler_id"],
                        dispatch_res["handler_name"],
                        dispatch_res["branch"],
                        dispatch_res["team"],
                        dispatch_res["depot"],
                        dispatch_res["routing_reason"],
                        dispatch_res["escalated"],
                        dispatch_res["priority_override"],
                        now,
                        now,
                    ),
                )

                # History events
                conn.execute(
                    """
                    INSERT INTO events (report_id, ts, event) VALUES (?, ?, ?);
                """,
                    (
                        report_id,
                        now,
                        f"Report created. Validation passed for category {val['category']}.",
                    ),
                )

                if dispatch_res["handler_name"]:
                    event_text = (
                        f"Dispatched to handler {dispatch_res['handler_name']} "
                        f"({dispatch_res['branch']} - {dispatch_res['team']})."
                    )
                else:
                    event_text = "Placed in waiting queue."

                conn.execute(
                    """
                    INSERT INTO events (report_id, ts, event) VALUES (?, ?, ?);
                """,
                    (report_id, now, event_text),
                )

                conn.commit()

                return 201, {
                    "report_id": report_id,
                    "status": dispatch_res["status"],
                    "queue": dispatch_res["queue"],
                    "handler_name": dispatch_res["handler_name"],
                    "routing_reason": dispatch_res["routing_reason"],
                    "category": val["category"],
                    "priority_rank": val["priority_rank"],
                    "band": val["band"],
                }
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                self._close_connection(conn)

    def correct_report(
        self, report_id: str, data: Dict[str, Any]
    ) -> Tuple[int, Dict[str, Any]]:
        """Corrects an invalid report stored in the correction queue and re-validates."""
        val = validate_report_fields(data)
        cleaned = val["cleaned"]
        now = get_timestamp()

        with DB_LOCK:
            conn = self._get_connection()
            try:
                conn.execute("BEGIN IMMEDIATE;")

                cursor = conn.execute(
                    "SELECT * FROM reports WHERE report_id = ?;", (report_id,)
                )
                existing = cursor.fetchone()
                if not existing:
                    conn.rollback()
                    return 404, {
                        "error": "Not found",
                        "message": f"Report '{report_id}' not found.",
                    }

                app_code = cleaned.get("application_code", "")

                # Check duplicate code if now valid
                if val["valid"]:
                    cursor = conn.execute(
                        """
                        SELECT report_id FROM reports
                        WHERE application_code = ? AND validation_ok = 1 AND report_id != ?;
                    """,
                        (app_code, report_id),
                    )
                    dup = cursor.fetchone()
                    if dup:
                        conn.rollback()
                        return 409, {
                            "error": "Duplicate report",
                            "message": f"A report with application code '{app_code}' already exists.",
                            "existing_report_id": dup["report_id"],
                        }

                if not val["valid"]:
                    err_msg = "; ".join(val["errors"].values())
                    conn.execute(
                        """
                        UPDATE reports SET
                            application_code = ?, reporter_name = ?, contact = ?,
                            income = ?, amount = ?, description = ?, urgency = ?,
                            priority_rank = ?, zone = ?, zone_used = ?, zone_fallback = ?,
                            category = 'Invalid', band = ?, class_note = ?,
                            validation_ok = 0, validation_msg = ?, errors_json = ?,
                            raw_input = ?, routing_reason = ?, updated_at = ?
                        WHERE report_id = ?;
                    """,
                        (
                            app_code,
                            cleaned.get("reporter_name", ""),
                            cleaned.get("contact", ""),
                            cleaned.get("income"),
                            cleaned.get("amount"),
                            cleaned.get("description", ""),
                            cleaned.get("urgency", "normal"),
                            val["priority_rank"],
                            cleaned.get("zone", ""),
                            val["zone_used"],
                            val["zone_fallback"],
                            val["band"],
                            val["class_note"],
                            err_msg,
                            json.dumps(val["errors"]),
                            json.dumps(data),
                            f"Correction failed: {err_msg}",
                            now,
                            report_id,
                        ),
                    )

                    conn.execute(
                        """
                        INSERT INTO events (report_id, ts, event) VALUES (?, ?, ?);
                    """,
                        (
                            report_id,
                            now,
                            f"Correction resubmission failed: {err_msg}.",
                        ),
                    )

                    conn.commit()
                    return 422, {
                        "error": "Validation failed",
                        "message": err_msg,
                        "report_id": report_id,
                        "errors": val["errors"],
                    }

                # Now valid! Dispatch it
                dispatch_res = self.try_dispatch(conn, val)

                conn.execute(
                    """
                    UPDATE reports SET
                        application_code = ?, reporter_name = ?, contact = ?,
                        income = ?, amount = ?, description = ?, urgency = ?,
                        priority_rank = ?, zone = ?, zone_used = ?, zone_fallback = ?,
                        category = ?, band = ?, class_note = ?,
                        validation_ok = 1, validation_msg = '', errors_json = '{}',
                        raw_input = ?, status = ?, queue = ?, handler_id = ?,
                        handler_name = ?, branch = ?, team = ?, depot = ?,
                        routing_reason = ?, escalated = ?, priority_override = ?,
                        updated_at = ?
                    WHERE report_id = ?;
                """,
                    (
                        app_code,
                        cleaned.get("reporter_name", ""),
                        cleaned.get("contact", ""),
                        cleaned.get("income"),
                        cleaned.get("amount"),
                        cleaned.get("description", ""),
                        cleaned.get("urgency", "normal"),
                        val["priority_rank"],
                        cleaned.get("zone", ""),
                        val["zone_used"],
                        val["zone_fallback"],
                        val["category"],
                        val["band"],
                        val["class_note"],
                        json.dumps(data),
                        dispatch_res["status"],
                        dispatch_res["queue"],
                        dispatch_res["handler_id"],
                        dispatch_res["handler_name"],
                        dispatch_res["branch"],
                        dispatch_res["team"],
                        dispatch_res["depot"],
                        dispatch_res["routing_reason"],
                        dispatch_res["escalated"],
                        dispatch_res["priority_override"],
                        now,
                        report_id,
                    ),
                )

                conn.execute(
                    """
                    INSERT INTO events (report_id, ts, event) VALUES (?, ?, ?);
                """,
                    (
                        report_id,
                        now,
                        f"Report corrected and successfully validated as {val['category']}.",
                    ),
                )

                if dispatch_res["handler_name"]:
                    event_text = f"Dispatched to handler {dispatch_res['handler_name']}."
                else:
                    event_text = "Placed in waiting queue."

                conn.execute(
                    """
                    INSERT INTO events (report_id, ts, event) VALUES (?, ?, ?);
                """,
                    (report_id, now, event_text),
                )

                conn.commit()

                return 200, {
                    "report_id": report_id,
                    "status": dispatch_res["status"],
                    "queue": dispatch_res["queue"],
                    "handler_name": dispatch_res["handler_name"],
                    "routing_reason": dispatch_res["routing_reason"],
                }
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                self._close_connection(conn)

    def update_report_status(
        self, report_id: str, new_status: str
    ) -> Tuple[int, Dict[str, Any]]:
        """Updates report status forward through: Pending -> Assigned -> In Progress -> Resolved.

        Enforces legal lifecycle transitions (409 on illegal).
        Resolving a report triggers re-running the waiting queue.
        """
        if new_status not in VALID_STATUSES:
            return 400, {
                "error": "Invalid status",
                "message": f"Status must be one of {', '.join(VALID_STATUSES)}",
            }

        now = get_timestamp()

        with DB_LOCK:
            conn = self._get_connection()
            try:
                conn.execute("BEGIN IMMEDIATE;")
                cursor = conn.execute(
                    "SELECT * FROM reports WHERE report_id = ?;", (report_id,)
                )
                row = cursor.fetchone()
                if not row:
                    conn.rollback()
                    return 404, {
                        "error": "Not found",
                        "message": f"Report '{report_id}' not found.",
                    }

                curr_status = row["status"]
                if new_status not in LEGAL_TRANSITIONS.get(curr_status, set()):
                    conn.rollback()
                    return 409, {
                        "error": "Illegal status transition",
                        "message": f"Cannot transition report from '{curr_status}' to '{new_status}'.",
                    }

                conn.execute(
                    """
                    UPDATE reports SET status = ?, updated_at = ? WHERE report_id = ?;
                """,
                    (new_status, now, report_id),
                )

                conn.execute(
                    """
                    INSERT INTO events (report_id, ts, event) VALUES (?, ?, ?);
                """,
                    (
                        report_id,
                        now,
                        f"Status transitioned from {curr_status} to {new_status}.",
                    ),
                )

                conn.commit()

                # If Resolved, re-run waiting queue
                if new_status == "Resolved":
                    self.process_waiting_queue(conn)

                # Return updated report
                cursor = conn.execute(
                    "SELECT * FROM reports WHERE report_id = ?;", (report_id,)
                )
                updated = self._row_to_report_dict(cursor.fetchone())
                return 200, updated
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                self._close_connection(conn)

    def update_handler(
        self, handler_id: int, available: Optional[bool], capacity: Optional[int]
    ) -> Tuple[int, Dict[str, Any]]:
        """Updates handler availability and/or capacity (0-50).

        Re-runs waiting queue.
        """
        if capacity is not None:
            if not isinstance(capacity, int) or capacity < 0 or capacity > 50:
                return 400, {
                    "error": "Invalid capacity",
                    "message": "Capacity must be an integer between 0 and 50.",
                }

        with DB_LOCK:
            conn = self._get_connection()
            try:
                conn.execute("BEGIN IMMEDIATE;")
                cursor = conn.execute(
                    "SELECT * FROM handlers WHERE id = ?;", (handler_id,)
                )
                h = cursor.fetchone()
                if not h:
                    conn.rollback()
                    return 404, {
                        "error": "Not found",
                        "message": f"Handler with ID {handler_id} not found.",
                    }

                new_avail = (
                    h["available"]
                    if available is None
                    else (1 if available else 0)
                )
                new_cap = h["capacity"] if capacity is None else capacity

                conn.execute(
                    """
                    UPDATE handlers SET available = ?, capacity = ? WHERE id = ?;
                """,
                    (new_avail, new_cap, handler_id),
                )

                conn.commit()

                # Handler updated -> re-run waiting queue
                self.process_waiting_queue(conn)

                cursor = conn.execute(
                    "SELECT * FROM handlers WHERE id = ?;", (handler_id,)
                )
                updated_h = self._row_to_handler_dict(conn, cursor.fetchone())
                return 200, updated_h
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                self._close_connection(conn)

    def process_waiting_queue(
        self, conn: Optional[sqlite3.Connection] = None
    ) -> int:
        """Processes all reports in the waiting queue deterministically.

        Order: priority_rank ASC (critical 0 first), created_at ASC, id ASC.
        Returns count of reports successfully dispatched.
        """
        owns_conn = False
        if conn is None:
            conn = self._get_connection()
            conn.execute("BEGIN IMMEDIATE;")
            owns_conn = True

        dispatched_count = 0
        try:
            # Query waiting reports
            cursor = conn.execute("""
                SELECT * FROM reports
                WHERE queue = 'waiting' AND validation_ok = 1
                ORDER BY priority_rank ASC, created_at ASC, id ASC;
            """)
            waiting_reports = cursor.fetchall()
            now = get_timestamp()

            for r in waiting_reports:
                report_dict = dict(r)
                dispatch_res = self.try_dispatch(conn, report_dict)

                if dispatch_res["status"] == "Assigned":
                    conn.execute(
                        """
                        UPDATE reports SET
                            status = 'Assigned',
                            queue = NULL,
                            handler_id = ?,
                            handler_name = ?,
                            branch = ?,
                            team = ?,
                            depot = ?,
                            routing_reason = ?,
                            escalated = ?,
                            priority_override = ?,
                            updated_at = ?
                        WHERE id = ?;
                    """,
                        (
                            dispatch_res["handler_id"],
                            dispatch_res["handler_name"],
                            dispatch_res["branch"],
                            dispatch_res["team"],
                            dispatch_res["depot"],
                            dispatch_res["routing_reason"],
                            dispatch_res["escalated"],
                            dispatch_res["priority_override"],
                            now,
                            r["id"],
                        ),
                    )

                    conn.execute(
                        """
                        INSERT INTO events (report_id, ts, event) VALUES (?, ?, ?);
                    """,
                        (
                            r["report_id"],
                            now,
                            f"Dispatched from waiting queue to handler {dispatch_res['handler_name']}.",
                        ),
                    )
                    dispatched_count += 1

            if owns_conn:
                conn.commit()
            return dispatched_count
        except Exception:
            if owns_conn:
                conn.rollback()
            raise
        finally:
            if owns_conn:
                self._close_connection(conn)

    def get_report(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single report with its event history."""
        with self._connection_scope() as conn:
            cursor = conn.execute(
                "SELECT * FROM reports WHERE report_id = ?;", (report_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None

            report_dict = self._row_to_report_dict(row)

            cur_events = conn.execute(
                """
                SELECT ts, event FROM events WHERE report_id = ? ORDER BY id ASC;
            """,
                (report_id,),
            )
            history = [
                {"ts": e["ts"], "event": e["event"]}
                for e in cur_events.fetchall()
            ]

            return {"report": report_dict, "history": history}

    def list_reports(
        self,
        q: Optional[str] = None,
        status: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Lists reports with optional filters and computes aggregate counts."""
        with self._connection_scope() as conn:
            query = "SELECT * FROM reports WHERE 1=1"
            params: List[Any] = []

            if q:
                ql = f"%{q.strip().lower()}%"
                query += " AND (LOWER(report_id) LIKE ? OR LOWER(application_code) LIKE ? OR LOWER(reporter_name) LIKE ?)"
                params.extend([ql, ql, ql])

            if status:
                query += " AND status = ?"
                params.append(status)

            if category:
                query += " AND category = ?"
                params.append(category)

            query += " ORDER BY id DESC;"

            cursor = conn.execute(query, params)
            reports = [
                self._row_to_report_dict(r) for r in cursor.fetchall()
            ]

            # Overall counts by status
            cur_counts = conn.execute("""
                SELECT status, COUNT(*) as cnt FROM reports GROUP BY status;
            """)
            status_map = {row["status"]: row["cnt"] for row in cur_counts.fetchall()}
            total_cursor = conn.execute("SELECT COUNT(*) FROM reports;")
            total_count = total_cursor.fetchone()[0]

            counts = {
                "total": total_count,
                "Pending": status_map.get("Pending", 0),
                "Assigned": status_map.get("Assigned", 0),
                "In Progress": status_map.get("In Progress", 0),
                "Resolved": status_map.get("Resolved", 0),
            }

            return {"reports": reports, "counts": counts}

    def list_handlers(self) -> List[Dict[str, Any]]:
        """Returns all handlers with their calculated active load."""
        with self._connection_scope() as conn:
            cursor = conn.execute("SELECT * FROM handlers ORDER BY id ASC;")
            handlers = [
                self._row_to_handler_dict(conn, r) for r in cursor.fetchall()
            ]
            return handlers

    def get_handler_reports(self, handler_id: int) -> List[Dict[str, Any]]:
        """Returns reports currently assigned to the given handler."""
        with self._connection_scope() as conn:
            cursor = conn.execute(
                """
                SELECT * FROM reports
                WHERE handler_id = ?
                ORDER BY id DESC;
            """,
                (handler_id,),
            )
            return [self._row_to_report_dict(r) for r in cursor.fetchall()]

    def list_routing(self) -> List[Dict[str, Any]]:
        """Returns all rows from routing table."""
        with self._connection_scope() as conn:
            cursor = conn.execute("""
                SELECT zone, category, band, branch, team, depot, authority
                FROM routing
                ORDER BY zone ASC, category ASC, authority ASC;
            """)
            return [dict(r) for r in cursor.fetchall()]

    def get_queues(self) -> Dict[str, Any]:
        """Returns queue data: waiting, correction, escalations, overrides."""
        with self._connection_scope() as conn:
            # Waiting queue
            cur_wait = conn.execute("""
                SELECT * FROM reports
                WHERE queue = 'waiting'
                ORDER BY priority_rank ASC, created_at ASC, id ASC;
            """)
            waiting = [
                self._row_to_report_dict(r) for r in cur_wait.fetchall()
            ]

            # Correction queue
            cur_corr = conn.execute("""
                SELECT * FROM reports
                WHERE queue = 'correction'
                ORDER BY id DESC;
            """)
            correction = [
                self._row_to_report_dict(r) for r in cur_corr.fetchall()
            ]

            # Escalations
            cur_esc = conn.execute("""
                SELECT * FROM reports
                WHERE escalated = 1
                ORDER BY id DESC;
            """)
            escalations = [
                self._row_to_report_dict(r) for r in cur_esc.fetchall()
            ]

            # Overrides
            cur_over = conn.execute("""
                SELECT * FROM reports
                WHERE priority_override = 1 OR urgency = 'critical'
                ORDER BY id DESC;
            """)
            overrides = [
                self._row_to_report_dict(r) for r in cur_over.fetchall()
            ]

            return {
                "waiting": waiting,
                "correction": correction,
                "escalations": escalations,
                "overrides": overrides,
            }

    def get_analytics(self) -> Dict[str, Any]:
        """Returns aggregated analytics:

        - total
        - by_zone: [{label, n}]
        - by_category: {Home, Vehicle, Personal, Education, Invalid}
        - by_status: {Pending, Assigned, In Progress, Resolved}
        - by_priority: [{label, n}]
        - resolved, unresolved, waiting, correction, escalated
        """
        with self._connection_scope() as conn:
            cur_total = conn.execute("SELECT COUNT(*) FROM reports;")
            total = cur_total.fetchone()[0]

            # By zone (North, South, East, West, Central)
            cur_zone = conn.execute("""
                SELECT zone_used, COUNT(*) as cnt FROM reports GROUP BY zone_used;
            """)
            zone_counts = {r["zone_used"]: r["cnt"] for r in cur_zone.fetchall()}
            by_zone = [{"label": z, "n": zone_counts.get(z, 0)} for z in ZONES]

            # By category
            all_cats = ["Home", "Vehicle", "Personal", "Education", "Invalid"]
            cur_cat = conn.execute("""
                SELECT category, COUNT(*) as cnt FROM reports GROUP BY category;
            """)
            cat_counts = {r["category"]: r["cnt"] for r in cur_cat.fetchall()}
            by_category = {c: cat_counts.get(c, 0) for c in all_cats}

            # By status
            cur_st = conn.execute("""
                SELECT status, COUNT(*) as cnt FROM reports GROUP BY status;
            """)
            st_counts = {r["status"]: r["cnt"] for r in cur_st.fetchall()}
            by_status = {s: st_counts.get(s, 0) for s in VALID_STATUSES}

            # By priority [{label, n}]
            cur_pri = conn.execute("""
                SELECT urgency, COUNT(*) as cnt FROM reports GROUP BY urgency;
            """)
            pri_counts = {r["urgency"]: r["cnt"] for r in cur_pri.fetchall()}
            by_priority = [{"label": u, "n": pri_counts.get(u, 0)} for u in URGENCIES]

            # Counts
            cur_res = conn.execute(
                "SELECT COUNT(*) FROM reports WHERE status = 'Resolved';"
            )
            resolved = cur_res.fetchone()[0]
            unresolved = total - resolved

            cur_wait = conn.execute(
                "SELECT COUNT(*) FROM reports WHERE queue = 'waiting';"
            )
            waiting = cur_wait.fetchone()[0]

            cur_corr = conn.execute(
                "SELECT COUNT(*) FROM reports WHERE queue = 'correction';"
            )
            correction = cur_corr.fetchone()[0]

            cur_esc = conn.execute(
                "SELECT COUNT(*) FROM reports WHERE escalated = 1;"
            )
            escalated = cur_esc.fetchone()[0]

            return {
                "total": total,
                "by_zone": by_zone,
                "by_category": by_category,
                "by_status": by_status,
                "by_priority": by_priority,
                "resolved": resolved,
                "unresolved": unresolved,
                "waiting": waiting,
                "correction": correction,
                "escalated": escalated,
            }

    def seed_demo_reports(self) -> int:
        """Seeds 7 sample reports covering:

        1. Home loan (Standard band)
        2. Vehicle loan (Senior band)
        3. Personal loan (Standard band)
        4. Education loan (Executive band)
        5. Invalid category report (amount exceeds ceiling -> correction queue)
        6. Unknown zone report (e.g. 'Atlantis', falling back to Central)
        7. Critical urgency report (priority rank 0, emergency capacity override)
        8. Malformed application code (e.g. 'LOANX999999' -> correction queue)
        """
        demo_reports = [
            # 1. Home
            {
                "reporter_name": "Aarav Sharma",
                "contact": "aarav.sharma@example.com",
                "application_code": "LOANH100001",
                "income": "1200000",
                "amount": "800000",
                "zone": "North",
                "urgency": "normal",
                "description": "Application for purchasing residential flat in Gurgaon.",
            },
            # 2. Vehicle
            {
                "reporter_name": "Priya Patel",
                "contact": "priya.patel@example.com",
                "application_code": "LOANV200002",
                "income": "2500000",
                "amount": "3000000",
                "zone": "West",
                "urgency": "high",
                "description": "Loan for buying a new electric sedan car.",
            },
            # 3. Personal
            {
                "reporter_name": "Rahul Verma",
                "contact": "+91-9876543210",
                "application_code": "LOANP300003",
                "income": "900000",
                "amount": "400000",
                "zone": "South",
                "urgency": "low",
                "description": "Personal loan for family medical emergency expenses.",
            },
            # 4. Education (Executive band > 50 lakh)
            {
                "reporter_name": "Ananya Iyer",
                "contact": "ananya.iyer@example.com",
                "application_code": "LOANE400004",
                "income": "1500000",
                "amount": "6000000",
                "zone": "East",
                "urgency": "normal",
                "description": "Higher education university tuition and campus degree expenses.",
            },
            # 5. Invalid category report with malformed application code
            {
                "reporter_name": "Siddharth Nair",
                "contact": "sid.nair@example.com",
                "application_code": "LOANX999999",  # Malformed code: 'X' is invalid type letter
                "income": "3000000",
                "amount": "1500000",
                "zone": "Central",
                "urgency": "normal",
                "description": "Personal loan for luxury vacation travel.",
            },
            # 6. Unknown zone report -> Central fallback
            {
                "reporter_name": "Kavita Rao",
                "contact": "kavita.rao@example.com",
                "application_code": "LOANH600006",
                "income": "1800000",
                "amount": "4500000",
                "zone": "Overseas",  # Unknown zone
                "urgency": "normal",
                "description": "Home renovation and property expansion.",
            },
            # 7. Critical urgency report (Emergency override)
            {
                "reporter_name": "Vikram Singh",
                "contact": "vikram.singh@example.com",
                "application_code": "LOANV700007",
                "income": "4000000",
                "amount": "12000000",
                "zone": "North",
                "urgency": "critical",
                "description": "Urgent fleet commercial vehicle replacement.",
            },
        ]

        count = 0
        for r in demo_reports:
            status, _ = self.submit_report(r)
            if status in (201, 422):
                count += 1
        return count

    def _row_to_report_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        # Convert numeric booleans and JSON if needed
        d["escalated"] = bool(d.get("escalated", 0))
        d["priority_override"] = bool(d.get("priority_override", 0))
        return d

    def _row_to_handler_dict(
        self, conn: sqlite3.Connection, row: sqlite3.Row
    ) -> Dict[str, Any]:
        d = dict(row)
        d["available"] = bool(d.get("available", 1))
        d["load"] = self.get_handler_load(conn, d["id"])
        return d
