from pydantic import BaseModel, Field


class FinancialProfile(BaseModel):
    business_type: str = Field(..., description="e.g. 'Dairy Cooperative', 'Agri Input Retailer'")
    monthly_revenue_inr: float = Field(..., ge=0, description="Average monthly revenue in INR")
    upi_transaction_count: int = Field(..., ge=0, description="Number of UPI transactions in the last 30 days")
    avg_ticket_size_inr: float = Field(..., ge=0, description="Average transaction size in INR")
    days_past_due: int = Field(..., ge=0, description="Days past due on the most recent obligation")


class ClimateProfile(BaseModel):
    ndvi_index: float = Field(..., ge=0.0, le=1.0, description="Normalized Difference Vegetation Index")
    soil_moisture_percentage: float = Field(..., ge=0.0, le=100.0)
    rainfall_deviation_pct: float = Field(
        ..., description="Deviation from historical rainfall average, e.g. -20.0 for drought conditions"
    )
    alpha_earth_embeddings: list[float] = Field(
        ..., min_length=64, max_length=64, description="64-dim AlphaEarth satellite embedding vector"
    )


class RiskAssessmentRequest(BaseModel):
    enterprise_name: str
    financials: FinancialProfile
    climate: ClimateProfile


class RiskAssessmentResponse(BaseModel):
    risk_score: int = Field(..., ge=0, le=100)
    risk_classification: str = Field(..., description="One of: LOW, MEDIUM, HIGH, CRITICAL")
    financial_health_summary: str
    climate_risk_impact: str
    actionable_mitigation_steps: list[str]
