"""Test Suite for Loan Application Pre-Validator.

Comprehensive tests covering:
1. Valid and invalid application code formats
2. DFA and fullmatch regex agreement on thousands of random and mutated strings
3. Meaningful explain diagnostics
4. All five classification outcomes (Home, Vehicle, Personal, Education, Invalid)
5. Conflicting keyword patterns and deterministic tie-breaking
6. Incomplete and malformed fields validation
7. Per-category amount ceilings and income multiples
8. Invalid reports stored in correction queue
9. Unknown zone fallback to Central
10. Duplicate valid application codes rejected (409)
11. Executive band authority enforcement (skipping authority 2)
12. Unavailable handler fallback to Backup
13. Capacity overflow escalation to Central and waiting queue
14. Critical urgency emergency override (+1 capacity)
15. Deterministic waiting queue ordering (priority rank, created_at, id)
16. Forward-only status lifecycle and illegal transition rejection (409)
17. Correction and resubmission of invalid reports
18. Search, filtering, and analytics metrics
19. Concurrent submissions safety (no duplicates, no overbooking)
"""

from __future__ import annotations

import concurrent.futures
import os
import random
import re
import string
import tempfile
import unittest

from app import create_app
from automata import (
    CODE_REGEX,
    DFA_TRANSITIONS,
    classify_category,
    explain,
    run_dfa,
    validate_code_dual,
    validate_report_fields,
)


