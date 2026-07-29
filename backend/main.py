import asyncio
import logging

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai import errors as genai_errors
from langchain_google_genai.chat_models import ChatGoogleGenerativeAIError

from engine import get_golden_fallback, risk_graph
from mock_data import MOCK_PROFILES
from models import RiskAssessmentRequest, RiskAssessmentResponse

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
    return {"profiles": list(MOCK_PROFILES.keys())}


@app.get("/api/mock-profiles/{profile_key}", response_model=RiskAssessmentRequest)
def get_mock_profile(profile_key: str):
    factory = MOCK_PROFILES.get(profile_key)
    if factory is None:
        raise HTTPException(status_code=404, detail=f"Unknown mock profile '{profile_key}'")
    return factory()


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
