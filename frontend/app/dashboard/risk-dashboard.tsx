"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Circle,
  CloudRain,
  Database,
  Droplets,
  FileText,
  Landmark,
  Loader2,
  Milk,
  PenLine,
  Play,
  ShieldCheck,
  Sparkles,
  Sprout,
  TrendingUp,
  Wallet,
  WifiOff,
} from "@/components/icons/MaterialIcons";
import Image from "next/image";
import DocumentUploader from "@/components/DocumentUploader";
import OverrideScoreModal from "@/components/OverrideScoreModal";
import RiskChart from "@/components/RiskChart";
import Reveal from "@/components/Reveal";
import { createClient } from "@/lib/supabase/client";
import {
  assessRisk,
  getAlerts,
  getDocumentInsights,
  getEnterpriseHistory,
  getMockProfile,
  listMockProfileKeys,
} from "@/lib/api";
import type {
  Alert,
  AuditLog,
  DocumentInsight,
  HistoryPoint,
  RiskAssessmentRequest,
  RiskAssessmentResponse,
  RiskClassification,
} from "@/lib/types";

interface EnterpriseProfile {
  key: string;
  profile: RiskAssessmentRequest;
  history: HistoryPoint[];
}

const RISK_STYLES: Record<
  RiskClassification,
  {
    ring: string;
    badge: string;
    dot: string;
  }
