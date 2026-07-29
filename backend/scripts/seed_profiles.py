"""The 3 core enterprise profiles used to bootstrap and backfill Supabase.

Moved out of the old backend/mock_data.py when the live API (main.py) was rewired to read
from Supabase instead of in-memory mock data — this module is now seed-tooling only, used by
init_supabase.py and seed_dynamic_data.py, and is not imported anywhere in the live app.
"""

import random

from models import ClimateProfile, FinancialProfile, RiskAssessmentRequest


def _mock_embeddings(seed: int) -> list[float]:
    rng = random.Random(seed)
    return [round(rng.uniform(-1.0, 1.0), 4) for _ in range(64)]


def dairy_cooperative_fodder_shortage() -> RiskAssessmentRequest:
    """A village dairy cooperative mid-way through a regional fodder shortage.

    Repayment history still looks clean (0 days past due), but climate signals
    are deteriorating fast — this is the canonical case for climate-forward
    risk flagging that lagging financial data alone would miss.
    """
    return RiskAssessmentRequest(
        enterprise_name="Bhairavgad Dairy Producers' Cooperative",
        financials=FinancialProfile(
            business_type="Dairy Cooperative",
            monthly_revenue_inr=185_000.0,
            upi_transaction_count=412,
            avg_ticket_size_inr=449.0,
            days_past_due=0,
            kcc_utilization_pct=72.0,
        ),
        climate=ClimateProfile(
            ndvi_index=0.28,
            soil_moisture_percentage=14.5,
            rainfall_deviation_pct=-38.0,
            alpha_earth_embeddings=_mock_embeddings(seed=1),
        ),
    )


def agri_input_retailer_stable_season() -> RiskAssessmentRequest:
    """A healthy agri-input retailer during a normal monsoon season."""
    return RiskAssessmentRequest(
        enterprise_name="Shivshakti Krishi Seva Kendra",
        financials=FinancialProfile(
            business_type="Agri Input Retailer",
            monthly_revenue_inr=610_000.0,
            upi_transaction_count=980,
            avg_ticket_size_inr=1_120.0,
            days_past_due=2,
            kcc_utilization_pct=35.0,
        ),
        climate=ClimateProfile(
            ndvi_index=0.71,
            soil_moisture_percentage=46.2,
            rainfall_deviation_pct=4.5,
            alpha_earth_embeddings=_mock_embeddings(seed=2),
        ),
    )


def handicraft_trader_late_payments() -> RiskAssessmentRequest:
    """A non-agricultural trader already showing repayment stress, climate-neutral."""
    return RiskAssessmentRequest(
        enterprise_name="Meenakshi Handloom Traders",
        financials=FinancialProfile(
            business_type="Handicraft & Textile Trader",
            monthly_revenue_inr=92_000.0,
            upi_transaction_count=156,
            avg_ticket_size_inr=590.0,
            days_past_due=41,
            kcc_utilization_pct=91.0,
        ),
        climate=ClimateProfile(
            ndvi_index=0.55,
            soil_moisture_percentage=33.0,
            rainfall_deviation_pct=-2.0,
            alpha_earth_embeddings=_mock_embeddings(seed=3),
        ),
    )


MOCK_PROFILES = {
    "dairy-cooperative-fodder-shortage": dairy_cooperative_fodder_shortage,
    "agri-input-retailer-stable-season": agri_input_retailer_stable_season,
    "handicraft-trader-late-payments": handicraft_trader_late_payments,
}
