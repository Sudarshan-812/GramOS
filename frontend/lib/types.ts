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

export interface BuyerPaymentProfile {
  taluk: string;
  mill_name: string;
  weighted_exposure_cr: number;
  stress_flag: "HIGH" | "MEDIUM" | "LOW";
  confidence: string;
}

export interface WrisClimateSnapshot {
  district: string;
  period_start: string;
  period_end: string;
  rainfall_mm_total: number | null;
  rainfall_station_count: number;
  groundwater_avg_level_m: number | null;
  groundwater_station_count: number;
  soil_moisture_avg_pct: number | null;
  source: string;
}

export interface RiskAssessmentRequest {
  enterprise_name: string;
  financials: FinancialProfile;
  climate: ClimateProfile;
  buyer_payment?: BuyerPaymentProfile | null;
  wris_climate?: WrisClimateSnapshot | null;
}

export type RiskClassification = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAssessmentResponse {
  risk_score: number;
  risk_classification: RiskClassification;
  financial_health_summary: string;
  climate_risk_impact: string;
  buyer_payment_risk_impact: string | null;
  wris_climate_note: string | null;
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

export interface OverrideScoreRequest {
  original_score: number;
  overridden_score: number;
  justification: string;
}

export interface AuditLog {
  id: string;
  enterprise_id: string;
  officer_id: string;
  original_score: number;
  overridden_score: number;
  justification: string;
  recorded_at: string;
}

export interface Alert {
  id: string;
  enterprise_id: string;
  alert_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
