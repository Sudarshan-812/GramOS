import asyncio
import json
import logging
import os
import random
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

import jwt
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from google.genai import errors as genai_errors
from langchain_google_genai.chat_models import ChatGoogleGenerativeAIError

from database import get_supabase_client
from engine import extract_document_insights, get_golden_fallback, risk_graph
from models import (
    Alert,
    AuditLog,
    BuyerPaymentProfile,
    ClimateProfile,
    DocumentInsight,
    FinancialProfile,
    HistoryPoint,
    OverrideScoreRequest,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
    WrisClimateSnapshot,
)
from worker import check_climate_thresholds

HISTORY_DAYS = 30

# Gemini's inline-data (non-Files-API) request limit is 20MB; images/PDFs are sent inline here.
MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024
ALLOWED_DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}

logger = logging.getLogger("gramos")

# Was 4.5s, tuned when the graph had 3 Gemini calls (2 parallel + synthesis). Now 5
# calls (4 parallel analysis nodes + a synthesis prompt that includes all 4 of their
# outputs, so it's slower too) - 4.5s was confirmed too tight over a real network
# connection on 2026-08-08 (timed out even on gemini-3.1-flash-lite), silently
# degrading every assessment to the generic golden fallback.
ASSESS_RISK_TIMEOUT_SECONDS = 15.0

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


scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        check_climate_thresholds,
        "interval",
        minutes=1,
        id="check_climate_thresholds",
    )
    scheduler.start()
    logger.info("Scheduler started: check_climate_thresholds every 1 minute")
    yield
    scheduler.shutdown()


app = FastAPI(title="GramOS API", version="0.1.0", lifespan=lifespan)

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


# There is no buyer_payment_snapshots table yet - Mills/Catchment/Exposure data is still
# being sourced (RTI + manual fieldwork, see Ref_data/GramOS_Cane_Arrears_Dataset_v1.xlsx).
# Keyed by enterprise name so it survives reseeding without hardcoding a UUID; swap this
# dict out for a real Supabase-backed lookup once Exposure data exists.
_MOCK_BUYER_PAYMENT_BY_ENTERPRISE_NAME: dict[str, BuyerPaymentProfile] = {
    "Satti Cane Growers Cooperative (Athani)": BuyerPaymentProfile(
        taluk="Athani",
        mill_name=(
            "Shri Brahmanand Sagar Jaggery Industries (Alagawadi, Raibag taluk - corrected "
            "2026-08-08, supersedes the earlier wrong 'Krishna SSK Ltd' identification, which "
            "was based on stale 2023 info) - a jaggery/gur unit, NOT a Cane-Commissionerate-"
            "regulated sugar mill, so it is likely outside the sugar-mill RTI's scope. "
            "[MOCK dues/arrears figures - real numbers not sourced, and the usual sugar-mill "
            "RTI/S02 sourcing path probably does not apply to this buyer]"
        ),
        weighted_exposure_cr=132.0,
        stress_flag="HIGH",
        confidence="Low",
    ),
}

# Real (not mock) India-WRIS ground-observation data - see backend/wris_client.py and
# backend/scripts/fetch_wris_climate_data.py, which produced this file. There is no
# database table for it yet either, so this loads the same JSON snapshot the script
# saved rather than duplicating the numbers inline. Enterprise -> district mapping is
# hardcoded here the same way buyer_payment's enterprise -> taluk mapping is.
_WRIS_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "Ref_data", "wris_climate_data.json")
_ENTERPRISE_TO_WRIS_DISTRICT: dict[str, str] = {
    "Satti Cane Growers Cooperative (Athani)": "Belagavi",
}


def _load_wris_snapshots() -> dict[str, WrisClimateSnapshot]:
    try:
        with open(_WRIS_DATA_PATH, encoding="utf-8") as f:
            raw = json.load(f)
    except FileNotFoundError:
        logger.warning("wris_climate_data.json not found at %s; wris_climate will be omitted", _WRIS_DATA_PATH)
        return {}

    snapshots: dict[str, WrisClimateSnapshot] = {}
    for district, datasets in raw.items():
        rainfall = (datasets.get("rainfall") or {}).get("summary") or {}
        groundwater = (datasets.get("groundwater") or {}).get("summary") or {}
        soil_moisture = (datasets.get("soil_moisture") or {}).get("summary") or {}
        snapshots[district] = WrisClimateSnapshot(
            district=district,
            period_start="2025-06-01",
            period_end="2025-06-30",
            rainfall_mm_total=rainfall.get("total_mm"),
            rainfall_station_count=len(rainfall.get("stations", [])),
            groundwater_avg_level_m=groundwater.get("avg_level_m"),
            groundwater_station_count=len(groundwater.get("stations", [])),
            soil_moisture_avg_pct=soil_moisture.get("avg_pct"),
        )
    return snapshots


