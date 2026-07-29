import asyncio
import logging
import random

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai import errors as genai_errors
from langchain_google_genai.chat_models import ChatGoogleGenerativeAIError

from database import get_supabase_client
from engine import get_golden_fallback, risk_graph
from models import (
    ClimateProfile,
    FinancialProfile,
    HistoryPoint,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
)

HISTORY_DAYS = 30

logger = logging.getLogger("gramos")

ASSESS_RISK_TIMEOUT_SECONDS = 4.5

app = FastAPI(title="GramOS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "GramOS API"}


@app.get("/api/mock-profiles")
def list_mock_profiles():
    client = get_supabase_client()
    enterprises = client.table("enterprises").select("id").execute().data
    return {"profiles": [e["id"] for e in enterprises]}


def _synthetic_alpha_earth_embeddings(enterprise_id: str) -> list[float]:
    # climate_snapshots does not persist AlphaEarth embedding vectors yet; synthesize a
    # stable per-enterprise placeholder (seeded by enterprise id) so ClimateProfile validation
    # is satisfied until real AlphaEarth ingestion lands.
    rng = random.Random(enterprise_id)
    return [round(rng.uniform(-1.0, 1.0), 4) for _ in range(64)]


@app.get("/api/mock-profiles/{profile_key}", response_model=RiskAssessmentRequest)
def get_mock_profile(profile_key: str):
    client = get_supabase_client()

    enterprise_res = client.table("enterprises").select("*").eq("id", profile_key).execute()
    if not enterprise_res.data:
        raise HTTPException(status_code=404, detail=f"Unknown enterprise '{profile_key}'")
    enterprise = enterprise_res.data[0]

    ledger_res = (
        client.table("financial_ledgers")
        .select("*")
        .eq("enterprise_id", profile_key)
        .order("recorded_at", desc=True, nullsfirst=False)
        .limit(1)
        .execute()
    )
    if not ledger_res.data:
        raise HTTPException(status_code=404, detail=f"No financial data for enterprise '{profile_key}'")
    ledger = ledger_res.data[0]

    climate_res = (
        client.table("climate_snapshots")
        .select("*")
        .eq("enterprise_id", profile_key)
        .order("recorded_at", desc=True, nullsfirst=False)
        .limit(1)
        .execute()
    )
    if not climate_res.data:
        raise HTTPException(status_code=404, detail=f"No climate data for enterprise '{profile_key}'")
    snapshot = climate_res.data[0]

    return RiskAssessmentRequest(
        enterprise_name=enterprise["name"],
        financials=FinancialProfile(
            business_type=enterprise["business_type"],
            monthly_revenue_inr=ledger["monthly_revenue_inr"],
            upi_transaction_count=ledger["upi_transaction_count"],
            avg_ticket_size_inr=ledger["avg_ticket_size_inr"],
            days_past_due=ledger["days_past_due"],
            kcc_utilization_pct=ledger["kcc_limit_utilized_pct"],
        ),
        climate=ClimateProfile(
            ndvi_index=snapshot["ndvi_index"],
            soil_moisture_percentage=snapshot["soil_moisture_percentage"],
            rainfall_deviation_pct=snapshot["rainfall_deviation_pct"],
            alpha_earth_embeddings=_synthetic_alpha_earth_embeddings(profile_key),
        ),
    )


@app.get("/api/enterprises/{enterprise_id}/history", response_model=list[HistoryPoint])
def get_enterprise_history(enterprise_id: str):
    client = get_supabase_client()

    ledger_rows = (
        client.table("financial_ledgers")
        .select("recorded_at, monthly_revenue_inr")
        .eq("enterprise_id", enterprise_id)
        .order("recorded_at", desc=True, nullsfirst=False)
        .limit(HISTORY_DAYS)
        .execute()
        .data
    )
    climate_rows = (
        client.table("climate_snapshots")
        .select("recorded_at, ndvi_index")
        .eq("enterprise_id", enterprise_id)
        .order("recorded_at", desc=True, nullsfirst=False)
        .limit(HISTORY_DAYS)
        .execute()
        .data
    )

    # financial_ledgers and climate_snapshots are upserted together per (enterprise_id,
    # recorded_at) by seed_dynamic_data.py, so the same recorded_at value joins both tables.
    ndvi_by_date = {row["recorded_at"]: row["ndvi_index"] for row in climate_rows if row["recorded_at"]}

    points = [
        HistoryPoint(
            recorded_at=row["recorded_at"],
            monthly_revenue_inr=row["monthly_revenue_inr"],
            ndvi_index=ndvi_by_date[row["recorded_at"]],
        )
        for row in ledger_rows
        if row["recorded_at"] in ndvi_by_date
    ]
    points.sort(key=lambda p: p.recorded_at)
    return points


@app.post("/api/assess-risk", response_model=RiskAssessmentResponse)
async def assess_risk(request: RiskAssessmentRequest):
    try:
        result = await asyncio.wait_for(
            risk_graph.ainvoke({"request": request}),
            timeout=ASSESS_RISK_TIMEOUT_SECONDS,
        )
        return result["final_assessment"]
    except asyncio.TimeoutError:
        logger.warning(
            "assess-risk timed out after %.1fs for '%s' — serving golden fallback",
            ASSESS_RISK_TIMEOUT_SECONDS,
            request.enterprise_name,
        )
        return get_golden_fallback(request.enterprise_name)
    except (genai_errors.ClientError, genai_errors.ServerError, ChatGoogleGenerativeAIError) as exc:
        logger.warning(
            "assess-risk hit a Gemini API error (%s) for '%s' — serving golden fallback",
            exc,
            request.enterprise_name,
        )
        return get_golden_fallback(request.enterprise_name)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini risk analysis failed: {exc}") from exc
