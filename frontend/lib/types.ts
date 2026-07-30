export interface FinancialProfile {
  business_type: string;
  monthly_revenue_inr: number;
  upi_transaction_count: number;
  avg_ticket_size_inr: number;
  days_past_due: number;
  kcc_utilization_pct: number;
}

export interface ClimateProfile {
  ndvi_index: number;
  soil_moisture_percentage: number;
  rainfall_deviation_pct: number;
  alpha_earth_embeddings: number[];
}

export interface RiskAssessmentRequest {
  enterprise_name: string;
  financials: FinancialProfile;
  climate: ClimateProfile;
}

export type RiskClassification = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAssessmentResponse {
  risk_score: number;
  risk_classification: RiskClassification;
  financial_health_summary: string;
  climate_risk_impact: string;
  actionable_mitigation_steps: string[];
  is_cached_fallback: boolean;
}

export interface HistoryPoint {
  recorded_at: string;
  monthly_revenue_inr: number;
  ndvi_index: number;
}

export interface DocumentInsight {
  id: string;
  enterprise_id: string;
  document_type: string;
  extracted_json: Record<string, unknown>;
  recorded_at: string;
}