_WRIS_SNAPSHOTS_BY_DISTRICT = _load_wris_snapshots()


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
        buyer_payment=_MOCK_BUYER_PAYMENT_BY_ENTERPRISE_NAME.get(enterprise["name"]),
        wris_climate=_WRIS_SNAPSHOTS_BY_DISTRICT.get(
            _ENTERPRISE_TO_WRIS_DISTRICT.get(enterprise["name"], "")
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
            "assess-risk timed out after %.1fs for '%s', serving golden fallback",
            ASSESS_RISK_TIMEOUT_SECONDS,
            request.enterprise_name,
        )
        return get_golden_fallback(request.enterprise_name)
    except (genai_errors.ClientError, genai_errors.ServerError, ChatGoogleGenerativeAIError) as exc:
        logger.warning(
            "assess-risk hit a Gemini API error (%s) for '%s', serving golden fallback",
            exc,
            request.enterprise_name,
        )
        return get_golden_fallback(request.enterprise_name)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini risk analysis failed: {exc}") from exc


@app.post(
    "/api/enterprises/{enterprise_id}/upload-document",
    response_model=DocumentInsight,
    dependencies=[Depends(verify_jwt)],
)
async def upload_document(enterprise_id: str, file: UploadFile = File(...)):
    client = get_supabase_client()

    enterprise_res = client.table("enterprises").select("id").eq("id", enterprise_id).execute()
    if not enterprise_res.data:
        raise HTTPException(status_code=404, detail=f"Unknown enterprise '{enterprise_id}'")

    if file.content_type not in ALLOWED_DOCUMENT_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported document type '{file.content_type}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_DOCUMENT_MIME_TYPES))}",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(file_bytes) > MAX_DOCUMENT_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Document exceeds the 20MB limit")

    try:
        extracted = await extract_document_insights(file_bytes, file.content_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (genai_errors.ClientError, genai_errors.ServerError) as exc:
        raise HTTPException(status_code=502, detail=f"Gemini document extraction failed: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502, detail=f"Gemini returned non-JSON output: {exc}"
        ) from exc

    row = {
        "id": str(uuid.uuid4()),
        "enterprise_id": enterprise_id,
        "document_type": file.content_type,
        "extracted_json": extracted,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }
    insert_res = client.table("document_insights").insert(row).execute()
    return DocumentInsight.model_validate(insert_res.data[0])


@app.get(
    "/api/enterprises/{enterprise_id}/documents",
    response_model=list[DocumentInsight],
    dependencies=[Depends(verify_jwt)],
)
def list_document_insights(enterprise_id: str):
    client = get_supabase_client()

    enterprise_res = client.table("enterprises").select("id").eq("id", enterprise_id).execute()
    if not enterprise_res.data:
        raise HTTPException(status_code=404, detail=f"Unknown enterprise '{enterprise_id}'")

    rows = (
        client.table("document_insights")
        .select("*")
        .eq("enterprise_id", enterprise_id)
        .order("recorded_at", desc=True)
        .execute()
        .data
    )
    return rows


@app.post(
    "/api/enterprises/{enterprise_id}/override-score",
    response_model=AuditLog,
)
def override_score(
    enterprise_id: str,
    request: OverrideScoreRequest,
    claims: dict = Depends(verify_jwt),
):
    officer_id = claims.get("sub")
    if not officer_id:
        raise HTTPException(status_code=401, detail="Token is missing a subject (user id) claim")

    client = get_supabase_client()

    enterprise_res = client.table("enterprises").select("id").eq("id", enterprise_id).execute()
    if not enterprise_res.data:
        raise HTTPException(status_code=404, detail=f"Unknown enterprise '{enterprise_id}'")

    row = {
        "id": str(uuid.uuid4()),
        "enterprise_id": enterprise_id,
        "officer_id": officer_id,
        "original_score": request.original_score,
        "overridden_score": request.overridden_score,
        "justification": request.justification,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }
    insert_res = client.table("audit_logs").insert(row).execute()
    return AuditLog.model_validate(insert_res.data[0])


@app.get(
    "/api/enterprises/{enterprise_id}/alerts",
    response_model=list[Alert],
    dependencies=[Depends(verify_jwt)],
)
def list_alerts(enterprise_id: str):
    client = get_supabase_client()

    enterprise_res = client.table("enterprises").select("id").eq("id", enterprise_id).execute()
    if not enterprise_res.data:
        raise HTTPException(status_code=404, detail=f"Unknown enterprise '{enterprise_id}'")

    rows = (
        client.table("alerts")
        .select("*")
        .eq("enterprise_id", enterprise_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return rows
