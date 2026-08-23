"""Loads the parsed RTI cane-arrears dataset (backend/scripts/parse_rti_cane_arrears.py ->
Ref_data/rti_cane_arrears_processed.json) and defines the single naming convention for the
per-taluk demo enterprises built from it. Shared by main.py (which injects real buyer_payment
- and, for taluks whose district also has real WRIS data, real wris_climate - into requests
at read time) and backend/scripts/seed_profiles.py (which seeds these enterprises' financial/
climate placeholder rows into Supabase), so the two can never name an enterprise differently
and silently fail to connect.

Source: Karnataka RTI response, registration SECCI/R/2026/60049, received 2026-08-23,
covering 2025-26 season sugar mills in Belagavi/Bagalkote/Vijayapura districts.
"""

import json
import os

from models import BuyerPaymentProfile

RTI_EXPOSURE_PATH = os.path.join(os.path.dirname(__file__), "..", "Ref_data", "rti_cane_arrears_processed.json")


def taluk_enterprise_name(taluk: str) -> str:
    return f"{taluk} Cane Growers Cooperative"


def _load_raw() -> dict:
    try:
        with open(RTI_EXPOSURE_PATH, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"metadata": {}, "exposure_by_taluk": {}}


_RAW = _load_raw()


def load_exposure_by_taluk() -> dict[str, BuyerPaymentProfile]:
    """taluk -> real, High-confidence BuyerPaymentProfile."""
    confidence = _RAW["metadata"].get("confidence", "High")
    rti_registration = _RAW["metadata"].get("rti_registration_number", "unknown")

    profiles = {}
    for taluk, data in _RAW["exposure_by_taluk"].items():
        other_mills = data["mill_count"] - 1
        mill_name = data["dominant_mill_name"]
        if other_mills > 0:
            mill_name += f" [+{other_mills} other mill(s) in taluk]"
        mill_name += f" [REAL DATA: Karnataka RTI response, registration {rti_registration}]"

        profiles[taluk] = BuyerPaymentProfile(
            taluk=taluk,
            mill_name=mill_name,
            weighted_exposure_cr=data["weighted_exposure_cr"],
            stress_flag=data["stress_flag"],
            confidence=confidence,
        )
    return profiles


def load_district_by_taluk() -> dict[str, str]:
    """taluk -> district, for mapping a taluk enterprise to its district's real WRIS
    climate snapshot (see main.py's _WRIS_SNAPSHOTS_BY_DISTRICT)."""
    return {taluk: data["district"] for taluk, data in _RAW["exposure_by_taluk"].items()}
