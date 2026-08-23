"""One-off preview: run the risk engine with a REAL buyer_payment_risk signal and REAL
wris_climate data so both can be eyeballed together. buyer_payment below is the Athani-taluk
rollup (Ugar Sugars Ltd + 3 other Athani-taluk mills) from the Karnataka RTI response
received 2026-08-23 (registration SECCI/R/2026/60049; see
backend/scripts/parse_rti_cane_arrears.py and Ref_data/rti_cane_arrears_processed.json).
wris_climate is real India-WRIS data for Belagavi, June 2025 (see
backend/scripts/fetch_wris_climate_data.py). Not imported by the live app.
Run from backend/: python scripts/preview_buyer_payment_risk.py

Each run costs 5 Gemini calls (climate, financial, buyer-payment, wris-climate, synthesis)
against the free-tier's 20/day quota - don't run this repeatedly while testing something
else, it'll exhaust the day's budget fast (this has already happened once in this project).
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from engine import risk_graph
from models import (
    BuyerPaymentProfile,
    ClimateProfile,
    FinancialProfile,
    RiskAssessmentRequest,
    WrisClimateSnapshot,
)

MOCK_REQUEST = RiskAssessmentRequest(
    enterprise_name="Satti Cane Growers Cooperative (Athani)",
    financials=FinancialProfile(
        business_type="Sugarcane Grower Cooperative",
        monthly_revenue_inr=240000,
        upi_transaction_count=140,
        avg_ticket_size_inr=8500,
        days_past_due=12,
        kcc_utilization_pct=68.0,
    ),
    climate=ClimateProfile(
        ndvi_index=0.62,
        soil_moisture_percentage=38.0,
        rainfall_deviation_pct=-6.0,
        alpha_earth_embeddings=[0.0] * 64,
    ),
    buyer_payment=BuyerPaymentProfile(
        taluk="Athani",
        mill_name=(
            "UGAR SUGARS LTD., UGARKHURD, ATHANI TALUK. BELAGAVI DISTRICT [+3 other mill(s) "
            "in taluk] [REAL DATA: Karnataka RTI response, registration SECCI/R/2026/60049]"
        ),
        weighted_exposure_cr=19.83,
        stress_flag="HIGH",
        confidence="High",
    ),
    wris_climate=WrisClimateSnapshot(
        district="Belagavi",
        period_start="2025-06-01",
        period_end="2025-06-30",
        rainfall_mm_total=240.7,
        rainfall_station_count=3,
        groundwater_avg_level_m=-9.2,
        groundwater_station_count=17,
        soil_moisture_avg_pct=None,
    ),
)


async def main():
    result = await risk_graph.ainvoke({"request": MOCK_REQUEST})
    assessment = result["final_assessment"]
    print(json.dumps(assessment.model_dump(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
