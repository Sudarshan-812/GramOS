import json
import os
from typing import TypedDict

from google import genai
from google.genai import types as genai_types
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END

from models import RiskAssessmentRequest, RiskAssessmentResponse


def _text_content(content: str | list) -> str:
    """ChatGoogleGenerativeAI.ainvoke().content is a plain str for some models
    (gemini-2.5-flash) but a list of content blocks for others (gemini-3.1-flash-lite
    returns [{"type": "text", "text": ..., "extras": {"signature": ...}}]) - normalize
    to plain text so it's safe to store directly on a str-typed response field."""
    if isinstance(content, str):
        return content
    parts = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
        elif isinstance(block, str):
            parts.append(block)
    return "".join(parts)

# gemini-2.5-flash's free tier is 20 requests/day - each risk assessment costs 5 calls
# (4 parallel analysis nodes + synthesis), so that's ~4 assessments/day, which the demo
# blew through during testing on 2026-08-08. gemini-3.1-flash-lite gives 500 RPD / 15 RPM
# on the same free tier (vs 20/5) - 25x the daily budget, and it's not the deprecated
# gemini-2.5-flash-lite (that one is also RPD 20 and sunsets Oct 2026 anyway).
MODEL_NAME = "gemini-3.1-flash-lite"

DOCUMENT_EXTRACTION_PROMPT = """You are an expert credit underwriter at a rural development \
finance institution, reviewing a document (bank statement, KCC passbook, invoice, receipt, land \
record, or similar) submitted by a rural micro-enterprise loan applicant.

Carefully read the document and extract every concrete underwriting-relevant data point you can \
find: revenue or income figures, expenses, liabilities (loans, dues, overdrafts), assets (land, \
equipment, livestock, inventory), account balances, and relevant dates.

Return ONLY a JSON object mapping descriptive field names to their extracted values. Do not \
include commentary, markdown, or explanation. If a category has no data in the document, omit it \
rather than guessing."""

CLIMATE_SYSTEM_PROMPT = """You are a climate risk analyst at a rural development finance \
institution. Given NDVI (vegetation health), soil moisture, and rainfall deviation data for a \
rural micro-enterprise, reason about how the physical environment underpinning the enterprise's \
revenue (crop yield, fodder availability, water access) is trending, and how that plausibly \
threatens FUTURE cash flow for this specific business type. Weight deterioration heavily even if \
the enterprise's repayment record currently looks clean; you are assessing forward climate risk. \
Respond with a concise analytical paragraph. Do not invent a risk score or classification."""

FINANCIAL_SYSTEM_PROMPT = """You are a credit analyst at a rural development finance institution. \
Given an enterprise's monthly revenue, UPI transaction velocity, average ticket size, days past \
due, and Kisan Credit Card (KCC) utilization, reason about the enterprise's current cash flow \
health and repayment discipline. Respond with a concise analytical paragraph. Do not invent a \
risk score or classification."""

BUYER_PAYMENT_SYSTEM_PROMPT = """You are a rural credit risk analyst at a rural development \
finance institution, specializing in agricultural buyer/procurer payment behavior. Given a sugar \
mill's cane payment arrears exposure for the taluk an enterprise operates in, reason about how a \
delayed or defaulting buyer (the mill) plausibly threatens this enterprise's FUTURE cash flow — \
even if the enterprise's own repayment record currently looks clean. Mill payment delays \
synchronize a cash-flow shock across an entire grower catchment simultaneously, distinct from and \
often invisible to crop-health/satellite monitoring. Respond with a concise analytical paragraph. \
Do not invent a risk score or classification."""

WRIS_CLIMATE_SYSTEM_PROMPT = """You are a rural credit risk analyst at a rural development \
finance institution. Given REAL ground-observation data (rain gauge readings, groundwater \
borewell depth, and/or soil moisture) sourced from India-WRIS government monitoring stations for \
an enterprise's district, briefly note what this real data corroborates or contradicts about the \
enterprise's forward climate risk, and flag the most physically meaningful signal (e.g. a deep or \
declining groundwater level is a leading indicator of irrigation/drinking-water stress even in a \
normal-rainfall period). Be explicit that this is real station data, not a modeled estimate. \
Respond with a concise analytical paragraph. Do not invent a risk score or classification."""

