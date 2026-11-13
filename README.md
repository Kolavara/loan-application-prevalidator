# Loan Application Pre-Validator — Backend

A deterministic, rule-based backend for pre-validating and dispatching loan applications, built with **Python 3**, **Flask**, and the **Python standard library SQLite (`sqlite3`)** without any ORM.

---

## 1. How to Run

### Prerequisites
- Python 3.10+
- `pip`

### Backend Installation & Startup
```bash
# 1. Install dependencies
pip install flask flask-cors

# 2. Run the test suite (all 21 tests)
python -m unittest test_loan.py -v

# 3. Start the REST API server (runs at http://127.0.0.1:5000)
python app.py
```

### Frontend Integration
The companion React + TypeScript frontend is located in `./loan-prevalidator`.
```bash
cd loan-prevalidator
npm install
npm run dev
```
The Vite development server runs at `http://localhost:5173` and proxies `/api` to `http://127.0.0.1:5000`. Direct cross-origin requests are also enabled via `flask-cors`.

---

## 2. DFA Transition Table

The application code validator strictly enforces the format:
$$\text{LOAN} + \{\text{H}, \text{V}, \text{P}, \text{E}\} + [0-9]^6$$
Example: `LOANH123456`.

### Formal DFA Definition
- **Alphabet ($\Sigma$)**: ASCII characters: `'L'`, `'O'`, `'A'`, `'N'`, type letters `'H'`, `'V'`, `'P'`, `'E'`, numeric digits `'0'` through `'9'`, and any other character $\sigma \notin \Sigma$ which transitions directly to `DEAD`.
- **States ($Q$)**: $\{q_0, q_1, q_2, q_3, q_4, q_5, q_6, q_7, q_8, q_9, q_{10}, q_{11}, \text{DEAD}\}$.
- **Initial State ($q_0$)**: $q_0$.
- **Accepting States ($F$)**: $\{q_{11}\}$ (only $q_{11}$ is accepting).
- **Trap State ($\text{DEAD}$)**: Once entered, any input symbol stays in `DEAD`.

### State Transition Table

| Current State | Input Symbol | Next State | Description / Rule |
| :--- | :--- | :--- | :--- |
| **$q_0$** | `'L'` | $q_1$ | Starts prefix match |
| $q_0$ | Any $\neq$ `'L'` | `DEAD` | Prefix error at position 1 |
| **$q_1$** | `'O'` | $q_2$ | Consuming 'O' |
| $q_1$ | Any $\neq$ `'O'` | `DEAD` | Prefix error at position 2 |
| **$q_2$** | `'A'` | $q_3$ | Consuming 'A' |
| $q_2$ | Any $\neq$ `'A'` | `DEAD` | Prefix error at position 3 |
| **$q_3$** | `'N'` | $q_4$ | Consuming 'N' |
| $q_3$ | Any $\neq$ `'N'` | `DEAD` | Prefix error at position 4 |
| **$q_4$** | `'H'`, `'V'`, `'P'`, `'E'` | $q_5$ | Valid loan type letter |
| $q_4$ | Any $\notin \{H,V,P,E\}$ | `DEAD` | Unsupported loan type letter |
| **$q_5$** | `'0'`–`'9'` | $q_6$ | Digit 1 of 6 |
| $q_5$ | Any non-digit | `DEAD` | Non-numeric digit at pos 6 |
| **$q_6$** | `'0'`–`'9'` | $q_7$ | Digit 2 of 6 |
| $q_6$ | Any non-digit | `DEAD` | Non-numeric digit at pos 7 |
| **$q_7$** | `'0'`–`'9'` | $q_8$ | Digit 3 of 6 |
| $q_7$ | Any non-digit | `DEAD` | Non-numeric digit at pos 8 |
| **$q_8$** | `'0'`–`'9'` | $q_9$ | Digit 4 of 6 |
| $q_8$ | Any non-digit | `DEAD` | Non-numeric digit at pos 9 |
| **$q_9$** | `'0'`–`'9'` | $q_{10}$ | Digit 5 of 6 |
| $q_9$ | Any non-digit | `DEAD` | Non-numeric digit at pos 10 |
| **$q_{10}$** | `'0'`–`'9'` | **$q_{11}$ (Accept)** | Digit 6 of 6 (Exact length 11) |
| $q_{10}$ | Any non-digit | `DEAD` | Non-numeric digit at pos 11 |
| **$q_{11}$** | Any character | `DEAD` | Code too long (> 11 characters) |
| **`DEAD`** | Any character | `DEAD` | Trap state |

