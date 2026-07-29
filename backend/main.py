from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from engine import risk_graph
from mock_data import MOCK_PROFILES
from models import RiskAssessmentRequest, RiskAssessmentResponse

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
        result = await risk_graph.ainvoke({"request": request})
        return result["final_assessment"]
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini risk analysis failed: {exc}") from exc
