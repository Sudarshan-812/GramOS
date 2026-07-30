"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Circle,
  CloudRain,
  Droplets,
  FileText,
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
} from "lucide-react";
import Image from "next/image";
import DocumentUploader from "@/components/DocumentUploader";
import OverrideScoreModal from "@/components/OverrideScoreModal";
import RiskChart from "@/components/RiskChart";
import {
  assessRisk,
  getDocumentInsights,
  getEnterpriseHistory,
  getMockProfile,
  listMockProfileKeys,
} from "@/lib/api";
import type {
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
    ring: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  MEDIUM: {
    ring: "text-amber-400",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
  },
  HIGH: {
    ring: "text-orange-400",
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    dot: "bg-orange-400",
  },
  CRITICAL: {
    ring: "text-red-400",
    badge: "bg-red-500/10 text-red-400 border-red-500/30",
    dot: "bg-red-400",
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
  if (t.includes("agri") || t.includes("retail")) return Sprout;
  if (t.includes("textile") || t.includes("handicraft") || t.includes("trader"))
    return Building2;
  return Building2;
}

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
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
    <div className="flex min-h-screen bg-onyx">
      {/* Sidebar */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-gray-700/60 bg-card">
        <div className="border-b border-gray-700/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <Image
              src="/GramOStpt.png"
              alt="GramOS"
              width={1024}
              height={1024}
              className="h-6 w-6"
            />
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">
              GramOS
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">Risk Portfolio</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loadingProfiles && (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading enterprises...
            </div>
          )}

          {profilesError && (
            <div className="mx-1 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              {profilesError}
              <p className="mt-1 text-red-400/80">
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
                        ? "bg-amber-400 text-onyx"
                        : "text-slate-300 hover:bg-onyx"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                        isSelected ? "bg-onyx/10" : "bg-onyx"
                      }`}
                    >
                      <Icon
                        className={`h-4.5 w-4.5 ${
                          isSelected ? "text-onyx" : "text-slate-500"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {profile.enterprise_name}
                      </p>
                      <p
                        className={`truncate text-xs ${
                          isSelected ? "text-onyx/70" : "text-slate-500"
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
      <main className="flex-1 overflow-y-auto px-8 py-8">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {loadingProfiles ? "Loading..." : "Select an enterprise to begin."}
          </div>
        ) : (
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
                  {selected.profile.enterprise_name}
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  {selected.profile.financials.business_type}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSimulate}
                disabled={assessing}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-amber-400 px-5 py-2.5 text-sm font-semibold text-onyx transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
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
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Input Signals
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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
              </div>
            </div>

            {/* Chart + risk score */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <RiskChart
                  financials={selected.profile.financials}
                  climate={selected.profile.climate}
                  historyData={selected.history}
                />
              </div>
              <RiskScorePanel
                assessing={assessing}
                assessError={assessError}
                assessment={assessment}
                override={override}
                onOverrideClick={() => setOverrideModalOpen(true)}
              />
            </div>

            {/* Document intelligence */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DocumentUploader
                enterpriseId={selected.key}
                onUploadSuccess={handleDocumentUploaded}
              />
              <DocumentInsightsCard
                documents={documents}
                loading={documentsLoading}
                error={documentsError}
              />
            </div>

            {/* Assessment narrative */}
            {assessment && !assessing && (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                </div>

                <div className="rounded-2xl border border-gray-700/60 bg-card p-6">
                  <h2 className="text-sm font-semibold text-slate-50">
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
                            className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-onyx"
                          >
                            {checked ? (
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                            ) : (
                              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
                            )}
                            <span
                              className={`text-sm leading-6 ${
                                checked
                                  ? "text-slate-600 line-through"
                                  : "text-slate-300"
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
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-card px-4 py-3 text-sm text-slate-100 shadow-lg shadow-black/40">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
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
    <div className="rounded-xl border border-gray-700/60 bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-400/10">
          <Icon className="h-3.5 w-3.5 text-amber-400" />
        </span>
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-50">{value}</p>
    </div>
  );
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(formatFieldValue).join(", ");

  // Extraction commonly nests figures as { value: 45230.5, currency: "INR" }
  // or { value: 68, unit: "percent" } — render those as a single readable string.
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
    <div className="rounded-2xl border border-gray-700/60 bg-card p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Document Insights
      </h2>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading documents...
        </div>
      )}

      {error && !loading && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {!loading && !error && documents.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          No documents uploaded yet for this enterprise.
        </p>
      )}

      {!loading && !error && documents.length > 0 && (
        <div className="mt-4 flex max-h-96 flex-col gap-4 overflow-y-auto pr-1">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl border border-gray-700/60 bg-onyx p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <FileText className="h-3.5 w-3.5" />
                  {doc.document_type}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(doc.recorded_at).toLocaleString("en-IN")}
                </span>
              </div>
              <dl className="mt-3 flex flex-col gap-2">
                {Object.entries(doc.extracted_json).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-baseline justify-between gap-3 border-b border-gray-700/60 py-1"
                  >
                    <dt className="text-xs text-slate-500">
                      {formatFieldLabel(key)}
                    </dt>
                    <dd className="text-right text-sm font-medium text-slate-100">
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
    <div className="rounded-2xl border border-gray-700/60 bg-card p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-400/10">
          <Icon className="h-4 w-4 text-amber-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-400">{body}</p>
    </div>
  );
}

/** Side-column panel that shows the loading / error / empty / result state of the
 * Gemini risk assessment, alongside the always-available RiskChart. */
function RiskScorePanel({
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
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-gray-700/60 bg-card p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        <p className="text-sm text-slate-400">
          Gemini is reasoning over financial and climate signals...
        </p>
      </div>
    );
  }

  if (assessError) {
    return (
      <div className="flex h-full flex-col items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
        <p className="text-sm font-semibold text-red-300">
          Risk assessment failed
        </p>
        <p className="text-sm text-red-400">{assessError}</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-700 bg-card p-8 text-center">
        <Sparkles className="h-6 w-6 text-slate-600" />
        <p className="text-sm text-slate-500">
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
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, displayScore));
  const offset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="flex h-full flex-col items-center gap-4 rounded-2xl border border-gray-700/60 bg-card p-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        NPA Risk Classification
      </p>
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-gray-700"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${styles.ring} transition-[stroke-dashoffset] duration-700 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-50">
            {displayScore}
          </span>
          <span className="text-xs text-slate-500">/ 100</span>
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${styles.badge}`}
      >
        <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
        {displayClassification}
      </span>

      {override ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
          <ShieldCheck className="h-3 w-3" />
          Human Overridden
        </span>
      ) : (
        assessment.is_cached_fallback && (
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-onyx px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <WifiOff className="h-3 w-3" />
            Offline / Fallback Mode
          </span>
        )
      )}

      <p className="text-xs leading-5 text-slate-500">
        {override
          ? `Overridden from the AI score of ${override.original_score} — logged to the compliance audit trail.`
          : "Generated by the Gemini XAI risk engine, fusing transaction logs with AlphaEarth climate metrics."}
      </p>

      <button
        type="button"
        onClick={onOverrideClick}
        className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-amber-400/50 hover:text-amber-400"
      >
        <PenLine className="h-3.5 w-3.5" />
        {override ? "Override Again" : "Manual Override"}
      </button>
    </div>
  );
}
