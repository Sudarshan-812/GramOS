"""One-off preview: run the risk engine with a MOCK buyer_payment_risk signal and REAL
wris_climate data so both can be eyeballed together. buyer_payment is still a placeholder
(real Mills/Catchment/Exposure data isn't sourced yet); wris_climate is real India-WRIS
data for Belagavi, June 2025 (see backend/scripts/fetch_wris_climate_data.py). Not
imported by the live app. Run from backend/: python scripts/preview_buyer_payment_risk.py

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
            "Shri Brahmanand Sagar Jaggery Industries (Alagawadi, Raibag taluk - corrected "
            "2026-08-08, supersedes the earlier wrong 'Krishna SSK Ltd' identification) - a "
            "jaggery/gur unit, NOT a Cane-Commissionerate-regulated sugar mill. "
            "[MOCK dues/arrears figures - real numbers not sourced]"
        ),
        weighted_exposure_cr=132.0,
        stress_flag="HIGH",
        confidence="Low",
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