### Dual Check & Diagnostics
1. **DFA & Regex Equivalence**: Every code is checked by both `run_dfa(s)` and `re.fullmatch(r"LOAN[HVPE][0-9]{6}", s)`. A property-based unit test verifies exact agreement across 3,000+ generated strings.
2. **`explain(s)`**: Pinpoints the exact index and symbol where the DFA fails, distinguishing:
   - Empty input string
   - Wrong prefix character at positions 1–4
   - Unsupported type letter at position 5
   - Non-digit character in positions 6–11
   - Premature termination (too short)
   - Trailing characters (too long)

---

## 3. Routing Table Design

### 60 Combinations Seed
The routing table is seeded with all $5 \times 4 \times 3 = 60$ combinations:
- **Zones (5)**: `North`, `South`, `East`, `West`, `Central`
- **Categories (4)**: `Home`, `Vehicle`, `Personal`, `Education`
- **Amount Bands (3)**:
  - **Standard** ($\le \text{₹}10,00,000$): Requires **Authority 1**
  - **Senior** ($\le \text{₹}50,00,000$): Requires **Authority 2**
  - **Executive** ($> \text{₹}50,00,000$): Requires **Authority 3**

### Branch, Team, & Depot Schema
- **Branch**: `<Category> Loans Branch` (e.g., `Home Loans Branch`)
- **Team**: `<Zone> <Category> Team` (e.g., `North Home Team`)
- **Depot**: `<Zone>-<CAT>-DEPOT` (e.g., `North-HOM-DEPOT`)

### Handler Architecture
There are 40 handlers seeded:
- Per zone and category:
  - **Primary Handler**: Authority 2, Capacity 3, Role `Primary`
  - **Backup Handler**: Authority 3, Capacity 2, Role `Backup`
- **Central Zone Handlers**: Act as the escalation path for regional handlers.
- **Active Load**: Calculated dynamically as $\text{count}(\text{reports in 'Assigned' or 'In Progress'})$.

---

## 4. Dispatch Algorithm Steps (`try_dispatch`)

1. **Extract Routing Key**:
   - Built strictly from validated report parameters: `"zone_used|category|band"`.
   - Any unknown, non-empty zone falls back to `Central` and is logged as `zone_fallback`.
2. **Lookup Routing Table**:
   - Queries `routing` table by `(zone, category, band)` to determine Branch, Team, Depot, and `required_authority`.
3. **Scan Candidate Handlers**:
   - Evaluated in strict deterministic order:
     1. `Zone Primary`
     2. `Zone Backup`
     3. `Central Primary` (Escalation)
     4. `Central Backup` (Escalation)
     *(If the zone is already `Central`, candidates are Central Primary then Central Backup).*
4. **Evaluate Handler Eligibility**:
   - **Authority Check**: `handler.authority >= required_authority`. Primary handlers (Authority 2) are skipped for Executive loans (Authority 3).
   - **Availability Check**: `handler.available == 1`.
   - **Capacity Check**:
     - Standard: `current_load < handler.capacity`.
     - **Critical Urgency Override**: Critical reports (Priority Rank 0) may exceed capacity by 1 (`current_load < handler.capacity + 1`).
5. **Assign or Enqueue**:
   - **Eligible candidate found**: Assigned to handler, `status = 'Assigned'`, `queue = None`. Flagged as `escalated` if handled by Central for a regional zone, and `priority_override` if emergency capacity was utilized.
   - **No candidate eligible**: Placed in waiting queue, `status = 'Pending'`, `queue = 'waiting'`.
6. **Audit Trail & State Lifecycle**:
   - Decision details and all skipped candidate reasons are recorded in `routing_reason` and logged to the `events` history table.
   - Forward-only lifecycle: `Pending` $\to$ `Assigned` $\to$ `In Progress` $\to$ `Resolved`. Illegal status transitions return HTTP 409.
   - When a report is `Resolved`, or when a handler's availability/capacity is updated, `process_waiting_queue()` automatically re-evaluates waiting reports in deterministic order (`priority_rank ASC`, `created_at ASC`, `id ASC`).
   - SQLite `BEGIN IMMEDIATE` transactions and a global lock prevent race conditions and overbooking.

---