> = {
  LOW: {
    ring: "text-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  MEDIUM: {
    ring: "text-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  HIGH: {
    ring: "text-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  CRITICAL: {
    ring: "text-red-500",
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

/** Mirrors the LOW/MEDIUM/HIGH/CRITICAL bands engine.py uses for the AI score, so a
 * manually-overridden score gets the same visual treatment (ring/badge color). */
function classifyRisk(score: number): RiskClassification {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function enterpriseIcon(businessType: string) {
  const t = businessType.toLowerCase();
  if (t.includes("dairy")) return Milk;
  if (t.includes("cane") || t.includes("agri") || t.includes("retail")) return Sprout;
  if (t.includes("textile") || t.includes("handicraft") || t.includes("trader"))
    return Building2;
  return Building2;
}

// Keyed by how many summary cards are actually rendered (2 base + up to 2 optional
// signals), since a fixed column count either wastes space or crams a 4th card in.
const SUMMARY_CARD_GRID_CLASS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
};

export default function RiskDashboard() {
  const [profiles, setProfiles] = useState<EnterpriseProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [assessment, setAssessment] = useState<RiskAssessmentResponse | null>(
    null
  );
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [override, setOverride] = useState<AuditLog | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [mainScrolled, setMainScrolled] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const [documents, setDocuments] = useState<DocumentInsight[]>([]);
  // Which enterprise key `documents`/`documentsError` currently reflect; used to derive
  // documentsLoading below instead of a separately-managed boolean set inside the effect.
  const [documentsForKey, setDocumentsForKey] = useState<string | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const documentsLoading =
    selectedKey !== null && documentsForKey !== selectedKey;

  useEffect(() => {
    if (!selectedKey) return;

    let cancelled = false;

    getDocumentInsights(selectedKey)
      .then((docs) => {
        if (cancelled) return;
        setDocuments(docs);
        setDocumentsError(null);
        setDocumentsForKey(selectedKey);
      })
      .catch((err) => {
        if (cancelled) return;
        setDocumentsError(
          err instanceof Error ? err.message : "Failed to load documents"
        );
        setDocumentsForKey(selectedKey);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedKey]);

  function handleDocumentUploaded(insight: DocumentInsight) {
    setDocuments((prev) => [insight, ...prev]);
  }

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsForKey, setAlertsForKey] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedKey) return;

    let cancelled = false;

    getAlerts(selectedKey)
      .then((rows) => {
        if (cancelled) return;
        setAlerts(rows);
        setAlertsForKey(selectedKey);
      })
      .catch(() => {
        // Alerts are a non-critical banner; a failed fetch shouldn't block the
        // rest of the dashboard, so just leave the banner empty.
        if (!cancelled) setAlertsForKey(selectedKey);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedKey]);

  const unreadAlerts = alerts.filter((a) => !a.is_read && a.enterprise_id === alertsForKey);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Backend routes require a Supabase JWT. Logged-in visitors already
        // have one; anonymous visitors (e.g. a cold link with no login UI)
        // get a real anonymous session so the same JWT-gated API still works.
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          await supabase.auth.signInAnonymously();
        }

        const keys = await listMockProfileKeys();
        const loaded = await Promise.all(
          keys.map(async (key) => {
            const [profile, history] = await Promise.all([
              getMockProfile(key),
              getEnterpriseHistory(key),
            ]);
            return { key, profile, history };
          })
        );
        if (cancelled) return;
        setProfiles(loaded);
        setSelectedKey((current) => current ?? loaded[0]?.key ?? null);
      } catch (err) {
        if (!cancelled) {
          setProfilesError(
            err instanceof Error ? err.message : "Failed to load enterprises"
          );
        }
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => profiles.find((p) => p.key === selectedKey) ?? null,
    [profiles, selectedKey]
  );

  function handleSelect(key: string) {
    setSelectedKey(key);
    setAssessment(null);
    setAssessError(null);
    setCheckedSteps(new Set());
    setOverride(null);
  }

  async function handleSimulate() {
    if (!selected) return;
    setAssessing(true);
    setAssessError(null);
    setOverride(null);
    try {
      const result = await assessRisk(selected.profile);
      setAssessment(result);
      setCheckedSteps(new Set());
    } catch (err) {
      setAssessment(null);
      setAssessError(
        err instanceof Error ? err.message : "Risk assessment failed"
      );
    } finally {
      setAssessing(false);
    }
  }

  function handleOverrideSuccess(auditLog: AuditLog) {
    setOverride(auditLog);
    setOverrideModalOpen(false);
    setToast(
      `Score overridden to ${auditLog.overridden_score}/100 and logged to the audit trail.`
    );
  }

  function toggleStep(index: number) {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Sidebar */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-black/10 bg-white">
        <div className="border-b border-black/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Image
              src="/GramOStpt.png"
              alt="GramOS"
              width={1024}
              height={1024}
              className="h-6 w-6"
            />
            <h1 className="text-xl font-semibold tracking-tight text-onyx">
              GramOS
            </h1>
          </div>
          <p className="mt-1 text-xs text-onyx/40">Risk Portfolio</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loadingProfiles && (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-onyx/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading enterprises...
            </div>
          )}

          {profilesError && (
            <div className="mx-1 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {profilesError}
              <p className="mt-1 text-red-600">
                Is the backend running on :8000?
              </p>
            </div>
          )}

          <ul className="space-y-1">
            {profiles.map(({ key, profile }) => {
              const Icon = enterpriseIcon(profile.financials.business_type);
              const isSelected = key === selectedKey;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => handleSelect(key)}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-3 text-left transition ${
                      isSelected
                        ? "bg-lime-300 text-onyx"
                        : "text-onyx/70 hover:bg-mist"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                        isSelected ? "bg-onyx/10" : "bg-mist"
                      }`}
                    >
                      <Icon
                        className={`h-4.5 w-4.5 ${
                          isSelected ? "text-onyx" : "text-onyx/40"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {profile.enterprise_name}
                      </p>
                      <p
                        className={`truncate text-xs ${
                          isSelected ? "text-onyx/70" : "text-onyx/40"
                        }`}
                      >
                        {profile.financials.business_type}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Main content */}
      <main
        className="flex-1 overflow-y-auto px-8 py-8"
        onScroll={(e) => setMainScrolled(e.currentTarget.scrollTop > 12)}
      >
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-onyx/40">
            {loadingProfiles ? "Loading..." : "Select an enterprise to begin."}
          </div>
        ) : (
          <div className="mx-auto flex max-w-6xl flex-col gap-10">
            {/* Proactive risk alerts */}
            {unreadAlerts.length > 0 && (
              <div className="flex flex-col gap-2">
                {unreadAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
                  >
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
                        {alert.alert_type.replace(/_/g, " ")}
                      </p>
                      <p className="mt-0.5 text-sm text-red-600">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Header: sticky, shrinks and gains a frosted backdrop on scroll */}
            <div
              className={`sticky top-0 z-10 -mx-1 flex flex-col items-start justify-between gap-4 rounded-2xl px-1 transition-all duration-500 ease-in-out sm:flex-row sm:items-center ${
                mainScrolled
                  ? "bg-paper/90 py-2 shadow-[0_8px_30px_-12px_rgba(18,20,18,0.15)] backdrop-blur-md"
                  : "py-0"
              }`}
            >
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-onyx">
                  {selected.profile.enterprise_name}
                </h1>
                <p className="mt-1 text-sm text-onyx/50">
                  {selected.profile.financials.business_type}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSimulate}
                disabled={assessing}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-lime-300 px-5 py-2.5 text-sm font-semibold text-onyx shadow-sm transition hover:-translate-y-0.5 hover:bg-lime-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {assessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Simulate API Call
                  </>
                )}
              </button>
            </div>

            {/* Input signal tiles */}
            <Reveal>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-onyx/40">
                Input Signals
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <Stat
                  icon={Wallet}
                  label="Monthly Revenue"
                  value={`₹${selected.profile.financials.monthly_revenue_inr.toLocaleString(
                    "en-IN"
                  )}`}
                />
                <Stat
                  icon={TrendingUp}
                  label="UPI Txns (30d)"
                  value={selected.profile.financials.upi_transaction_count.toLocaleString(
                    "en-IN"
                  )}
                />
                <Stat
                  icon={
                    selected.profile.financials.days_past_due > 0
                      ? AlertTriangle
                      : CheckCircle2
                  }
                  label="Days Past Due"
                  value={String(selected.profile.financials.days_past_due)}
                />
                <Stat
                  icon={Wallet}
                  label="KCC Utilization"
                  value={`${selected.profile.financials.kcc_utilization_pct.toFixed(1)}%`}
                />
                <Stat
                  icon={Sprout}
                  label="NDVI Index"
                  value={selected.profile.climate.ndvi_index.toFixed(2)}
                />
                <Stat
                  icon={Droplets}
                  label="Soil Moisture"
                  value={`${selected.profile.climate.soil_moisture_percentage.toFixed(
                    1
                  )}%`}
                />
                <Stat
                  icon={CloudRain}
                  label="Rainfall Deviation"
                  value={`${
                    selected.profile.climate.rainfall_deviation_pct > 0
                      ? "+"
                      : ""
                  }${selected.profile.climate.rainfall_deviation_pct.toFixed(1)}%`}
                />
                {selected.profile.buyer_payment && (
                  <Stat
                    icon={Landmark}
                    label={`Mill Arrears (${selected.profile.buyer_payment.taluk})`}
                    value={`₹${selected.profile.buyer_payment.weighted_exposure_cr.toFixed(
                      0
                    )}cr · ${selected.profile.buyer_payment.stress_flag}`}
                  />
                )}
                {selected.profile.wris_climate && (
                  <Stat
                    icon={Database}
                    label={`Real Rainfall (${selected.profile.wris_climate.district})`}
                    value={
                      selected.profile.wris_climate.rainfall_mm_total != null
                        ? `${selected.profile.wris_climate.rainfall_mm_total.toFixed(
                            0
                          )}mm`
                        : "N/A"
                    }
                  />
                )}
                {selected.profile.wris_climate && (
                  <Stat
                    icon={Droplets}
                    label="Real Groundwater Depth"
                    value={
                      selected.profile.wris_climate.groundwater_avg_level_m != null
                        ? `${selected.profile.wris_climate.groundwater_avg_level_m.toFixed(
                            1
                          )}m`
                        : "N/A"
                    }
                  />
                )}
              </div>
              {selected.profile.buyer_payment && (
                <p className="mt-3 text-xs text-onyx/40">
                  Buyer payment exposure figures are mock placeholders (
                  {selected.profile.buyer_payment.mill_name}) pending real
                  Mills/Catchment/Exposure data.
                </p>
              )}
              {selected.profile.wris_climate && (
                <p className="mt-1 text-xs text-onyx/40">
                  Rainfall/groundwater are real India-WRIS station data (
                  {selected.profile.wris_climate.period_start} to{" "}
                  {selected.profile.wris_climate.period_end}), district-level only -
                  not yet the same source as the NDVI/soil-moisture/rainfall-deviation
                  figures above, which are still synthetic.
                </p>
              )}
            </Reveal>

            {/* Risk score: a standalone horizontal summary bar, not squeezed
                beside the chart, so the score reads at a glance and the
                chart gets the full-width room it needs below. */}
            <Reveal delay={80}>
              <RiskScoreBar
                assessing={assessing}
                assessError={assessError}
                assessment={assessment}
                override={override}
                onOverrideClick={() => setOverrideModalOpen(true)}
              />
            </Reveal>

            {/* Chart: standalone full-width section */}
            <Reveal delay={140}>
              <RiskChart
                financials={selected.profile.financials}
                climate={selected.profile.climate}
                historyData={selected.history}
              />
            </Reveal>

            {/* Document intelligence */}
            <Reveal delay={200} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DocumentUploader
                enterpriseId={selected.key}
                onUploadSuccess={handleDocumentUploaded}
              />
              <DocumentInsightsCard
                documents={documents}
                loading={documentsLoading}
                error={documentsError}
              />
            </Reveal>

            {/* Assessment narrative */}
            {assessment && !assessing && (
              <>
                <Reveal
                  className={`grid grid-cols-1 gap-6 ${
                    SUMMARY_CARD_GRID_CLASS[
                      2 +
                        (assessment.buyer_payment_risk_impact ? 1 : 0) +
                        (assessment.wris_climate_note ? 1 : 0)
                    ]
                  }`}
                >
                  <SummaryCard
                    icon={Wallet}
                    title="Financial Health Summary"
                    body={assessment.financial_health_summary}
                  />
                  <SummaryCard
                    icon={CloudRain}
                    title="Climate Risk Impact"
                    body={assessment.climate_risk_impact}
                  />
                  {assessment.buyer_payment_risk_impact && (
                    <SummaryCard
                      icon={Landmark}
                      title="Buyer Payment Risk"
                      body={assessment.buyer_payment_risk_impact}
                    />
                  )}
                  {assessment.wris_climate_note && (
                    <SummaryCard
                      icon={Database}
                      title="Real Ground-Observation Climate"
                      body={assessment.wris_climate_note}
                    />
                  )}
                </Reveal>

                <Reveal delay={80}>
                  <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-onyx">
                      Actionable Mitigation Steps
                    </h2>
                    <ul className="mt-4 space-y-2">
                      {assessment.actionable_mitigation_steps.map((step, i) => {
                        const checked = checkedSteps.has(i);
                        return (
                          <li key={i}>
                            <button
                              type="button"
                              onClick={() => toggleStep(i)}
                              className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-mist"
                            >
                              {checked ? (
                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                              ) : (
                                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-onyx/25" />
                              )}
                              <span
                                className={`text-sm leading-6 ${
                                  checked
                                    ? "text-onyx/35 line-through"
                                    : "text-onyx/70"
                                }`}
                              >
                                {step}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </Reveal>
              </>
            )}
          </div>
        )}
      </main>

      {overrideModalOpen && selected && assessment && (
        <OverrideScoreModal
          enterpriseId={selected.key}
          currentScore={override?.overridden_score ?? assessment.risk_score}
          onClose={() => setOverrideModalOpen(false)}
          onSuccess={handleOverrideSuccess}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-onyx shadow-lg shadow-black/10">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-onyx/40">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-lime-100">
          <Icon className="h-3.5 w-3.5 text-lime-700" />
        </span>
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-onyx">{value}</p>
    </div>
  );
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(formatFieldValue).join(", ");

  // Extraction commonly nests figures as { value: 45230.5, currency: "INR" }
  // or { value: 68, unit: "percent" }: render those as a single readable string.
  const obj = value as Record<string, unknown>;
  if ("value" in obj) {
    const unit = obj.currency ?? obj.unit;
    return unit ? `${String(obj.value)} ${String(unit)}` : String(obj.value);
  }

  return Object.entries(obj)
    .map(([k, v]) => `${formatFieldLabel(k)}: ${formatFieldValue(v)}`)
    .join(", ");
}

function DocumentInsightsCard({
  documents,
  loading,
  error,
}: {
  documents: DocumentInsight[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-onyx/40">
        Document Insights
      </h2>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-onyx/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading documents...
        </div>
      )}

      {error && !loading && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && documents.length === 0 && (
        <p className="mt-4 text-sm text-onyx/40">
          No documents uploaded yet for this enterprise.
        </p>
      )}

      {!loading && !error && documents.length > 0 && (
        <div className="mt-4 flex max-h-96 flex-col gap-4 overflow-y-auto pr-1">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl border border-black/10 bg-mist p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-onyx/40">
                  <FileText className="h-3.5 w-3.5" />
                  {doc.document_type}
                </span>
                <span className="text-xs text-onyx/40">
                  {new Date(doc.recorded_at).toLocaleString("en-IN")}
                </span>
              </div>
              <dl className="mt-3 flex flex-col gap-2">
                {Object.entries(doc.extracted_json).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-baseline justify-between gap-3 border-b border-black/10 py-1"
                  >
                    <dt className="text-xs text-onyx/40">
                      {formatFieldLabel(key)}
                    </dt>
                    <dd className="text-right text-sm font-medium text-onyx">
                      {formatFieldValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Wallet;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-lime-100">
          <Icon className="h-4 w-4 text-lime-700" />
        </div>
        <h2 className="text-sm font-semibold text-onyx">{title}</h2>
      </div>
      <p className="mt-4 text-sm leading-7 text-onyx/60">{body}</p>
    </div>
  );
}

/** Horizontal summary bar for the Gemini risk assessment (loading / error / empty /
 * result state) that sits above the chart rather than squeezed beside it, so the
 * chart gets a full-width, standalone section of its own. */
function RiskScoreBar({
  assessing,
  assessError,
  assessment,
  override,
  onOverrideClick,
}: {
  assessing: boolean;
  assessError: string | null;
  assessment: RiskAssessmentResponse | null;
  override: AuditLog | null;
  onOverrideClick: () => void;
}) {
  if (assessing) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-lime-600" />
        <p className="text-sm text-onyx/50">
          Gemini is reasoning over financial and climate signals...
        </p>
      </div>
    );
  }

  if (assessError) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-6">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-semibold text-red-700">
            Risk assessment failed
          </p>
          <p className="mt-0.5 text-sm text-red-600">{assessError}</p>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-black/15 bg-white p-6">
        <Sparkles className="h-5 w-5 shrink-0 text-onyx/25" />
        <p className="text-sm text-onyx/40">
          Click &ldquo;Simulate API Call&rdquo; to run the GramOS XAI risk
          engine on this enterprise.
        </p>
      </div>
    );
  }

  const displayScore = override ? override.overridden_score : assessment.risk_score;
  const displayClassification = override
    ? classifyRisk(override.overridden_score)
    : assessment.risk_classification;
  const styles = RISK_STYLES[displayClassification];
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, displayScore));
  const offset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:flex-row">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 92 92" className="h-24 w-24 -rotate-90">
          <circle
            cx="46"
            cy="46"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-black/10"
          />
          <circle
            cx="46"
            cy="46"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${styles.ring} transition-[stroke-dashoffset] duration-700 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-onyx">{displayScore}</span>
          <span className="text-[10px] text-onyx/40">/ 100</span>
        </div>
      </div>

      <div className="flex-1 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <p className="text-xs font-semibold uppercase tracking-wider text-onyx/40">
            NPA Risk Classification
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
            {displayClassification}
          </span>
          {override ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-lime-300 bg-lime-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-lime-700">
              <ShieldCheck className="h-3 w-3" />
              Human Overridden
            </span>
          ) : (
            assessment.is_cached_fallback && (
              <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-mist px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-onyx/40">
                <WifiOff className="h-3 w-3" />
                Offline / Fallback Mode
              </span>
            )
          )}
        </div>
        <p className="mt-2 text-sm leading-5 text-onyx/50">
          {override
            ? `Overridden from the AI score of ${override.original_score}, logged to the compliance audit trail.`
            : "Generated by the Gemini XAI risk engine, fusing transaction logs with AlphaEarth climate metrics."}
        </p>
      </div>

      <button
        type="button"
        onClick={onOverrideClick}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-onyx/70 transition hover:border-lime-400 hover:text-lime-700"
      >
        <PenLine className="h-3.5 w-3.5" />
        {override ? "Override Again" : "Manual Override"}
      </button>
    </div>
  );
}
