"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Circle,
  CloudRain,
  Droplets,
  Loader2,
  Milk,
  Play,
  Sparkles,
  Sprout,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import RiskChart from "@/components/RiskChart";
import { assessRisk, getMockProfile, listMockProfileKeys } from "@/lib/api";
import type {
  RiskAssessmentRequest,
  RiskAssessmentResponse,
  RiskClassification,
} from "@/lib/types";

interface EnterpriseProfile {
  key: string;
  profile: RiskAssessmentRequest;
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const keys = await listMockProfileKeys();
        const loaded = await Promise.all(
          keys.map(async (key) => ({ key, profile: await getMockProfile(key) }))
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
  }

  async function handleSimulate() {
    if (!selected) return;
    setAssessing(true);
    setAssessError(null);
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

  function toggleStep(index: number) {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <Image
            src="/gramos-logo.png"
            alt="GramOS"
            width={1051}
            height={907}
            className="w-32 h-auto"
            priority
          />
          <p className="mt-1 text-xs text-slate-500">Risk Portfolio</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loadingProfiles && (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading enterprises...
            </div>
          )}

          {profilesError && (
            <div className="mx-1 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {profilesError}
              <p className="mt-1 text-red-500">
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
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition ${
                      isSelected
                        ? "bg-slate-900 text-slate-50"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                        isSelected ? "bg-emerald-500" : "bg-slate-100"
                      }`}
                    >
                      <Icon
                        className={`h-4.5 w-4.5 ${
                          isSelected ? "text-slate-900" : "text-slate-500"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {profile.enterprise_name}
                      </p>
                      <p
                        className={`truncate text-xs ${
                          isSelected ? "text-slate-400" : "text-slate-500"
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
          <div className="mx-auto flex max-w-4xl flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {selected.profile.enterprise_name}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.profile.financials.business_type}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSimulate}
                disabled={assessing}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-50 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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

            {/* Input signal snapshot */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Input Signals
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-7">
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
              </dl>
            </div>

            {/* Result area */}
            {assessError && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-6">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Risk assessment failed
                  </p>
                  <p className="mt-1 text-sm text-red-700">{assessError}</p>
                </div>
              </div>
            )}

            {assessing && !assessError && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-16">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <p className="text-sm text-slate-500">
                  Gemini is reasoning over financial and climate signals...
                </p>
              </div>
            )}

            {!assessing && !assessError && !assessment && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
                <Sparkles className="h-6 w-6 text-slate-300" />
                <p className="text-sm text-slate-500">
                  Click &ldquo;Simulate API Call&rdquo; to run the GramOS XAI risk
                  engine on this enterprise.
                </p>
              </div>
            )}

            {assessment && !assessing && (
              <>
                <RiskScoreWidget assessment={assessment} />

                <RiskChart
                  financials={selected.profile.financials}
                  climate={selected.profile.climate}
                />

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

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="text-sm font-semibold text-slate-900">
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
                            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50"
                          >
                            {checked ? (
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                            ) : (
                              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                            )}
                            <span
                              className={`text-sm leading-6 ${
                                checked
                                  ? "text-slate-400 line-through"
                                  : "text-slate-700"
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
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900">
          <Icon className="h-4 w-4 text-emerald-500" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function RiskScoreWidget({
  assessment,
}: {
  assessment: RiskAssessmentResponse;
}) {
  const styles = RISK_STYLES[assessment.risk_classification];
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, assessment.risk_score));
  const offset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-slate-100"
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
          <span className="text-3xl font-bold text-slate-900">
            {assessment.risk_score}
          </span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 text-center sm:text-left">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            NPA Risk Classification
          </p>
          <span
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${styles.badge}`}
          >
            <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
            {assessment.risk_classification}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Generated by the Gemini XAI risk engine, fusing transaction logs with
          AlphaEarth climate metrics.
        </p>
      </div>
    </div>
  );
}
