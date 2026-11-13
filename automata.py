"""Loan Application Pre-Validator - Automata and Field Validation Module.

PART A:
- Table-driven DFA (q0..q11, DEAD) for LOAN[HVPE][0-9]{6}.
- Dual check with re.fullmatch.
- explain(s) for actionable rejection diagnostics.
- Category classification (Home, Vehicle, Personal, Education, Invalid) with keyword scanning.
- Deterministic conflict resolution: Identifier wins, keyword ties by Home > Vehicle > Education > Personal.
- Comprehensive field validation with per-category limits and income multiples.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

# Valid prefix and categories
VALID_TYPE_LETTERS = {"H": "Home", "V": "Vehicle", "P": "Personal", "E": "Education"}
ZONES = ["North", "South", "East", "West", "Central"]
URGENCIES = ["low", "normal", "high", "critical"]
URGENCY_PRIORITY = {"critical": 0, "high": 1, "normal": 2, "low": 3}

# Per-category ceilings and income multiples
# 1 Lakh = 100,000; 1 Crore = 10,000,000
CATEGORY_RULES = {
    "Home": {"multiple": 10.0, "ceiling": 10_000_000.0},  # 10x income, max 1 crore
    "Vehicle": {"multiple": 5.0, "ceiling": 20_000_000.0},  # 5x income, max 2 crore
    "Personal": {"multiple": 3.0, "ceiling": 5_000_000.0},  # 3x income, max 50 lakh
    "Education": {"multiple": 6.0, "ceiling": 10_000_000.0},  # 6x income, max 1 crore
}

# Regex for application code: ASCII digits only, exactly 6 digits
CODE_REGEX = re.compile(r"LOAN[HVPE][0-9]{6}")

# DFA Transition Table
# States: q0 through q11, and DEAD
DFA_TRANSITIONS: Dict[str, Dict[str, str]] = {
    "q0": {"L": "q1"},
    "q1": {"O": "q2"},
    "q2": {"A": "q3"},
    "q3": {"N": "q4"},
    "q4": {"H": "q5", "V": "q5", "P": "q5", "E": "q5"},
    "q5": {str(d): "q6" for d in range(10)},
    "q6": {str(d): "q7" for d in range(10)},
    "q7": {str(d): "q8" for d in range(10)},
    "q8": {str(d): "q9" for d in range(10)},
    "q9": {str(d): "q10" for d in range(10)},
    "q10": {str(d): "q11" for d in range(10)},
    "q11": {},  # Any character after q11 goes to DEAD
    "DEAD": {},  # Trap state
}


def run_dfa(s: Any) -> Tuple[bool, List[str]]:
    """Runs the table-driven DFA on input s.

    Returns:
        (accepted, state_trace) where accepted is True iff final state is q11.
    """
    if not isinstance(s, str):
        return False, ["q0", "DEAD"]

    current_state = "q0"
    trace = [current_state]

    for char in s:
        if current_state == "DEAD":
            trace.append("DEAD")
            continue
        next_state = DFA_TRANSITIONS.get(current_state, {}).get(char, "DEAD")
        current_state = next_state
        trace.append(current_state)

    accepted = current_state == "q11"
    return accepted, trace


def explain(s: Any) -> str:
    """Provides a meaningful diagnostic message explaining why s is rejected by the DFA."""
    if not isinstance(s, str):
        return "Application code must be a string."
    if len(s) == 0:
        return "Empty application code: expected LOAN + type (H/V/P/E) + 6 digits."

    # Trace step by step to locate the failure point
    current_state = "q0"
    for idx, char in enumerate(s):
        if current_state == "q0":
            if char != "L":
                return f"Invalid prefix character at position 1: expected 'L', found '{char}'."
            current_state = "q1"
        elif current_state == "q1":
            if char != "O":
                return f"Invalid prefix character at position 2: expected 'O', found '{char}'."
            current_state = "q2"
        elif current_state == "q2":
            if char != "A":
                return f"Invalid prefix character at position 3: expected 'A', found '{char}'."
            current_state = "q3"
        elif current_state == "q3":
            if char != "N":
                return f"Invalid prefix character at position 4: expected 'N', found '{char}'."
            current_state = "q4"
        elif current_state == "q4":
            if char not in VALID_TYPE_LETTERS:
                return (
                    f"Unsupported loan type letter '{char}' at position 5: "
                    f"expected one of {', '.join(sorted(VALID_TYPE_LETTERS.keys()))}."
                )
            current_state = "q5"
        elif current_state in {"q5", "q6", "q7", "q8", "q9", "q10"}:
            if char not in "0123456789":
                return f"Expected numeric digit at position {idx + 1}, found '{char}'."
            digit_step = int(current_state[1:]) + 1
            current_state = f"q{digit_step}"
        elif current_state == "q11":
            return f"Application code too long: expected exactly 11 characters, found {len(s)}."

    if current_state != "q11":
        return f"Application code too short: expected 11 characters, found {len(s)}."

    return "Valid application code."


def validate_code_dual(s: Any) -> Tuple[bool, str]:
    """Validates application code using both the DFA and fullmatch regex.

    Enforces that DFA and regex results agree.
    Returns (is_valid, error_reason).
    """
    if not isinstance(s, str):
        return False, explain(s)

    # Regex validation: fullmatch, ASCII digits
    regex_match = bool(CODE_REGEX.fullmatch(s))
    # DFA validation
    dfa_valid, _ = run_dfa(s)

    if regex_match != dfa_valid:
        raise AssertionError(
            f"DFA ({dfa_valid}) and Regex ({regex_match}) validation mismatch on {s!r}"
        )

    if dfa_valid:
        return True, ""
    return False, explain(s)


# Description keyword patterns
KEYWORD_PATTERNS = {
    "Home": re.compile(
        r"\b(home|house|housing|mortgage|apartment|flat|property|land|renovation|construction|villa|residential|realty|real estate)\b",
        re.IGNORECASE,
    ),
    "Vehicle": re.compile(
        r"\b(vehicle|car|auto|automobile|bike|motorcycle|scooter|truck|suv|sedan|ev|wheels|electric vehicle)\b",
        re.IGNORECASE,
    ),
    "Education": re.compile(
        r"\b(education|student|tuition|college|university|school|degree|semester|course|studies|academic|scholarship|master|bachelor|phd|mba)\b",
        re.IGNORECASE,
    ),
    "Personal": re.compile(
        r"\b(personal|wedding|marriage|vacation|holiday|travel|medical|hospital|emergency|debt|consolidation|consumer|shopping|family)\b",
        re.IGNORECASE,
    ),
}

# Tie-break priority for keywords: Home > Vehicle > Education > Personal
KEYWORD_PRIORITY = ["Home", "Vehicle", "Education", "Personal"]


def scan_description_keywords(description: Optional[str]) -> Optional[str]:
    """Scans description text for category keywords.

    Ties are deterministically broken in order: Home > Vehicle > Education > Personal.
    """
    if not description or not isinstance(description, str):
        return None

    for cat in KEYWORD_PRIORITY:
        if KEYWORD_PATTERNS[cat].search(description):
            return cat
    return None


def classify_category(
    code: Any, description: Optional[str]
) -> Tuple[str, Optional[str]]:
    """Classifies application into: Home | Vehicle | Personal | Education | Invalid.

    Identifier wins over keyword match. Ties among keywords resolved by Home > Vehicle > Education > Personal.
    Returns (category, class_note).
    """
    is_valid_code, _ = validate_code_dual(code)
    if not is_valid_code:
        return "Invalid", f"Invalid application code: {explain(code)}"

    type_letter = code[4]
    identifier_cat = VALID_TYPE_LETTERS[type_letter]
    kw_cat = scan_description_keywords(description)

    if kw_cat and kw_cat != identifier_cat:
        note = (
            f"Conflict resolved: identifier specifies '{identifier_cat}', "
            f"while description keywords suggest '{kw_cat}'. Identifier prevails."
        )
        return identifier_cat, note

    if kw_cat:
        note = f"Identifier and description agree on category '{identifier_cat}'."
    else:
        note = f"Classified by identifier as '{identifier_cat}'."

    return identifier_cat, note


def calculate_band(amount: float) -> str:
    """Calculates amount band:

    - Standard: <= 10,00,000 (authority 1)
    - Senior: <= 50,00,000 (authority 2)
    - Executive: > 50,00,000 (authority 3)
    """
    if amount <= 1_000_000.0:
        return "Standard"
    elif amount <= 5_000_000.0:
        return "Senior"
    return "Executive"


def validate_report_fields(data: Any) -> Dict[str, Any]:
    """Performs full validation of incoming report submission.

    Never raises on junk input.
    Returns structured validation result:
    {
      "valid": bool,
      "errors": dict,
      "category": str,
      "class_note": str | None,
      "band": str | None,
      "zone_used": str,
      "zone_fallback": str | None,
      "priority_rank": int,
      "cleaned": dict
    }
    """
    errors: Dict[str, str] = {}
    cleaned: Dict[str, Any] = {}

    if not isinstance(data, dict):
        return {
            "valid": False,
            "errors": {"_global": "Invalid payload format: expected JSON object."},
            "category": "Invalid",
            "class_note": "Malformed payload",
            "band": None,
            "zone_used": "Central",
            "zone_fallback": "Fallback to Central due to invalid payload",
            "priority_rank": 2,
            "cleaned": {},
        }

    # 1. Reporter name (2-80 chars)
    raw_name = data.get("reporter_name")
    if not isinstance(raw_name, str) or not (2 <= len(raw_name.strip()) <= 80):
        errors["reporter_name"] = "Reporter name must be between 2 and 80 characters."
    else:
        cleaned["reporter_name"] = raw_name.strip()

    # 2. Contact (optional string, but clean if present)
    raw_contact = data.get("contact", "")
    cleaned["contact"] = str(raw_contact).strip() if raw_contact is not None else ""

    # 3. Description (max 500 chars)
    raw_desc = data.get("description", "")
    if raw_desc is None:
        raw_desc = ""
    if not isinstance(raw_desc, str):
        errors["description"] = "Description must be a string."
    elif len(raw_desc) > 500:
        errors["description"] = f"Description exceeds maximum 500 characters (found {len(raw_desc)})."
    else:
        cleaned["description"] = raw_desc

    # 4. Urgency in low|normal|high|critical (default normal)
    raw_urgency = data.get("urgency", "normal")
    if raw_urgency is None or str(raw_urgency).strip() == "":
        raw_urgency = "normal"
    raw_urgency = str(raw_urgency).strip().lower()
    if raw_urgency not in URGENCIES:
        errors["urgency"] = f"Urgency must be one of {', '.join(URGENCIES)}."
        urgency = "normal"
    else:
        urgency = raw_urgency
    cleaned["urgency"] = urgency
    priority_rank = URGENCY_PRIORITY.get(urgency, 2)

    # 5. Zone (required, fallback to Central if unknown)
    raw_zone = data.get("zone")
    zone_fallback: Optional[str] = None
    zone_used = "Central"

    if raw_zone is None or not str(raw_zone).strip():
        errors["zone"] = "Zone is required."
    else:
        zone_str = str(raw_zone).strip()
        cleaned["zone"] = zone_str
        # Check standard zones
        matched_zone = None
        for z in ZONES:
            if z.lower() == zone_str.lower():
                matched_zone = z
                break
        if matched_zone:
            zone_used = matched_zone
        else:
            zone_used = "Central"
            zone_fallback = f"Unknown zone '{zone_str}', falling back to Central."
    cleaned["zone_used"] = zone_used
    cleaned["zone_fallback"] = zone_fallback

    # 6. Application Code validation & Category classification
    raw_code = data.get("application_code")
    cleaned["application_code"] = str(raw_code).strip() if raw_code is not None else ""
    code_valid, code_err = validate_code_dual(cleaned["application_code"])
    if not code_valid:
        errors["application_code"] = code_err

    category, class_note = classify_category(
        cleaned["application_code"], cleaned.get("description", "")
    )

    # 7. Income (positive number, digits, optional 2 decimals, no commas/signs/letters)
    raw_income = data.get("income")
    income_val: Optional[float] = None
    if raw_income is None or str(raw_income).strip() == "":
        errors["income"] = "Annual income is required."
    else:
        income_str = str(raw_income).strip()
        if not re.fullmatch(r"[0-9]+(\.[0-9]{1,2})?", income_str):
            errors["income"] = (
                "Annual income must be a plain positive number (digits only, optional up to 2 decimal places)."
            )
        else:
            try:
                income_val = float(income_str)
                if income_val <= 0:
                    errors["income"] = "Annual income must be greater than zero."
                else:
                    cleaned["income"] = income_val
            except ValueError:
                errors["income"] = "Invalid numeric value for annual income."

    # 8. Amount (positive number, digits, optional 2 decimals, no commas/signs/letters)
    raw_amount = data.get("amount")
    amount_val: Optional[float] = None
    band: Optional[str] = None
    if raw_amount is None or str(raw_amount).strip() == "":
        errors["amount"] = "Loan amount is required."
    else:
        amount_str = str(raw_amount).strip()
        if not re.fullmatch(r"[0-9]+(\.[0-9]{1,2})?", amount_str):
            errors["amount"] = (
                "Loan amount must be a plain positive number (digits only, optional up to 2 decimal places)."
            )
        else:
            try:
                amount_val = float(amount_str)
                if amount_val <= 0:
                    errors["amount"] = "Loan amount must be greater than zero."
                else:
                    cleaned["amount"] = amount_val
                    band = calculate_band(amount_val)
            except ValueError:
                errors["amount"] = "Invalid numeric value for loan amount."

    # 9. Ceiling & Income Multiple rules per category
    if amount_val is not None and category in CATEGORY_RULES:
        rule = CATEGORY_RULES[category]
        ceiling = rule["ceiling"]
        multiple = rule["multiple"]

        if amount_val > ceiling:
            errors["amount"] = (
                f"Amount of ₹{amount_val:,.2f} exceeds {category} loan ceiling of ₹{ceiling:,.2f}."
            )

        if income_val is not None and income_val > 0:
            max_allowed_by_income = multiple * income_val
            if amount_val > max_allowed_by_income:
                errors["amount"] = (
                    f"Amount of ₹{amount_val:,.2f} exceeds {multiple:g}x annual income limit "
                    f"of ₹{max_allowed_by_income:,.2f} for {category} loan."
                )

    is_valid = len(errors) == 0
    final_category = category if is_valid else "Invalid"

    return {
        "valid": is_valid,
        "errors": errors,
        "category": final_category,
        "class_note": class_note,
        "band": band,
        "zone_used": zone_used,
        "zone_fallback": zone_fallback,
        "urgency": urgency,
        "priority_rank": priority_rank,
        "cleaned": cleaned,
    }
