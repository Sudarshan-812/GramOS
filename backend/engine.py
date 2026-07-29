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


DEMO_GOLDEN_CACHE: dict[str, RiskAssessmentResponse] = {
    "Bhairavgad Dairy Producers' Cooperative": RiskAssessmentResponse(
        risk_score=19,
        risk_classification="LOW",
        financial_health_summary=(
            "Bhairavgad Dairy Producers' Cooperative exhibits strong financial discipline, with "
            "zero days past due on current obligations. The cooperative maintains consistent "
            "operational activity, reflected in a monthly revenue of INR 185,000 and a high volume "
            "of 412 UPI transactions, demonstrating effective digital payment adoption. The 72% "
            "utilization of its Kisan Credit Card indicates active and managed working capital use, "
            "contributing to a generally healthy cash flow position."
        ),
        climate_risk_impact=(
            "The cooperative faces a significant and escalating climate risk due to severe "
            "environmental stress. An extremely low NDVI (0.280), critically low soil moisture "
            "(14.5%), and a substantial rainfall deficit (-38.0%) collectively threaten the natural "
            "resource base. This will drastically reduce natural fodder availability and quality, "
            "and severely constrain water access for livestock. Consequently, operational costs are "
            "projected to increase significantly due to the necessity of purchasing supplementary "
            "feed and water, while simultaneously reducing milk yields per animal. This trend poses "
            "a substantial threat to future cash flow, profitability, and long-term viability, "
            "irrespective of current strong repayment performance."
        ),
        actionable_mitigation_steps=[
            "Implement climate-resilient fodder management strategies, including promoting "
            "drought-resistant fodder varieties and establishing community fodder banks or silage "
            "units.",
            "Invest in water conservation and harvesting technologies, such as rainwater harvesting "
            "systems for livestock and efficient irrigation for fodder cultivation, to mitigate "
            "water scarcity.",
            "Develop a contingency fund to buffer against increased operational costs associated "
            "with purchasing supplementary feed and water during periods of environmental stress.",
            "Explore and facilitate access to livestock insurance schemes to protect against losses "
            "from climate-induced reductions in milk yield or animal health issues.",
            "Provide training and awareness programs on climate-smart dairy farming practices, "
            "including efficient resource utilization and adaptive livestock management techniques.",
        ],
        is_cached_fallback=True,
    ),
    "Shivshakti Krishi Seva Kendra": RiskAssessmentResponse(
        risk_score=4,
        risk_classification="LOW",
        financial_health_summary=(
            "Shivshakti Krishi Seva Kendra demonstrates strong financial health, characterized by "
            "excellent repayment discipline with only 2 days past due on current obligations. The "
            "enterprise maintains robust cash flow, supported by a consistent monthly revenue of "
            "INR 610,000 and a high volume of 980 daily UPI transactions, indicating active sales "
            "and effective digital payment adoption. Furthermore, the low 35% utilization of its "
            "KCC facility suggests prudent working capital management and significant available "
            "credit headroom."
        ),
        climate_risk_impact=(
            "While current climate conditions are favorable, supporting healthy crop growth and "
            "demand for agri-inputs, Shivshakti Krishi Seva Kendra faces significant forward climate "
            "risk. As an agri-input retailer, its revenue is directly tied to the sustained "
            "productivity and purchasing power of local farmers. Increased frequency and intensity "
            "of future climate events such as droughts, floods, or extreme heat would severely "
            "impact crop yields and fodder availability, leading to reduced farmer income. This "
            "decline in farmer prosperity would directly translate into decreased demand for seeds, "
            "fertilizers, and pesticides, threatening the retailer's future cash flow through "
            "reduced sales volumes, potential inventory write-offs, and increased risk of bad debt "
            "from financially strained farmers."
        ),
        actionable_mitigation_steps=[
            "Diversify product offerings to include climate-resilient inputs (e.g., drought-"
            "resistant seeds, water-efficient irrigation systems) and non-crop-dependent products "
            "(e.g., livestock feed, small farm machinery rentals) to buffer against crop yield "
            "fluctuations.",
            "Strengthen credit assessment and recovery mechanisms for farmer credit, incorporating "
            "climate risk factors into lending decisions to mitigate potential bad debt during "
            "adverse climate events.",
            "Encourage and educate local farmers on climate-smart agricultural practices and "
            "technologies to enhance their resilience, thereby stabilizing their purchasing power "
            "and demand for inputs.",
            "Explore partnerships with agricultural insurance providers to facilitate access to "
            "crop insurance for local farmers, indirectly safeguarding their income and ability to "
            "purchase inputs.",
            "Maintain optimal inventory levels and implement robust inventory management practices "
            "to minimize write-offs during periods of reduced demand caused by climate-induced "
            "agricultural downturns.",
            "Build and maintain a healthy cash reserve to provide a financial buffer against "
            "potential revenue shortfalls during periods of severe climate impact on farmer income.",
        ],
        is_cached_fallback=True,
    ),
    "Meenakshi Handloom Traders": RiskAssessmentResponse(
        risk_score=93,
        risk_classification="CRITICAL",
        financial_health_summary=(
            "Meenakshi Handloom Traders exhibits strong revenue traceability, with the majority of "
            "its income flowing through UPI. However, the enterprise's financial health is severely "
            "strained, marked by a high 91% Kisan Credit Card (KCC) utilization, indicating an "
            "over-reliance on credit for operational liquidity. Repayment discipline is a "
            "significant concern, with the enterprise currently 41 days past due on its "
            "obligations, reflecting a consistent inability to meet financial commitments promptly."
        ),
        climate_risk_impact=(
            "The current climate profile, characterized by moderate NDVI, soil moisture, and "
            "slightly below-average rainfall, indicates a local ecosystem under moderate stress. "
            "For a Handicraft & Textile Trader, this directly impacts the availability and quality "
            "of natural raw materials such as plant fibers, dyes, and wood, which are inherently "
            "dependent on healthy vegetation and adequate water resources. This trend suggests a "
            "lack of resilience in the local environment, posing a plausible threat to future cash "
            "flow through potential reductions in material supply, increased input costs due to "
            "scarcity, and a weakening of local purchasing power as the broader agricultural "
            "economy, which supports both artisans and customers, faces ongoing environmental "
            "pressure. Even minor deterioration in these conditions could significantly impede the "
            "enterprise's ability to source inputs and sell products."
        ),
        actionable_mitigation_steps=[
            "Implement a strict cash flow management plan, including detailed budgeting and expense "
            "tracking, to reduce reliance on credit for working capital.",
            "Negotiate a structured repayment plan with the lender to address the 41-day past due "
            "obligation and restore repayment discipline.",
            "Explore diversification of raw material sourcing to include suppliers from less "
            "climate-vulnerable regions or investigate sustainable alternative materials.",
            "Strategically build a buffer inventory of critical raw materials during periods of "
            "favorable supply and pricing to mitigate future scarcity and cost increases.",
            "Evaluate opportunities for product diversification or market expansion to reduce "
            "dependence on local purchasing power and climate-sensitive inputs.",
            "Seek financial advisory to explore options for debt restructuring or alternative, more "
            "sustainable financing mechanisms beyond high KCC utilization.",
        ],
        is_cached_fallback=True,
    ),
}

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
