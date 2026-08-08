"""One-off preview: run the risk engine with a MOCK buyer_payment_risk signal so the
buyer_payment_risk_impact wiring can be eyeballed before real Mills/Catchment/Exposure data
exists. Not imported by the live app. Run from backend/: python scripts/preview_buyer_payment_risk.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from engine import risk_graph
from models import BuyerPaymentProfile, ClimateProfile, FinancialProfile, RiskAssessmentRequest

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
        mill_name="[MOCK - mill unconfirmed, pending village visit] Athani-taluk mill",
        weighted_exposure_cr=132.0,
        stress_flag="HIGH",
        confidence="Low",
    ),
)


async def main():
    result = await risk_graph.ainvoke({"request": MOCK_REQUEST})
    assessment = result["final_assessment"]
    print(json.dumps(assessment.model_dump(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
