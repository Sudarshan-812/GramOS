"""One real enterprise profile per RTI-covered taluk, used to bootstrap and backfill
Supabase (init_supabase.py, seed_dynamic_data.py). Not imported anywhere in the live app.

These replace the earlier hand-written mock enterprises (a dairy cooperative, an agri-input
retailer, a handloom trader, and a cane cooperative selling to a mock-data jaggery buyer) -
removed 2026-08-23 because they either had no buyer_payment signal at all, or had one with
invented arrears figures. Every enterprise here is instead generated straight from the
Karnataka RTI response on 2025-26 cane arrears (registration SECCI/R/2026/60049; see
rti_data.py and Ref_data/rti_cane_arrears_processed.json), so its buyer_payment_risk (mill
name, weighted_exposure_cr, stress_flag) is 100% real, High-confidence data - injected at
request time by backend/main.py's _get_buyer_payment_profile(), not stored here.

Only buyer_payment is real. GramOS has no real per-enterprise financial ledger or satellite
feed yet, so financials/climate below are still synthetic - deliberately scaled to each
taluk's real stress_flag (HIGH-stress taluks get worse repayment/utilization numbers) so the
demo tells a coherent story, but they are not measurements of any actual business.
"""

import random
import zlib

import rti_data
from models import ClimateProfile, FinancialProfile, RiskAssessmentRequest

# Keyed by stress_flag so each taluk's synthetic financial/climate placeholder is at least
# directionally consistent with its real buyer_payment_risk - a HIGH-arrears taluk's demo
# cooperative looks financially tighter than a fully-paid LOW taluk's.
_FINANCIAL_RANGES_BY_STRESS = {
    "HIGH": {"revenue": (180_000.0, 260_000.0), "dpd": (15, 30), "kcc_pct": (65.0, 85.0)},
    "MEDIUM": {"revenue": (220_000.0, 320_000.0), "dpd": (5, 14), "kcc_pct": (45.0, 65.0)},
    "LOW": {"revenue": (260_000.0, 380_000.0), "dpd": (0, 4), "kcc_pct": (25.0, 45.0)},
}
_CLIMATE_RANGES_BY_STRESS = {
    "HIGH": {"ndvi": (0.45, 0.58), "soil_pct": (28.0, 38.0), "rain_dev_pct": (-15.0, -4.0)},
    "MEDIUM": {"ndvi": (0.55, 0.66), "soil_pct": (35.0, 44.0), "rain_dev_pct": (-6.0, 2.0)},
    "LOW": {"ndvi": (0.62, 0.75), "soil_pct": (40.0, 50.0), "rain_dev_pct": (-2.0, 8.0)},
}


def _seed_for_taluk(taluk: str) -> int:
    # Stable across runs/machines (unlike Python's randomized str hash()), so each taluk's
    # synthetic numbers are reproducible without persisting them anywhere.
    return zlib.crc32(taluk.encode())


def _synthetic_request_for_taluk(taluk: str, stress_flag: str) -> RiskAssessmentRequest:
    rng = random.Random(_seed_for_taluk(taluk))
    fin = _FINANCIAL_RANGES_BY_STRESS[stress_flag]
    clim = _CLIMATE_RANGES_BY_STRESS[stress_flag]

    return RiskAssessmentRequest(
        enterprise_name=rti_data.taluk_enterprise_name(taluk),
        financials=FinancialProfile(
            business_type="Sugarcane Grower Cooperative",
            monthly_revenue_inr=round(rng.uniform(*fin["revenue"]), -3),
            upi_transaction_count=rng.randint(90, 220),
            avg_ticket_size_inr=round(rng.uniform(1_200.0, 2_400.0), 2),
            days_past_due=rng.randint(*fin["dpd"]),
            kcc_utilization_pct=round(rng.uniform(*fin["kcc_pct"]), 1),
        ),
        climate=ClimateProfile(
            ndvi_index=round(rng.uniform(*clim["ndvi"]), 2),
            soil_moisture_percentage=round(rng.uniform(*clim["soil_pct"]), 1),
            rainfall_deviation_pct=round(rng.uniform(*clim["rain_dev_pct"]), 1),
            alpha_earth_embeddings=[round(rng.uniform(-1.0, 1.0), 4) for _ in range(64)],
        ),
        # buyer_payment and wris_climate intentionally omitted - backend/main.py injects
        # both real signals at request time (by taluk and by district respectively), so
        # they're never duplicated here as a second literal copy that could drift out of
        # sync with Ref_data/rti_cane_arrears_processed.json / wris_climate_data.json.
    )


def _build_mock_profiles() -> dict:
    return {
        f"{taluk.lower().replace(' ', '-')}-cane-growers-cooperative": (
            lambda taluk=taluk, stress_flag=profile.stress_flag: _synthetic_request_for_taluk(
                taluk, stress_flag
            )
        )
        for taluk, profile in rti_data.load_exposure_by_taluk().items()
    }


MOCK_PROFILES = _build_mock_profiles()
