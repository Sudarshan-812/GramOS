import os
from typing import TypedDict

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END

from models import RiskAssessmentRequest, RiskAssessmentResponse

MODEL_NAME = "gemini-2.5-flash"

CLIMATE_SYSTEM_PROMPT = """You are a climate risk analyst at a rural development finance \
institution. Given NDVI (vegetation health), soil moisture, and rainfall deviation data for a \
rural micro-enterprise, reason about how the physical environment underpinning the enterprise's \
revenue (crop yield, fodder availability, water access) is trending, and how that plausibly \
threatens FUTURE cash flow for this specific business type. Weight deterioration heavily even if \
the enterprise's repayment record currently looks clean — you are assessing forward climate risk. \
Respond with a concise analytical paragraph. Do not invent a risk score or classification."""

FINANCIAL_SYSTEM_PROMPT = """You are a credit analyst at a rural development finance institution. \
Given an enterprise's monthly revenue, UPI transaction velocity, average ticket size, days past \
due, and Kisan Credit Card (KCC) utilization, reason about the enterprise's current cash flow \
health and repayment discipline. Respond with a concise analytical paragraph. Do not invent a \
risk score or classification."""

SYNTHESIS_SYSTEM_PROMPT = """You are a senior agricultural credit risk analyst at a rural \
development finance institution, producing the final institutional-grade Non-Performing Asset \
(NPA) risk assessment for an enterprise.

A deterministic risk score has already been calculated by a separate, auditable math model, as \
required by RBI 2026 Model Risk Management guidelines. You MUST NOT recalculate, override, or \
second-guess this score — copy it exactly into risk_score, and derive risk_classification from it \
using these bands: LOW (0-24), MEDIUM (25-49), HIGH (50-74), CRITICAL (75-100).

Your job is to write the explainable narrative: financial_health_summary, climate_risk_impact, \
and actionable_mitigation_steps, grounded in the financial analysis and climate analysis you are \
given below. Focus entirely on producing clear, well-reasoned prose and concrete mitigation \
actions — the numeric score is not yours to compute."""


class GraphState(TypedDict):
    request: RiskAssessmentRequest
    climate_analysis: str
    financial_analysis: str
    deterministic_score: int
    final_assessment: RiskAssessmentResponse


def _build_llm(temperature: float = 0.2) -> ChatGoogleGenerativeAI:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to backend/.env (see .env.example)."
        )
    return ChatGoogleGenerativeAI(model=MODEL_NAME, google_api_key=api_key, temperature=temperature)


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
    return {"climate_analysis": response.content}


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
    return {"financial_analysis": response.content}


async def calculate_base_score(state: GraphState) -> dict:
    f = state["request"].financials
    c = state["request"].climate

    score = 100.0
    score -= f.days_past_due * 2.0
    if c.rainfall_deviation_pct < 0:
        score -= abs(c.rainfall_deviation_pct) * 0.5
    if f.kcc_utilization_pct > 80.0:
        score -= 10.0

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

DETERMINISTIC RISK SCORE (calculated by an auditable math model — use this exact value as \
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

    # Enforce the deterministic score as the source of truth regardless of what the LLM returned.
    final_assessment.risk_score = state["deterministic_score"]
    if final_assessment.risk_score >= 75:
        final_assessment.risk_classification = "CRITICAL"
    elif final_assessment.risk_score >= 50:
        final_assessment.risk_classification = "HIGH"
    elif final_assessment.risk_score >= 25:
        final_assessment.risk_classification = "MEDIUM"
    else:
        final_assessment.risk_classification = "LOW"

    return {"final_assessment": final_assessment}


def _build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("analyze_climate", analyze_climate)
    graph.add_node("analyze_financials", analyze_financials)
    graph.add_node("calculate_base_score", calculate_base_score)
    graph.add_node("synthesize_risk", synthesize_risk)

    graph.add_edge(START, "analyze_climate")
    graph.add_edge(START, "analyze_financials")
    graph.add_edge(START, "calculate_base_score")

    graph.add_edge("analyze_climate", "synthesize_risk")
    graph.add_edge("analyze_financials", "synthesize_risk")
    graph.add_edge("calculate_base_score", "synthesize_risk")

    graph.add_edge("synthesize_risk", END)

    return graph.compile()


risk_graph = _build_graph()
