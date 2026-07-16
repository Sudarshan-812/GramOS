import os

from google import genai
from google.genai import types

from models import RiskAssessmentRequest, RiskAssessmentResponse

MODEL_NAME = "gemini-2.5-flash"

SYSTEM_PROMPT = """You are a senior agricultural credit risk analyst at a rural development \
finance institution. You specialize in underwriting micro-enterprises (dairy cooperatives, \
agri-input retailers, small traders, artisans) that operate in climate-exposed rural economies.

Your job is to produce a rigorous, institutional-grade Non-Performing Asset (NPA) risk \
assessment by fusing two data sources for each enterprise:

1. FINANCIAL SIGNALS: revenue, transaction velocity (UPI), ticket size, and days past due on \
   existing obligations. These tell you the enterprise's current cash flow health and repayment \
   discipline.
2. CLIMATE SIGNALS: NDVI (vegetation health), soil moisture, rainfall deviation from historical \
   average, and an AlphaEarth satellite embedding vector. These tell you whether the physical \
   environment underpinning the enterprise's revenue (crop yield, fodder availability, water \
   access) is deteriorating.

Critical instruction: do not treat financial and climate data as independent signals. Reason \
about how climate volatility DIRECTLY threatens THIS SPECIFIC business type's cash flow. For \
example: a dairy cooperative depends on fodder and water availability, so negative rainfall \
deviation or falling soil moisture directly predicts a future drop in milk yield and revenue, \
even if repayment behavior looks fine today. An agri-input retailer's sales depend on farmers \
having a good season, so poor NDVI upstream predicts a future collapse in retailer demand. \
Weight climate deterioration heavily when it has a plausible causal path to this business's \
revenue, even if current days_past_due is 0 — you are underwriting FORWARD risk, not just \
describing the past.

Score risk_score from 0 (negligible risk) to 100 (near-certain default). Use risk_classification \
bands: LOW (0-24), MEDIUM (25-49), HIGH (50-74), CRITICAL (75-100).

Return ONLY the structured JSON response matching the required schema. Do not wrap it in \
markdown, code fences, or add any conversational text."""


def _build_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to backend/.env (see .env.example)."
        )
    return genai.Client(api_key=api_key)


def _build_user_payload(request: RiskAssessmentRequest) -> str:
    f = request.financials
    c = request.climate
    return f"""Assess the following rural micro-enterprise for NPA risk.

ENTERPRISE: {request.enterprise_name}
BUSINESS TYPE: {f.business_type}

FINANCIAL PROFILE:
- Monthly revenue: INR {f.monthly_revenue_inr:,.2f}
- UPI transaction count (30d): {f.upi_transaction_count}
- Average ticket size: INR {f.avg_ticket_size_inr:,.2f}
- Days past due on current obligations: {f.days_past_due}

CLIMATE PROFILE (AlphaEarth-derived):
- NDVI index (vegetation health, 0-1): {c.ndvi_index:.3f}
- Soil moisture: {c.soil_moisture_percentage:.1f}%
- Rainfall deviation from historical average: {c.rainfall_deviation_pct:+.1f}%
- AlphaEarth embedding (first 8 of 64 dims): {c.alpha_earth_embeddings[:8]}

Produce the full structured risk assessment now."""


async def analyze_enterprise_risk(request: RiskAssessmentRequest) -> RiskAssessmentResponse:
    client = _build_client()

    response = await client.aio.models.generate_content(
        model=MODEL_NAME,
        contents=_build_user_payload(request),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=RiskAssessmentResponse,
            temperature=0.2,
        ),
    )

    parsed = response.parsed
    if isinstance(parsed, RiskAssessmentResponse):
        return parsed
    if parsed is not None:
        return RiskAssessmentResponse.model_validate(parsed)

    return RiskAssessmentResponse.model_validate_json(response.text)