SYNTHESIS_SYSTEM_PROMPT = """You are a senior agricultural credit risk analyst at a rural \
development finance institution, producing the final institutional-grade Non-Performing Asset \
(NPA) risk assessment for an enterprise.

A deterministic risk score has already been calculated by a separate, auditable math model, as \
required by RBI 2026 Model Risk Management guidelines. You MUST NOT recalculate, override, or \
second-guess this score; copy it exactly into risk_score, and derive risk_classification from it \
using these bands: LOW (0-24), MEDIUM (25-49), HIGH (50-74), CRITICAL (75-100).

Your job is to write the explainable narrative: financial_health_summary, climate_risk_impact, \
buyer_payment_risk_impact, wris_climate_note, and actionable_mitigation_steps, grounded in the \
financial, climate, buyer payment, and real ground-observation analyses you are given below \
(buyer payment and ground-observation analyses may be absent — in that case write the exact \
"No ... data available for this enterprise." placeholder you were given for that field). Focus \
entirely on producing clear, well-reasoned prose and concrete mitigation actions; the numeric \
score is not yours to compute."""


class GraphState(TypedDict):
    request: RiskAssessmentRequest
    climate_analysis: str
    financial_analysis: str
    buyer_payment_analysis: str
    wris_climate_analysis: str
    deterministic_score: int
    final_assessment: RiskAssessmentResponse


def _build_llm(temperature: float = 0.2) -> ChatGoogleGenerativeAI:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to backend/.env (see .env.example)."
        )
    return ChatGoogleGenerativeAI(model=MODEL_NAME, google_api_key=api_key, temperature=temperature)


async def extract_document_insights(file_bytes: bytes, mime_type: str) -> dict:
    """Passes an uploaded document (image or PDF) to Gemini directly and returns the
    underwriter-relevant fields it extracts, as a plain JSON-compatible dict."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to backend/.env (see .env.example)."
        )

    client = genai.Client(api_key=api_key)
    response = await client.aio.models.generate_content(
        model=MODEL_NAME,
        contents=[
            genai_types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            DOCUMENT_EXTRACTION_PROMPT,
        ],
        config=genai_types.GenerateContentConfig(response_mime_type="application/json"),
    )
    return json.loads(response.text)


async def analyze_climate(state: GraphState) -> dict:
    c = state["request"].climate
    prompt = f"""CLIMATE PROFILE (AlphaEarth-derived):
- NDVI index (vegetation health, 0-1): {c.ndvi_index:.3f}
- Soil moisture: {c.soil_moisture_percentage:.1f}%
- Rainfall deviation from historical average: {c.rainfall_deviation_pct:+.1f}%
- AlphaEarth embedding (first 8 of 64 dims): {c.alpha_earth_embeddings[:8]}

Business type: {state["request"].financials.business_type}

Analyze the forward climate risk to this enterprise's revenue."""

    llm = _build_llm()
    response = await llm.ainvoke(
        [SystemMessage(content=CLIMATE_SYSTEM_PROMPT), HumanMessage(content=prompt)]
    )
    return {"climate_analysis": _text_content(response.content)}


async def analyze_financials(state: GraphState) -> dict:
    f = state["request"].financials
    prompt = f"""FINANCIAL PROFILE:
- Business type: {f.business_type}
- Monthly revenue: INR {f.monthly_revenue_inr:,.2f}
- UPI transaction count (30d): {f.upi_transaction_count}
- Average ticket size: INR {f.avg_ticket_size_inr:,.2f}
- Days past due on current obligations: {f.days_past_due}
- KCC utilization: {f.kcc_utilization_pct:.1f}%

Analyze this enterprise's current cash flow health and repayment discipline."""

    llm = _build_llm()
    response = await llm.ainvoke(
        [SystemMessage(content=FINANCIAL_SYSTEM_PROMPT), HumanMessage(content=prompt)]
    )
    return {"financial_analysis": _text_content(response.content)}