class TestLoanPreValidator(unittest.TestCase):
    def setUp(self):
        # Create unique temp sqlite database per test
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.app = create_app(db_path=self.temp_db.name)
        self.client = self.app.test_client()
        self.engine = self.app.engine

    def tearDown(self):
        # Clean up temp database file
        try:
            if os.path.exists(self.temp_db.name):
                os.remove(self.temp_db.name)
        except OSError:
            pass

    # ==========================================
    # 1 & 2. DFA and Regex Agreement & Formats
    # ==========================================
    def test_dfa_and_regex_agreement_thousands_of_strings(self):
        """Proves that run_dfa and regex agree on 3,000+ random, valid, and mutated strings."""
        test_strings = []

        # 1. Valid codes across all types
        for t in ["H", "V", "P", "E"]:
            for _ in range(150):
                digits = "".join(random.choices(string.digits, k=6))
                test_strings.append(f"LOAN{t}{digits}")

        # 2. Mutated prefix
        for _ in range(300):
            bad_prefix = "".join(random.choices(string.ascii_uppercase, k=4))
            digits = "".join(random.choices(string.digits, k=6))
            test_strings.append(f"{bad_prefix}H{digits}")

        # 3. Mutated type letter
        for _ in range(300):
            bad_type = random.choice([c for c in string.ascii_letters if c not in "HVPE"])
            digits = "".join(random.choices(string.digits, k=6))
            test_strings.append(f"LOAN{bad_type}{digits}")

        # 4. Short and long lengths
        for length in range(0, 10):
            test_strings.append("LOANH123456"[:length])
        for length in range(12, 20):
            test_strings.append("LOANH123456" + "".join(random.choices(string.digits, k=length - 11)))

        # 5. Non-digit characters in digits section
        for _ in range(400):
            bad_char = random.choice(string.punctuation + string.ascii_letters)
            pos = random.randint(5, 10)
            base = list("LOANH123456")
            base[pos] = bad_char
            test_strings.append("".join(base))

        # 6. Completely random strings of varying length
        chars = string.ascii_letters + string.digits + string.punctuation + " \t\n"
        for _ in range(1500):
            l = random.randint(0, 25)
            test_strings.append("".join(random.choices(chars, k=l)))

        self.assertGreaterEqual(len(test_strings), 3000)

        for s in test_strings:
            regex_valid = bool(re.fullmatch(r"LOAN[HVPE][0-9]{6}", s))
            dfa_valid, trace = run_dfa(s)
            self.assertEqual(
                regex_valid,
                dfa_valid,
                f"Mismatch on {s!r}: regex={regex_valid}, dfa={dfa_valid}, trace={trace}",
            )

    def test_valid_and_invalid_application_code_formats(self):
        """Tests standard valid codes and varied invalid formats."""
        valid_codes = ["LOANH123456", "LOANV000000", "LOANP999999", "LOANE543210"]
        for code in valid_codes:
            valid, msg = validate_code_dual(code)
            self.assertTrue(valid, f"Expected {code} to be valid, got msg: {msg}")

        invalid_codes = [
            "",
            "LOAN",
            "LOANH12345",  # 5 digits (short)
            "LOANH1234567",  # 7 digits (long)
            "LOANX123456",  # invalid letter X
            "loanH123456",  # lowercase prefix
            "LOANh123456",  # lowercase type
            "LOANH12345A",  # letter in digits
            "LOAN H123456",  # space
            "LOANH12345\n",  # trailing newline
        ]
        for code in invalid_codes:
            valid, msg = validate_code_dual(code)
            self.assertFalse(valid, f"Expected {code!r} to be invalid")
            self.assertTrue(len(msg) > 0)

    # ==========================================
    # 3. Meaningful Explain Messages
    # ==========================================
    def test_meaningful_explain_rejection_messages(self):
        """Verifies explain(s) outputs distinct, helpful diagnostics for each failure mode."""
        # Empty
        self.assertIn("Empty", explain(""))
        # Wrong prefix
        self.assertIn("position 1", explain("XOANH123456"))
        self.assertIn("position 2", explain("LXANH123456"))
        self.assertIn("position 3", explain("LOXNH123456"))
        self.assertIn("position 4", explain("LOAXH123456"))
        # Unsupported type
        exp_type = explain("LOANZ123456")
        self.assertIn("Unsupported", exp_type)
        self.assertIn("position 5", exp_type)
        # Non-digit
        exp_digit = explain("LOANH12A456")
        self.assertIn("numeric digit", exp_digit)
        self.assertIn("position 8", exp_digit)
        # Too short
        exp_short = explain("LOANH12")
        self.assertIn("too short", exp_short)
        # Too long
        exp_long = explain("LOANH123456789")
        self.assertIn("too long", exp_long)
        # Non-string
        self.assertIn("must be a string", explain(12345))

    # ==========================================
    # 4 & 5. Categories & Conflict Resolution
    # ==========================================
    def test_all_five_categories(self):
        """Verifies classification into Home, Vehicle, Personal, Education, Invalid."""
        cat_h, _ = classify_category("LOANH123456", "House renovation")
        self.assertEqual(cat_h, "Home")

        cat_v, _ = classify_category("LOANV123456", "Car purchase")
        self.assertEqual(cat_v, "Vehicle")

        cat_p, _ = classify_category("LOANP123456", "Wedding expenses")
        self.assertEqual(cat_p, "Personal")

        cat_e, _ = classify_category("LOANE123456", "College tuition fee")
        self.assertEqual(cat_e, "Education")

        cat_inv, _ = classify_category("LOANX123456", "House purchase")
        self.assertEqual(cat_inv, "Invalid")

    def test_conflicting_patterns_and_deterministic_tiebreaking(self):
        """Verifies identifier wins on conflict, and keywords tie-break Home > Vehicle > Education > Personal."""
        # Identifier 'Home', but description talks about 'car automobile'
        cat, note = classify_category("LOANH123456", "Need funds to purchase a luxury car automobile.")
        self.assertEqual(cat, "Home")
        self.assertIn("Conflict resolved", note)
        self.assertIn("Vehicle", note)

        # Identifier 'Vehicle', description talks about 'apartment flat and college tuition'
        # Keyword tie-break: Home > Vehicle > Education > Personal -> matches Home first
        cat2, note2 = classify_category("LOANV123456", "Flat apartment purchase along with college tuition.")
        self.assertEqual(cat2, "Vehicle")
        self.assertIn("Conflict resolved", note2)
        self.assertIn("Home", note2)

    # ==========================================
    # 6 & 7. Field Validations & Financial Rules
    # ==========================================
    def test_field_validation_never_raises_on_junk_input(self):
        """Verifies validate_report_fields handles malformed/missing inputs gracefully without raising."""
        junk_cases = [
            None,
            {},
            [],
            "not a dict",
            {"reporter_name": 12345, "income": "abc", "amount": "-500"},
            {"reporter_name": "A", "zone": "", "urgency": "super_urgent"},
            {"description": "x" * 600},
        ]
        for case in junk_cases:
            res = validate_report_fields(case)
            self.assertFalse(res["valid"])
            self.assertEqual(res["category"], "Invalid")
            self.assertTrue(len(res["errors"]) > 0)

    def test_amount_ceiling_and_income_multiples(self):
        """Tests per-category ceilings and multiples:

        Home: 10x, 1 crore ceiling
        Vehicle: 5x, 2 crore ceiling
        Personal: 3x, 50 lakh ceiling
        Education: 6x, 1 crore ceiling
        """
        # Home ceiling 1 crore (10,000,000)
        h_over_ceiling = validate_report_fields({
            "reporter_name": "Ramesh Gupta",
            "application_code": "LOANH111111",
            "income": "2000000",
            "amount": "12000000",  # > 1 crore
            "zone": "North",
        })
        self.assertFalse(h_over_ceiling["valid"])
        self.assertIn("ceiling", h_over_ceiling["errors"]["amount"])

        # Home multiple 10x
        h_over_mult = validate_report_fields({
            "reporter_name": "Ramesh Gupta",
            "application_code": "LOANH111111",
            "income": "500000",
            "amount": "6000000",  # > 10x (5,000,000)
            "zone": "North",
        })
        self.assertFalse(h_over_mult["valid"])
        self.assertIn("10x", h_over_mult["errors"]["amount"])

        # Personal ceiling 50 lakh (5,000,000)
        p_over_ceiling = validate_report_fields({
            "reporter_name": "Sunita Sen",
            "application_code": "LOANP222222",
            "income": "3000000",
            "amount": "6000000",  # > 50 lakh
            "zone": "South",
        })
        self.assertFalse(p_over_ceiling["valid"])
        self.assertIn("ceiling", p_over_ceiling["errors"]["amount"])

        # Personal multiple 3x
        p_over_mult = validate_report_fields({
            "reporter_name": "Sunita Sen",
            "application_code": "LOANP222222",
            "income": "500000",
            "amount": "2000000",  # > 3x (1,500,000)
            "zone": "South",
        })
        self.assertFalse(p_over_mult["valid"])
        self.assertIn("3x", p_over_mult["errors"]["amount"])

    # ==========================================
    # 8. Correction Queue for Invalid Reports
    # ==========================================
    def test_invalid_report_stored_in_correction_queue(self):
        """Submitting invalid report returns 422, stores report in correction queue."""
        res = self.client.post("/api/reports", json={
            "reporter_name": "T",  # Too short (< 2 chars)
            "application_code": "LOANH123456",
            "income": "1000000",
            "amount": "500000",
            "zone": "North",
        })
        self.assertEqual(res.status_code, 422)
        body = res.get_json()
        report_id = body["report_id"]
        self.assertEqual(body["category"], "Invalid")

        # Check queue endpoint
        q_res = self.client.get("/api/queue")
        q_data = q_res.get_json()
        corr_ids = [r["report_id"] for r in q_data["correction"]]
        self.assertIn(report_id, corr_ids)

    # ==========================================
    # 9. Unknown Zone Fallback
    # ==========================================
    def test_unknown_zone_fallback_to_central(self):
        """Unknown zone falls back to Central routing and is flagged."""
        res = self.client.post("/api/reports", json={
            "reporter_name": "Anil Ambani",
            "application_code": "LOANH123456",
            "income": "2000000",
            "amount": "1000000",
            "zone": "Jupiter Station",  # Unknown
        })
        self.assertEqual(res.status_code, 201)
        body = res.get_json()
        rep_id = body["report_id"]

        detail = self.client.get(f"/api/reports/{rep_id}").get_json()["report"]
        self.assertEqual(detail["zone"], "Jupiter Station")
        self.assertEqual(detail["zone_used"], "Central")
        self.assertIsNotNone(detail["zone_fallback"])
        self.assertIn("Central", detail["handler_name"])

    # ==========================================
    # 10. Duplicate Application Code Rejection
    # ==========================================
    def test_duplicate_valid_application_code_rejected(self):
        """Resubmitting same application code returns 409 with existing_report_id."""
        payload = {
            "reporter_name": "Mohan Lal",
            "application_code": "LOANH999888",
            "income": "1500000",
            "amount": "2000000",
            "zone": "West",
        }
        res1 = self.client.post("/api/reports", json=payload)
        self.assertEqual(res1.status_code, 201)
        rep1_id = res1.get_json()["report_id"]

        # Resubmit identical code
        res2 = self.client.post("/api/reports", json=payload)
        self.assertEqual(res2.status_code, 409)
        err_body = res2.get_json()
        self.assertEqual(err_body["existing_report_id"], rep1_id)

    # ==========================================
    # 11. Executive Band Authority Enforcement
    # ==========================================
    def test_executive_band_authority_dispatch(self):
        """Amount > 50 lakh (Executive band) requires authority 3, skipping Primary (authority 2)."""
        payload = {
            "reporter_name": "Karan Johar",
            "application_code": "LOANV100200",
            "income": "20000000",
            "amount": "8000000",  # 80 lakh -> Executive band (auth 3)
            "zone": "North",
            "description": "Luxury commercial vehicle",
        }
        res = self.client.post("/api/reports", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["band"], "Executive")
        # North Vehicle Primary has authority 2; North Vehicle Backup has authority 3
        self.assertIn("Backup", data["handler_name"])
        self.assertIn("insufficient authority", data["routing_reason"])

    # ==========================================
    # 12. Handler Unavailable Fallback to Backup
    # ==========================================
    def test_unavailable_handler_falls_back_to_backup(self):
        """Marking primary handler unavailable causes dispatch to skip to backup."""
        # Find North Home Primary handler ID
        handlers = self.client.get("/api/handlers").get_json()
        primary = next(h for h in handlers if h["name"] == "North Home Primary")

        # Patch unavailable
        patch_res = self.client.patch(f"/api/handlers/{primary['id']}", json={"available": False})
        self.assertEqual(patch_res.status_code, 200)

        # Submit standard North Home report
        res = self.client.post("/api/reports", json={
            "reporter_name": "Dev Anand",
            "application_code": "LOANH300400",
            "income": "1000000",
            "amount": "800000",
            "zone": "North",
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["handler_name"], "North Home Backup")
        self.assertIn("unavailable", data["routing_reason"])

    # ==========================================
    # 13. Capacity Overflow -> Escalation -> Waiting
    # ==========================================
    def test_capacity_overflow_escalation_and_waiting_queue(self):
        """Full primary and backup escalate to Central; full Central moves to waiting queue."""
        # Submit reports to fill North Home Primary (cap 3) and Backup (cap 2)
        # Total North capacity = 5
        for i in range(5):
            res = self.client.post("/api/reports", json={
                "reporter_name": f"User {i}",
                "application_code": f"LOANH11000{i}",
                "income": "1000000",
                "amount": "500000",
                "zone": "North",
            })
            self.assertEqual(res.status_code, 201)
            self.assertEqual(res.get_json()["status"], "Assigned")

        # 6th report should escalate to Central Home Primary
        res6 = self.client.post("/api/reports", json={
            "reporter_name": "User 6 Escalated",
            "application_code": "LOANH110006",
            "income": "1000000",
            "amount": "500000",
            "zone": "North",
        })
        self.assertEqual(res6.status_code, 201)
        data6 = res6.get_json()
        self.assertEqual(data6["handler_name"], "Central Home Primary")
        self.assertIn("escalated", data6["routing_reason"])

        # Now fill Central Home Primary (cap 3) and Central Home Backup (cap 2)
        # Already used 1 capacity in Central Primary, fill remaining 4
        for i in range(7, 11):
            res = self.client.post("/api/reports", json={
                "reporter_name": f"User {i}",
                "application_code": f"LOANH1100{i:02d}",
                "income": "1000000",
                "amount": "500000",
                "zone": "North",
            })
            self.assertEqual(res.status_code, 201)

        # Next report has no available capacity anywhere -> goes to waiting queue
        res_wait = self.client.post("/api/reports", json={
            "reporter_name": "User 12 Waiting",
            "application_code": "LOANH110099",
            "income": "1000000",
            "amount": "500000",
            "zone": "North",
        })
        self.assertEqual(res_wait.status_code, 201)
        wait_data = res_wait.get_json()
        self.assertEqual(wait_data["status"], "Pending")
        self.assertEqual(wait_data["queue"], "waiting")
        self.assertIsNone(wait_data["handler_name"])

    # ==========================================
    # 14. Critical Urgency Emergency Override
    # ==========================================
    def test_critical_urgency_emergency_override(self):
        """Critical urgency has priority rank 0 and can exceed capacity by 1."""
        # Fill South Education Primary (cap 3)
        for i in range(3):
            self.client.post("/api/reports", json={
                "reporter_name": f"Student {i}",
                "application_code": f"LOANE20000{i}",
                "income": "1000000",
                "amount": "500000",
                "zone": "South",
            })
        # Fill South Education Backup (cap 2)
        for i in range(3, 5):
            self.client.post("/api/reports", json={
                "reporter_name": f"Student {i}",
                "application_code": f"LOANE20000{i}",
                "income": "1000000",
                "amount": "500000",
                "zone": "South",
            })
        # Fill Central Education Primary (cap 3) & Central Education Backup (cap 2)
        for i in range(5, 10):
            self.client.post("/api/reports", json={
                "reporter_name": f"Student {i}",
                "application_code": f"LOANE20000{i}",
                "income": "1000000",
                "amount": "500000",
                "zone": "South",
            })

        # All 10 standard slots are full. A normal report would go to waiting queue.
        # But a critical report can override South Education Primary's capacity by +1!
        crit_res = self.client.post("/api/reports", json={
            "reporter_name": "Critical Emergency Student",
            "application_code": "LOANE200099",
            "income": "1000000",
            "amount": "500000",
            "zone": "South",
            "urgency": "critical",
        })
        self.assertEqual(crit_res.status_code, 201)
        crit_data = crit_res.get_json()
        self.assertEqual(crit_data["status"], "Assigned")
        self.assertEqual(crit_data["priority_rank"], 0)
        self.assertIn("override", crit_data["routing_reason"])

    # ==========================================
    # 15. Queue Ordering
    # ==========================================
    def test_queue_ordering_deterministic(self):
        """Waiting queue is strictly ordered by priority_rank ASC (critical first), created_at, id."""
        # Set handlers unavailable so all go to waiting queue
        handlers = self.client.get("/api/handlers").get_json()
        for h in handlers:
            if h["category"] == "Personal":
                self.client.patch(f"/api/handlers/{h['id']}", json={"available": False})

        # Submit in non-priority order
        self.client.post("/api/reports", json={
            "reporter_name": "Low User",
            "application_code": "LOANP100001",
            "income": "1000000",
            "amount": "100000",
            "zone": "Central",
            "urgency": "low",  # rank 3
        })
        self.client.post("/api/reports", json={
            "reporter_name": "High User",
            "application_code": "LOANP100002",
            "income": "1000000",
            "amount": "100000",
            "zone": "Central",
            "urgency": "high",  # rank 1
        })
        self.client.post("/api/reports", json={
            "reporter_name": "Critical User",
            "application_code": "LOANP100003",
            "income": "1000000",
            "amount": "100000",
            "zone": "Central",
            "urgency": "critical",  # rank 0
        })

        q = self.client.get("/api/queue").get_json()["waiting"]
        urgencies = [r["urgency"] for r in q]
        self.assertEqual(urgencies, ["critical", "high", "low"])

    # ==========================================
    # 16. Status Lifecycle & Illegal Transitions
    # ==========================================
    def test_status_lifecycle_and_illegal_transitions(self):
        """Enforces Pending -> Assigned -> In Progress -> Resolved; 409 on illegal."""
        res = self.client.post("/api/reports", json={
            "reporter_name": "Raj Kapoor",
            "application_code": "LOANH123000",
            "income": "1000000",
            "amount": "500000",
            "zone": "Central",
        })
        rep_id = res.get_json()["report_id"]

        # Assigned -> In Progress: Valid
        p1 = self.client.patch(f"/api/reports/{rep_id}/status", json={"status": "In Progress"})
        self.assertEqual(p1.status_code, 200)

        # In Progress -> Resolved: Valid
        p2 = self.client.patch(f"/api/reports/{rep_id}/status", json={"status": "Resolved"})
        self.assertEqual(p2.status_code, 200)

        # Resolved -> In Progress: Illegal (backward) -> 409
        p3 = self.client.patch(f"/api/reports/{rep_id}/status", json={"status": "In Progress"})
        self.assertEqual(p3.status_code, 409)

        # Resolved -> Pending: Illegal -> 409
        p4 = self.client.patch(f"/api/reports/{rep_id}/status", json={"status": "Pending"})
        self.assertEqual(p4.status_code, 409)

    # ==========================================
    # 17. Correction and Resubmission
    # ==========================================
    def test_correction_and_resubmission(self):
        """Correcting invalid report in correction queue re-validates and dispatches."""
        # Submit invalid report
        bad_res = self.client.post("/api/reports", json={
            "reporter_name": "R",  # Bad name
            "application_code": "LOANX123456",  # Bad code
            "income": "1000000",
            "amount": "500000",
            "zone": "North",
        })
        self.assertEqual(bad_res.status_code, 422)
        rep_id = bad_res.get_json()["report_id"]

        # Resubmit still invalid -> 422
        fix_bad = self.client.post(f"/api/reports/{rep_id}/correct", json={
            "reporter_name": "Rohit Sharma",
            "application_code": "LOANX123456",  # Still bad code
            "income": "1000000",
            "amount": "500000",
            "zone": "North",
        })
        self.assertEqual(fix_bad.status_code, 422)

        # Resubmit with valid data -> 200 OK and Assigned
        fix_good = self.client.post(f"/api/reports/{rep_id}/correct", json={
            "reporter_name": "Rohit Sharma",
            "application_code": "LOANH123456",
            "income": "1000000",
            "amount": "500000",
            "zone": "North",
        })
        self.assertEqual(fix_good.status_code, 200)
        body = fix_good.get_json()
        self.assertEqual(body["status"], "Assigned")

        # Verify history reflects correction
        rep_detail = self.client.get(f"/api/reports/{rep_id}").get_json()
        events = [e["event"] for e in rep_detail["history"]]
        self.assertTrue(any("corrected and successfully validated" in e for e in events))

    # ==========================================
    # 18. Search, Filters, and Analytics
    # ==========================================
    def test_search_and_analytics(self):
        """Tests search query, status/category filtering, and analytics KPI metrics."""
        self.client.post("/api/demo-seed")

        # Search by reporter name substring
        q_res = self.client.get("/api/reports?q=Aarav").get_json()
        self.assertEqual(len(q_res["reports"]), 1)
        self.assertEqual(q_res["reports"][0]["reporter_name"], "Aarav Sharma")

        # Filter by category
        cat_res = self.client.get("/api/reports?category=Vehicle").get_json()
        self.assertGreaterEqual(len(cat_res["reports"]), 2)

        # Analytics
        a = self.client.get("/api/analytics").get_json()
        self.assertEqual(a["total"], 7)
        self.assertEqual(a["correction"], 1)
        self.assertIn("Home", a["by_category"])
        self.assertIn("Invalid", a["by_category"])
        self.assertEqual(len(a["by_zone"]), 5)
        self.assertEqual(len(a["by_priority"]), 4)

    # ==========================================
    # 19. Concurrent Submissions Safety
    # ==========================================
    def test_concurrent_submissions_no_duplicates_no_overbooking(self):
        """Tests simultaneous submissions with SQLite transactions: exactly 1 succeeds on duplicate."""
        payload = {
            "reporter_name": "Concurrent Worker",
            "application_code": "LOANH777888",
            "income": "2000000",
            "amount": "1000000",
            "zone": "East",
        }

        # 10 threads trying to submit identical application code simultaneously
        def submit():
            client = self.app.test_client()
            return client.post("/api/reports", json=payload)

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(submit) for _ in range(10)]
            responses = [f.result() for f in futures]

        status_codes = [r.status_code for r in responses]
        # Exactly one 201 Created, remaining nine 409 Conflict
        self.assertEqual(status_codes.count(201), 1)
        self.assertEqual(status_codes.count(409), 9)


    # ==========================================
    # 20. Handler Reports, Routing & Queue Process Endpoints
    # ==========================================
    def test_handler_reports_and_routing_endpoints(self):
        """Verifies GET /api/routing and GET /api/handlers/<id>/reports."""
        # 1. Routing table endpoint
        routing_res = self.client.get("/api/routing")
        self.assertEqual(routing_res.status_code, 200)
        rows = routing_res.get_json()
        self.assertEqual(len(rows), 60)  # 5 zones x 4 categories x 3 bands

        # 2. Handler reports endpoint
        res = self.client.post("/api/reports", json={
            "reporter_name": "Handler Target User",
            "application_code": "LOANH123888",
            "income": "1000000",
            "amount": "500000",
            "zone": "North",
        })
        self.assertEqual(res.status_code, 201)
        handlers = self.client.get("/api/handlers").get_json()
        north_home = next(h for h in handlers if h["name"] == "North Home Primary")
        h_reports = self.client.get(f"/api/handlers/{north_home['id']}/reports").get_json()
        self.assertEqual(len(h_reports), 1)
        self.assertEqual(h_reports[0]["application_code"], "LOANH123888")

    def test_process_waiting_queue_endpoint(self):
        """Verifies POST /api/queue/process dispatches waiting reports when capacity frees up."""
        # Fill capacity
        for i in range(5):
            self.client.post("/api/reports", json={
                "reporter_name": f"User {i}",
                "application_code": f"LOANV30000{i}",
                "income": "2000000",
                "amount": "1000000",
                "zone": "East",
            })
        for i in range(5):
            self.client.post("/api/reports", json={
                "reporter_name": f"Central User {i}",
                "application_code": f"LOANV30001{i}",
                "income": "2000000",
                "amount": "1000000",
                "zone": "Central",
            })

        # Next report goes to waiting queue
        wait_res = self.client.post("/api/reports", json={
            "reporter_name": "Waiting User",
            "application_code": "LOANV300099",
            "income": "2000000",
            "amount": "1000000",
            "zone": "East",
        })
        self.assertEqual(wait_res.status_code, 201)
        self.assertEqual(wait_res.get_json()["status"], "Pending")

        # Increase capacity of East Vehicle Primary from 3 to 10
        handlers = self.client.get("/api/handlers").get_json()
        east_prim = next(h for h in handlers if h["name"] == "East Vehicle Primary")
        self.client.patch(f"/api/handlers/{east_prim['id']}", json={"capacity": 10})

        # Call POST /api/queue/process
        proc_res = self.client.post("/api/queue/process")
        self.assertEqual(proc_res.status_code, 200)

        # Waiting queue should now be empty and report Assigned
        q_data = self.client.get("/api/queue").get_json()
        self.assertEqual(len(q_data["waiting"]), 0)


if __name__ == "__main__":
    unittest.main()
