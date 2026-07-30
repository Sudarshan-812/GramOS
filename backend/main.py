import asyncio
import logging
import os
import random

from dotenv import load_dotenv

load_dotenv()

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
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

SUPABASE_URL = os.getenv("SUPABASE_URL")

# tokenUrl is unused (Supabase issues tokens, not us) but required by
# OAuth2PasswordBearer to document the security scheme for /docs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# This project uses Supabase's asymmetric JWT Signing Keys (ECC P-256), not a
# static HS256 shared secret, so tokens are verified against Supabase's public
# JWKS rather than a copied secret. PyJWKClient fetches and caches the keyset.
_jwks_client: jwt.PyJWKClient | None = None


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not SUPABASE_URL:
            raise RuntimeError(
                "SUPABASE_URL must be set. Add it to backend/.env (see .env.example)."
            )
        _jwks_client = jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    return _jwks_client


def verify_jwt(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


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


@app.get("/api/mock-profiles", dependencies=[Depends(verify_jwt)])
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


@app.get(
    "/api/mock-profiles/{profile_key}",
    response_model=RiskAssessmentRequest,
    dependencies=[Depends(verify_jwt)],
)
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


@app.get(
    "/api/enterprises/{enterprise_id}/history",
    response_model=list[HistoryPoint],
    dependencies=[Depends(verify_jwt)],
)
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


@app.post(
    "/api/assess-risk",
    response_model=RiskAssessmentResponse,
    dependencies=[Depends(verify_jwt)],
)
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
