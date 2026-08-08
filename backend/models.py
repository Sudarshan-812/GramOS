from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FinancialProfile(BaseModel):
    business_type: str = Field(..., description="e.g. 'Dairy Cooperative', 'Agri Input Retailer'")
    monthly_revenue_inr: float = Field(..., ge=0, description="Average monthly revenue in INR")
    upi_transaction_count: int = Field(..., ge=0, description="Number of UPI transactions in the last 30 days")
    avg_ticket_size_inr: float = Field(..., ge=0, description="Average transaction size in INR")
    days_past_due: int = Field(..., ge=0, description="Days past due on the most recent obligation")
    kcc_utilization_pct: float = Field(
        ..., ge=0.0, le=100.0, description="Kisan Credit Card limit utilization, as a percentage"
    )


class ClimateProfile(BaseModel):
    ndvi_index: float = Field(..., ge=0.0, le=1.0, description="Normalized Difference Vegetation Index")
    soil_moisture_percentage: float = Field(..., ge=0.0, le=100.0)
    rainfall_deviation_pct: float = Field(
        ..., description="Deviation from historical rainfall average, e.g. -20.0 for drought conditions"
    )
    alpha_earth_embeddings: list[float] = Field(
        ..., min_length=64, max_length=64, description="64-dim AlphaEarth satellite embedding vector"
    )


class BuyerPaymentProfile(BaseModel):
    """Mill cane-arrears exposure for the taluk an enterprise operates in. Mirrors the
    Exposure tab of Ref_data/GramOS_Cane_Arrears_Dataset_v1.xlsx (weighted_exposure_cr,
    stress_flag). Optional: only rural enterprises in a covered taluk (currently Belagavi,
    Bagalkote, Vijayapura) will have this signal."""

    taluk: str
    mill_name: str
    weighted_exposure_cr: float = Field(..., ge=0, description="Weighted mill arrears exposure, Rs crore")
    stress_flag: str = Field(..., description="One of: HIGH, MEDIUM, LOW")
    confidence: str = Field(..., description="Data confidence: High, Medium, Low")


class WrisClimateSnapshot(BaseModel):
    """Real ground-observation data from the India-WRIS API (indiawris.gov.in) for the
    enterprise's district - distinct from ClimateProfile above, which is still
    synthetic. Raw values, not a "deviation from normal" (no historical baseline has
    been computed yet - see backend/scripts/fetch_wris_climate_data.py)."""

    district: str
    period_start: str
    period_end: str
    rainfall_mm_total: float | None = Field(
        default=None, description="Summed manual rain-gauge readings (CWC), excluding telemetric/accumulated rows"
    )
    rainfall_station_count: int = 0
    groundwater_avg_level_m: float | None = Field(
        default=None, description="Average depth-to-water-level in meters (CGWB); more negative = deeper/drier"
    )
    groundwater_station_count: int = 0
    soil_moisture_avg_pct: float | None = None
    source: str = "India-WRIS"


class RiskAssessmentRequest(BaseModel):
    enterprise_name: str
    financials: FinancialProfile
    climate: ClimateProfile
    buyer_payment: BuyerPaymentProfile | None = None
    wris_climate: WrisClimateSnapshot | None = None


class RiskAssessmentResponse(BaseModel):
    risk_score: int = Field(..., ge=0, le=100)
    risk_classification: str = Field(..., description="One of: LOW, MEDIUM, HIGH, CRITICAL")
    financial_health_summary: str
    climate_risk_impact: str
    buyer_payment_risk_impact: str | None = Field(
        default=None, description="Mill/buyer payment risk narrative; null when no buyer_payment data was supplied"
    )
    wris_climate_note: str | None = Field(
        default=None, description="Real ground-observation climate narrative; null when no wris_climate data was supplied"
    )
    actionable_mitigation_steps: list[str]
    is_cached_fallback: bool = Field(
        default=False, description="True when this response was served from the golden fallback cache"
    )


# --- Supabase relational schema (backend/scripts/init_supabase.py) ---
# These mirror the enterprises / financial_ledgers / climate_snapshots tables row-for-row,
# as opposed to FinancialProfile/ClimateProfile above which are the flattened, latest-only
# shape consumed by the risk engine.


class Enterprise(BaseModel):
    id: UUID
    name: str
    business_type: str
    created_at: datetime


class FinancialLedger(BaseModel):
    id: UUID
    enterprise_id: UUID
    monthly_revenue_inr: float = Field(..., ge=0)
    upi_transaction_count: int = Field(..., ge=0)
    avg_ticket_size_inr: float = Field(..., ge=0)
    days_past_due: int = Field(..., ge=0)
    kcc_limit_utilized_pct: float = Field(..., ge=0.0, le=100.0)
    recorded_at: datetime | None = Field(
        default=None, description="Day this ledger entry represents; null for the original Phase 1 seed row"
    )


class ClimateSnapshot(BaseModel):
    id: UUID
    enterprise_id: UUID
    ndvi_index: float = Field(..., ge=0.0, le=1.0)
    soil_moisture_percentage: float = Field(..., ge=0.0, le=100.0)
    rainfall_deviation_pct: float
    recorded_at: datetime | None = Field(
        default=None, description="Day this snapshot represents; null for the original Phase 1 seed row"
    )


class HistoryPoint(BaseModel):
    """One day of GET /api/enterprises/{id}/history: a financial_ledgers row joined with its
    same-day climate_snapshots row, reduced to just the fields the dashboard's time-series
    chart plots."""

    recorded_at: datetime
    monthly_revenue_inr: float
    ndvi_index: float


class DocumentInsight(BaseModel):
    id: UUID
    enterprise_id: UUID
    document_type: str = Field(..., description="MIME type of the uploaded document")
    extracted_json: dict = Field(
        ..., description="Underwriting-relevant fields Gemini extracted from the document"
    )
    recorded_at: datetime


class OverrideScoreRequest(BaseModel):
    original_score: int = Field(..., ge=0, le=100, description="The AI-generated risk score being overridden")
    overridden_score: int = Field(..., ge=0, le=100, description="The loan officer's replacement score")
    justification: str = Field(..., min_length=1, description="Mandatory reason for the override")


class AuditLog(BaseModel):
    id: UUID
    enterprise_id: UUID
    officer_id: UUID = Field(..., description="Supabase auth user id of the overriding loan officer")
    original_score: int
    overridden_score: int
    justification: str
    recorded_at: datetime


class Alert(BaseModel):
    id: UUID
    enterprise_id: UUID
    alert_type: str = Field(..., description="e.g. 'CLIMATE_WARNING'")
    message: str
    is_read: bool = False
    created_at: datetime