## 5. API Endpoint Specifications

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/validate` | Validates fields without storing. Returns validity, errors, band, category, and zone fallback. | 200 |
| `POST` | `/api/reports` | Submits a report. Dispatches or places in waiting/correction queue. | 201 (dispatched/waiting), 422 (invalid, stored), 409 (duplicate valid code), 400 (non-JSON) |
| `GET` | `/api/reports` | Lists reports with optional `q`, `status`, and `category` filters, plus total status counts. | 200 |
| `GET` | `/api/reports/<id>` | Retrieves report details along with event history timeline. | 200, 404 |
| `POST` | `/api/reports/<id>/correct` | Resubmits corrected details for an invalid report in the correction queue. | 200 (valid & dispatched), 422 (still invalid), 409 (duplicate) |
| `PATCH` | `/api/reports/<id>/status` | Transitions status (`In Progress`, `Resolved`). Forward-only lifecycle. | 200, 409 (illegal transition), 400 |
| `GET` | `/api/handlers` | Lists all 40 handlers with active workload (`load`) and availability. | 200 |
| `PATCH` | `/api/handlers/<id>` | Updates handler availability or capacity (0–50). Re-runs waiting queue. | 200, 400, 404 |
| `GET` | `/api/handlers/<id>/reports` | Lists all reports currently assigned to the specified handler. | 200 |
| `GET` | `/api/routing` | Returns all 60 routing table rows. | 200 |
| `GET` | `/api/queue` | Returns `waiting`, `correction`, `escalations`, and `overrides` queues. | 200 |
| `POST` | `/api/queue/process` | Processes the waiting queue deterministically. | 200 |
| `GET` | `/api/analytics` | Returns aggregated metrics across zones, categories, statuses, priorities, and queues. | 200 |
| `POST` | `/api/demo-seed` | Seeds 7 sample reports covering all categories, unknown zone, critical override, and malformed code. | 200 |

---

## 6. Test Suite (`test_loan.py`)

All 21 tests execute in clean temporary SQLite database files per test:

1. `test_dfa_and_regex_agreement_thousands_of_strings`: Validates DFA and regex agreement across 3,000+ random and mutated strings.
2. `test_valid_and_invalid_application_code_formats`: Checks standard valid and varied invalid code formats.
3. `test_meaningful_explain_rejection_messages`: Verifies specific, actionable diagnostics in `explain(s)` for each error position.
4. `test_all_five_categories`: Tests classification into `Home`, `Vehicle`, `Personal`, `Education`, and `Invalid`.
5. `test_conflicting_patterns_and_deterministic_tiebreaking`: Confirms identifier wins over description keywords, and keyword ties break Home > Vehicle > Education > Personal.
6. `test_field_validation_never_raises_on_junk_input`: Confirms malformed or junk payloads never trigger unhandled exceptions.
7. `test_amount_ceiling_and_income_multiples`: Enforces ceilings and income multiples per category (Home 10x/1Cr, Vehicle 5x/2Cr, Personal 3x/50L, Education 6x/1Cr).
8. `test_invalid_report_stored_in_correction_queue`: Confirms HTTP 422 response and correction queue storage for invalid reports.
9. `test_unknown_zone_fallback_to_central`: Confirms fallback to Central routing when an unrecognized zone is supplied.
10. `test_duplicate_valid_application_code_rejected`: Confirms HTTP 409 conflict and returns `existing_report_id` for duplicate valid codes.
11. `test_executive_band_authority_dispatch`: Confirms Executive loans (> 50L) skip Authority 2 Primary handlers and route directly to Authority 3 Backup handlers.
12. `test_unavailable_handler_falls_back_to_backup`: Verifies that marking a handler unavailable routes the application to the backup handler.
13. `test_capacity_overflow_escalation_and_waiting_queue`: Demonstrates escalation to Central handlers when local handlers are at capacity, and placement in the waiting queue when all slots are full.
14. `test_critical_urgency_emergency_override`: Confirms critical urgency reports (priority rank 0) jump the queue and exceed handler capacity by 1.
15. `test_queue_ordering_deterministic`: Proves waiting queue ordering strictly respects priority rank (`critical` $\to$ `high` $\to$ `normal` $\to$ `low`).
16. `test_status_lifecycle_and_illegal_transitions`: Enforces forward-only transitions (`Pending` $\to$ `Assigned` $\to$ `In Progress` $\to$ `Resolved`) and rejects illegal or backward transitions with HTTP 409.
17. `test_correction_and_resubmission`: Verifies correcting an invalid report transitions it out of the correction queue and into active dispatch.
18. `test_search_and_analytics`: Verifies substring search, category filtering, and KPI metric aggregations.
19. `test_concurrent_submissions_no_duplicates_no_overbooking`: Tests concurrent worker threads submitting identical codes; exactly 1 succeeds (201) while others receive 409 with zero deadlocks.
20. `test_handler_reports_and_routing_endpoints`: Tests `GET /api/routing` (60 rows) and `GET /api/handlers/<id>/reports`.
21. `test_process_waiting_queue_endpoint`: Tests `POST /api/queue/process` re-dispatching waiting reports when handler capacity is expanded.