async def analyze_buyer_payment_risk(state: GraphState) -> dict:
    bp = state["request"].buyer_payment
    if bp is None:
        return {"buyer_payment_analysis": "No buyer payment risk data available for this enterprise's taluk."}

    prompt = f"""BUYER PAYMENT RISK PROFILE (mill cane-arrears exposure):
- Taluk: {bp.taluk}
- Primary mill: {bp.mill_name}
- Weighted arrears exposure: Rs {bp.weighted_exposure_cr:.1f} crore
- Stress flag: {bp.stress_flag}
- Data confidence: {bp.confidence}

Business type: {state["request"].financials.business_type}

Analyze the forward cash-flow risk to this enterprise from its exposure to this mill's payment \
behavior."""

    llm = _build_llm()
    response = await llm.ainvoke(
        [SystemMessage(content=BUYER_PAYMENT_SYSTEM_PROMPT), HumanMessage(content=prompt)]
    )
    return {"buyer_payment_analysis": _text_content(response.content)}


async def analyze_wris_climate(state: GraphState) -> dict:
    w = state["request"].wris_climate
    if w is None:
        return {"wris_climate_analysis": "No real ground-observation data available for this enterprise's district."}

    prompt = f"""REAL GROUND-OBSERVATION DATA (India-WRIS, {w.source}):
- District: {w.district}
- Period: {w.period_start} to {w.period_end}
- Rainfall (manual rain gauge total): {f"{w.rainfall_mm_total:.1f} mm across {w.rainfall_station_count} station(s)" if w.rainfall_mm_total is not None else "not available"}
- Groundwater level: {f"{w.groundwater_avg_level_m:.1f} m average depth across {w.groundwater_station_count} station(s)" if w.groundwater_avg_level_m is not None else "not available"}
- Soil moisture: {f"{w.soil_moisture_avg_pct:.1f}%" if w.soil_moisture_avg_pct is not None else "not available"}

Business type: {state["request"].financials.business_type}

Note what this real station data corroborates or contradicts about forward climate risk."""

    llm = _build_llm()
    response = await llm.ainvoke(
        [SystemMessage(content=WRIS_CLIMATE_SYSTEM_PROMPT), HumanMessage(content=prompt)]
    )
    return {"wris_climate_analysis": _text_content(response.content)}


# Provisional thresholds, not yet calibrated against a real loan book (same caveat as
# buyer_payment stress_flag deductions) - deeper/more negative depth-to-water-level
# means a drier, more stressed aquifer.
GROUNDWATER_SEVERE_DEPTH_M = -20.0
GROUNDWATER_MODERATE_DEPTH_M = -10.0


async def calculate_base_score(state: GraphState) -> dict:
    f = state["request"].financials
    c = state["request"].climate
    bp = state["request"].buyer_payment
    w = state["request"].wris_climate

    score = 100.0
    score -= f.days_past_due * 2.0
    if c.rainfall_deviation_pct < 0:
        score -= abs(c.rainfall_deviation_pct) * 0.5
    if f.kcc_utilization_pct > 80.0:
        score -= 10.0
    if bp is not None:
        if bp.stress_flag == "HIGH":
            score -= 20.0
        elif bp.stress_flag == "MEDIUM":
            score -= 10.0
    if w is not None and w.groundwater_avg_level_m is not None:
        if w.groundwater_avg_level_m <= GROUNDWATER_SEVERE_DEPTH_M:
            score -= 15.0
        elif w.groundwater_avg_level_m <= GROUNDWATER_MODERATE_DEPTH_M:
            score -= 7.0

    # `score` is remaining health (100 = perfect); risk_score is its inverse, clamped to [0, 100].
    deterministic_score = int(min(100, max(0, round(100.0 - score))))
    return {"deterministic_score": deterministic_score}


async def synthesize_risk(state: GraphState) -> dict:
    request = state["request"]
    prompt = f"""ENTERPRISE: {request.enterprise_name}
BUSINESS TYPE: {request.financials.business_type}

FINANCIAL ANALYSIS:
{state["financial_analysis"]}

CLIMATE ANALYSIS:
{state["climate_analysis"]}

BUYER PAYMENT RISK ANALYSIS:
{state["buyer_payment_analysis"]}

REAL GROUND-OBSERVATION CLIMATE ANALYSIS:
{state["wris_climate_analysis"]}

DETERMINISTIC RISK SCORE (calculated by an auditable math model; use this exact value as \
risk_score, do not recompute it): {state["deterministic_score"]}

Produce the full structured risk assessment now."""

    llm = _build_llm()
    structured_llm = llm.with_structured_output(RiskAssessmentResponse)
    response = await structured_llm.ainvoke(
        [SystemMessage(content=SYNTHESIS_SYSTEM_PROMPT), HumanMessage(content=prompt)]
    )

    if isinstance(response, RiskAssessmentResponse):
        final_assessment = response
    else:
        final_assessment = RiskAssessmentResponse.model_validate(response)

    # Enforce the deterministic score and the buyer-payment narrative as the source of truth
    # regardless of what the LLM returned (same pattern as risk_score below).
    final_assessment.risk_score = state["deterministic_score"]
    final_assessment.buyer_payment_risk_impact = (
        state["buyer_payment_analysis"] if request.buyer_payment is not None else None
    )
    final_assessment.wris_climate_note = (
        state["wris_climate_analysis"] if request.wris_climate is not None else None
    )
    if final_assessment.risk_score >= 75:
        final_assessment.risk_classification = "CRITICAL"
    elif final_assessment.risk_score >= 50:
        final_assessment.risk_classification = "HIGH"
    elif final_assessment.risk_score >= 25:
        final_assessment.risk_classification = "MEDIUM"
    else:
        final_assessment.risk_classification = "LOW"

    return {"final_assessment": final_assessment}


# No curated per-enterprise fallbacks yet for the RTI-backed taluk cooperatives
# (backend/scripts/seed_profiles.py) - they fall through to _DEFAULT_FALLBACK below.
DEMO_GOLDEN_CACHE: dict[str, RiskAssessmentResponse] = {}

_DEFAULT_FALLBACK = RiskAssessmentResponse(
    risk_score=50,
    risk_classification="MEDIUM",
    financial_health_summary=(
        "Live risk analysis is temporarily unavailable. This is a neutral placeholder assessment "
        "and does not reflect a calculated score for this enterprise."
    ),
    climate_risk_impact=(
        "Live climate analysis is temporarily unavailable. Please retry the assessment once the "
        "risk engine is reachable."
    ),
    actionable_mitigation_steps=[
        "Retry the risk assessment once the live engine is reachable.",
    ],
    is_cached_fallback=True,
)


def get_golden_fallback(enterprise_name: str) -> RiskAssessmentResponse:
    return DEMO_GOLDEN_CACHE.get(enterprise_name, _DEFAULT_FALLBACK).model_copy(deep=True)


def _build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("analyze_climate", analyze_climate)
    graph.add_node("analyze_financials", analyze_financials)
    graph.add_node("analyze_buyer_payment_risk", analyze_buyer_payment_risk)
    graph.add_node("analyze_wris_climate", analyze_wris_climate)
    graph.add_node("calculate_base_score", calculate_base_score)
    graph.add_node("synthesize_risk", synthesize_risk)

    graph.add_edge(START, "analyze_climate")
    graph.add_edge(START, "analyze_financials")
    graph.add_edge(START, "analyze_buyer_payment_risk")
    graph.add_edge(START, "analyze_wris_climate")
    graph.add_edge(START, "calculate_base_score")

    graph.add_edge("analyze_climate", "synthesize_risk")
    graph.add_edge("analyze_financials", "synthesize_risk")
    graph.add_edge("analyze_buyer_payment_risk", "synthesize_risk")
    graph.add_edge("analyze_wris_climate", "synthesize_risk")
    graph.add_edge("calculate_base_score", "synthesize_risk")

    graph.add_edge("synthesize_risk", END)

    return graph.compile()


risk_graph = _build_graph()
