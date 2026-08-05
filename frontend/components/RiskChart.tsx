"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  AreaChart as AreaChartIcon,
  BarChart3 as BarChartIcon,
  LineChart as LineChartIcon,
  Radar as RadarIcon,
} from "@/components/icons/MaterialIcons";
import type { ApexOptions } from "apexcharts";
import type { ClimateProfile, FinancialProfile, HistoryPoint } from "@/lib/types";

// ApexCharts touches `window` at import time, so it can only run client-side.
const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface RiskChartProps {
  financials: FinancialProfile;
  climate: ClimateProfile;
  historyData: HistoryPoint[];
}

const COLORS = {
  emerald: "#10b981", // historical + actual revenue
  slate: "#94a3b8", // projected revenue / historical NDVI
  grid: "#e5e7eb",
  red: "#ef4444", // critical climate threshold
  lime: "#65a30d",
  ink: "#121412",
  muted: "#78716c",
};

const FONT = "inherit";

const PROJECTION_MONTHS = 6;
const DAYS_PER_MONTH = 30;

type ChartMode = "line" | "area" | "bar" | "radar";

const CHART_MODES: { id: ChartMode; label: string; icon: typeof LineChartIcon }[] = [
  { id: "line", label: "Line", icon: LineChartIcon },
  { id: "area", label: "Area", icon: AreaChartIcon },
  { id: "bar", label: "Bar", icon: BarChartIcon },
  { id: "radar", label: "Risk Profile", icon: RadarIcon },
];

const MODE_META: Record<ChartMode, { title: string; subtitle: string }> = {
  line: {
    title: "30-Day History & 6-Month Cash Flow Projection",
    subtitle:
      "Day −30 to today: actual revenue & NDVI trend from Supabase. Months +1–6: projected against climate stress signals.",
  },
  area: {
    title: "Cash Flow Trend",
    subtitle:
      "Filled view of actual and projected monthly revenue against the critical cash flow threshold.",
  },
  bar: {
    title: "Revenue Outlook by Month",
    subtitle:
      "Current baseline vs. each projected month, adjusted for climate stress signals.",
  },
  radar: {
    title: "Composite Risk Profile",
    subtitle:
      "Normalized 0–100 health score across financial and climate signals; a fuller shape means lower risk.",
  },
};

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function formatDayOffset(value: number | null | undefined): string {
  if (value == null) return "";
  if (value === 0) return "Today";
  if (value < 0) return `D${value}`;
  return `M+${Math.round(value / DAYS_PER_MONTH)}`;
}

// ApexCharts' axis/tooltip formatters get called with the raw value at a given
// x-position, which is `null` wherever a series has a gap (e.g. the historical
// vs. projected split) — so these must tolerate null/undefined, not just number.
function formatINR(value: number | null | undefined): string {
  if (value == null) return "";
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

function formatINRFull(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/** "Nice" round-number axis ticks (1/2/5 × 10^n steps) instead of raw min/max splits. */
function niceTicks(min: number, max: number, targetCount = 5): number[] {
  const range = max - min || 1;
  const roughStep = range / (targetCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const niceStep = (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10) * magnitude;

  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;

  const ticks: number[] = [];
  for (let t = niceMin; t <= niceMax + niceStep * 0.001; t += niceStep) {
    ticks.push(Math.round(t));
  }
  return ticks;
}

/** Shared revenue-projection math, reused by the line/area, bar, and (indirectly) radar views. */
function computeProjection(
  financials: FinancialProfile,
  climate: ClimateProfile,
  historyData: HistoryPoint[]
): { baseline: number; combinedImpact: number; criticalThreshold: number } {
  const baseline =
    historyData.length > 0
      ? historyData[historyData.length - 1].monthly_revenue_inr
      : financials.monthly_revenue_inr;

  // Climate stress: drought (negative rainfall deviation) and poor vegetation
  // health (NDVI below a healthy 0.5) both erode future cash flow. Combine
  // them into a single 0-0.6 impact fraction applied ramping over the projection.
  const rainfallImpact = Math.max(0, -climate.rainfall_deviation_pct) / 100;
  const ndviImpact = Math.max(0, 0.5 - climate.ndvi_index);
  const combinedImpact = Math.min(0.6, rainfallImpact * 0.7 + ndviImpact * 1.0);

  return { baseline, combinedImpact, criticalThreshold: baseline * 0.5 };
}

function projectedRevenueAtMonth(baseline: number, combinedImpact: number, monthNumber: number): number {
  return baseline * (1 - (combinedImpact * monthNumber) / PROJECTION_MONTHS);
}

// --- Line / Area dataset -----------------------------------------------------

interface TimelinePoint {
  dayOffset: number;
  actual: number | null;
  ndviActual: number | null;
  projected: number | null;
  criticalThreshold: number;
}

function buildTimeline(
  financials: FinancialProfile,
  climate: ClimateProfile,
  historyData: HistoryPoint[]
): { data: TimelinePoint[]; criticalThreshold: number; isCritical: boolean; minDayOffset: number } {
  const { baseline, combinedImpact, criticalThreshold } = computeProjection(
    financials,
    climate,
    historyData
  );

  const historicalPoints: TimelinePoint[] = historyData.map((point, i) => {
    const dayOffset = i - (historyData.length - 1); // ... -2, -1, 0 (today)
    return {
      dayOffset,
      actual: point.monthly_revenue_inr,
      ndviActual: point.ndvi_index,
      // Duplicate today's value onto the projected series so the solid historical
      // line and dashed projected line connect visually at the hand-off point.
      projected: dayOffset === 0 ? point.monthly_revenue_inr : null,
      criticalThreshold,
    };
  });

  const projectedPoints: TimelinePoint[] = Array.from({ length: PROJECTION_MONTHS }, (_, i) => {
    const monthNumber = i + 1;
    return {
      dayOffset: monthNumber * DAYS_PER_MONTH,
      actual: null,
      ndviActual: null,
      projected: projectedRevenueAtMonth(baseline, combinedImpact, monthNumber),
      criticalThreshold,
    };
  });

  const data = [...historicalPoints, ...projectedPoints];
  const finalProjected = projectedPoints[projectedPoints.length - 1]?.projected ?? baseline;
  const minDayOffset = historicalPoints[0]?.dayOffset ?? 0;
  return { data, criticalThreshold, isCritical: finalProjected < criticalThreshold, minDayOffset };
}

// --- Bar dataset ---------------------------------------------------------------

interface BarPoint {
  label: string;
  value: number;
  isProjected: boolean;
}

function buildBarSeries(
  financials: FinancialProfile,
  climate: ClimateProfile,
  historyData: HistoryPoint[]
): { data: BarPoint[]; criticalThreshold: number; isCritical: boolean } {
  const { baseline, combinedImpact, criticalThreshold } = computeProjection(
    financials,
    climate,
    historyData
  );

  const data: BarPoint[] = [
    { label: "Current", value: baseline, isProjected: false },
    ...Array.from({ length: PROJECTION_MONTHS }, (_, i) => {
      const monthNumber = i + 1;
      return {
        label: `M+${monthNumber}`,
        value: projectedRevenueAtMonth(baseline, combinedImpact, monthNumber),
        isProjected: true,
      };
    }),
  ];

  const finalValue = data[data.length - 1].value;
  return { data, criticalThreshold, isCritical: finalValue < criticalThreshold };
}

// --- Radar dataset ---------------------------------------------------------------

interface RadarPoint {
  metric: string;
  value: number;
}

function buildRiskProfile(financials: FinancialProfile, climate: ClimateProfile): RadarPoint[] {
  const points: [string, number][] = [
    ["Revenue", clamp((financials.monthly_revenue_inr / 800_000) * 100, 0, 100)],
    ["Repayment", clamp(100 - financials.days_past_due * 2, 0, 100)],
    ["Credit Headroom", clamp(100 - financials.kcc_utilization_pct, 0, 100)],
    ["Txn Activity", clamp((financials.upi_transaction_count / 1200) * 100, 0, 100)],
    ["Vegetation", clamp(climate.ndvi_index * 100, 0, 100)],
    ["Soil Moisture", clamp(climate.soil_moisture_percentage, 0, 100)],
    ["Rainfall", clamp(100 - Math.abs(climate.rainfall_deviation_pct) * 1.5, 0, 100)],
  ];
  return points.map(([metric, value]) => ({ metric, value: Math.round(value) }));
}

// --- Shared chart chrome ---------------------------------------------------------------

/** Tooltip markup shared by every mode; ApexCharts renders this as raw HTML, so it's
 * built with plain Tailwind classes rather than JSX. */
function tooltipShell(rows: { color: string; text: string }[], label?: string): string {
  return `
    <div class="rounded-lg border border-black/10 bg-white px-3 py-2 shadow-lg shadow-black/10">
      ${label ? `<p class="text-xs font-medium text-onyx/40">${label}</p>` : ""}
      <div class="mt-1 space-y-1">
        ${rows
          .map(
            (row) => `
          <div class="flex items-center gap-2">
            <span class="h-0.5 w-3 shrink-0" style="background-color:${row.color}"></span>
            <span class="text-sm font-semibold text-onyx">${row.text}</span>
          </div>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function ModeSelector({ mode, onChange }: { mode: ChartMode; onChange: (mode: ChartMode) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-mist p-1">
      {CHART_MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
            mode === id
              ? "bg-lime-300 text-onyx"
              : "text-onyx/50 hover:text-onyx"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function LineView({ financials, climate, historyData }: RiskChartProps) {
  const { data, isCritical, hasHistory, series, options } = useMemo(() => {
    const { data, criticalThreshold, isCritical, minDayOffset } = buildTimeline(
      financials,
      climate,
      historyData
    );
    const values = data.flatMap((d) => [d.actual, d.projected]).filter((v): v is number => v != null);
    const minValue = Math.min(...values, criticalThreshold);
    const maxValue = Math.max(...values);
    const yTicks = niceTicks(minValue - (maxValue - minValue) * 0.1, maxValue, 5);
    const yDomain: [number, number] = [yTicks[0], yTicks[yTicks.length - 1]];
    const hasHistory = historyData.length > 0;

    const actualSeries = data.map((d) => ({ x: d.dayOffset, y: d.actual }));
    const projectedSeries = data.map((d) => ({ x: d.dayOffset, y: d.projected }));
    const ndviSeries = data.map((d) => ({ x: d.dayOffset, y: d.ndviActual }));

    const lastActual = [...data].reverse().find((d) => d.actual != null);
    const lastProjected = data[data.length - 1];

    const series = [
      { name: "Historical Revenue", data: actualSeries },
      { name: "Projected Revenue", data: projectedSeries },
      ...(hasHistory ? [{ name: "NDVI", data: ndviSeries }] : []),
    ];

    const options: ApexOptions = {
      chart: {
        type: "line",
        fontFamily: FONT,
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true, speed: 500 },
      },
      colors: [COLORS.emerald, COLORS.slate, COLORS.slate],
      stroke: { curve: "straight", width: hasHistory ? [2, 2, 1.5] : [2, 2], dashArray: hasHistory ? [0, 6, 0] : [0, 6] },
      grid: { borderColor: COLORS.grid, strokeDashArray: 3 },
      markers: { size: 0 },
      xaxis: {
        type: "numeric",
        min: minDayOffset,
        max: PROJECTION_MONTHS * DAYS_PER_MONTH,
        tickAmount: hasHistory ? 7 : 6,
        labels: {
          formatter: (v) => formatDayOffset(Number(v)),
          style: { colors: COLORS.muted, fontSize: "12px" },
        },
        axisBorder: { color: COLORS.grid },
        axisTicks: { color: COLORS.grid },
      },
      yaxis: [
        {
          seriesName: hasHistory
            ? ["Historical Revenue", "Projected Revenue"]
            : undefined,
          min: yDomain[0],
          max: yDomain[1],
          tickAmount: 4,
          labels: { formatter: (v) => formatINR(v), style: { colors: COLORS.muted, fontSize: "12px" } },
        },
        ...(hasHistory
          ? [
              {
                seriesName: "NDVI",
                opposite: true,
                min: 0,
                max: 1,
                tickAmount: 4,
                labels: {
                  formatter: (v: number | null | undefined) => (v == null ? "" : v.toFixed(2)),
                  style: { colors: COLORS.muted, fontSize: "12px" },
                },
              },
            ]
          : []),
      ],
      annotations: {
        yaxis: [
          {
            y: criticalThreshold,
            borderColor: COLORS.red,
            strokeDashArray: 4,
          },
        ],
        points: [
          ...(lastActual?.actual != null
            ? [
                {
                  x: lastActual.dayOffset,
                  y: lastActual.actual,
                  marker: { size: 4, fillColor: COLORS.emerald, strokeColor: "#fff", strokeWidth: 2 },
                  label: {
                    text: formatINR(lastActual.actual),
                    borderWidth: 0,
                    offsetY: -6,
                    style: { color: COLORS.ink, fontSize: "11px", fontWeight: 600, background: "transparent" },
                  },
                },
              ]
            : []),
          ...(lastProjected.projected != null
            ? [
                {
                  x: lastProjected.dayOffset,
                  y: lastProjected.projected,
                  marker: {
                    size: 5,
                    fillColor: isCritical ? COLORS.red : COLORS.slate,
                    strokeColor: "#fff",
                    strokeWidth: 2,
                  },
                  label: {
                    text: formatINR(lastProjected.projected),
                    borderWidth: 0,
                    offsetY: -6,
                    style: {
                      color: isCritical ? COLORS.red : COLORS.ink,
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "transparent",
                    },
                  },
                },
              ]
            : []),
        ],
      },
      legend: { show: false },
      tooltip: {
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          const point = data[dataPointIndex];
          if (!point) return "";
          const rows: { color: string; text: string }[] = [];
          if (point.actual != null) {
            rows.push({ color: COLORS.emerald, text: `${formatINRFull(point.actual)} (Actual)` });
          }
          if (point.projected != null) {
            rows.push({ color: COLORS.slate, text: `${formatINRFull(point.projected)} (Projected)` });
          }
          if (point.ndviActual != null) {
            rows.push({ color: COLORS.slate, text: `NDVI ${point.ndviActual.toFixed(2)}` });
          }
          return tooltipShell(rows, formatDayOffset(point.dayOffset));
        },
      },
    };

    return { data, isCritical, hasHistory, series, options };
  }, [financials, climate, historyData]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-xs text-onyx/50">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ backgroundColor: COLORS.emerald }} />
          Historical revenue
        </span>
        {hasHistory && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2" style={{ borderColor: COLORS.slate }} />
            Historical NDVI
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 border-t-2 border-dashed"
            style={{ borderColor: COLORS.slate }}
          />
          Projected revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 border-t-2 border-dashed"
            style={{ borderColor: COLORS.red }}
          />
          Critical threshold
        </span>
      </div>

      {isCritical && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
          Projected revenue falls below the critical cash flow threshold by month 6.
        </p>
      )}

      <div className="mt-4 h-80 w-full sm:h-96">
        <ApexChart options={options} series={series} type="line" height="100%" width="100%" />
      </div>

      {/* Screen-reader-only data table: same values, reachable without hovering */}
      <table className="sr-only">
        <caption>30-day history and 6-month cash flow projection</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Revenue (INR)</th>
            <th scope="col">NDVI</th>
            <th scope="col">Basis</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.dayOffset}>
              <td>{formatDayOffset(point.dayOffset)}</td>
              <td>{formatINRFull(point.actual ?? point.projected ?? 0)}</td>
              <td>{point.ndviActual != null ? point.ndviActual.toFixed(2) : "N/A"}</td>
              <td>{point.actual != null ? "Actual" : "Projected"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function AreaView({ financials, climate, historyData }: RiskChartProps) {
  const { isCritical, series, options } = useMemo(() => {
    const { data, criticalThreshold, isCritical, minDayOffset } = buildTimeline(
      financials,
      climate,
      historyData
    );
    const values = data.flatMap((d) => [d.actual, d.projected]).filter((v): v is number => v != null);
    const minValue = Math.min(...values, criticalThreshold);
    const maxValue = Math.max(...values);
    const yTicks = niceTicks(minValue - (maxValue - minValue) * 0.1, maxValue, 5);
    const yDomain: [number, number] = [yTicks[0], yTicks[yTicks.length - 1]];

    const series = [
      { name: "Actual Revenue", data: data.map((d) => ({ x: d.dayOffset, y: d.actual })) },
      { name: "Projected Revenue", data: data.map((d) => ({ x: d.dayOffset, y: d.projected })) },
    ];

    const options: ApexOptions = {
      chart: {
        type: "area",
        fontFamily: FONT,
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true, speed: 500 },
      },
      colors: [COLORS.emerald, COLORS.slate],
      stroke: { curve: "straight", width: [2, 2], dashArray: [0, 6] },
      fill: {
        type: "gradient",
        gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0, stops: [0, 90, 100] },
      },
      grid: { borderColor: COLORS.grid, strokeDashArray: 3 },
      markers: { size: 0 },
      xaxis: {
        type: "numeric",
        min: minDayOffset,
        max: PROJECTION_MONTHS * DAYS_PER_MONTH,
        tickAmount: 7,
        labels: {
          formatter: (v) => formatDayOffset(Number(v)),
          style: { colors: COLORS.muted, fontSize: "12px" },
        },
        axisBorder: { color: COLORS.grid },
        axisTicks: { color: COLORS.grid },
      },
      yaxis: {
        min: yDomain[0],
        max: yDomain[1],
        tickAmount: 4,
        labels: { formatter: (v) => formatINR(v), style: { colors: COLORS.muted, fontSize: "12px" } },
      },
      annotations: {
        yaxis: [{ y: criticalThreshold, borderColor: COLORS.red, strokeDashArray: 4 }],
      },
      legend: { show: false },
      tooltip: {
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          const point = data[dataPointIndex];
          if (!point) return "";
          const rows: { color: string; text: string }[] = [];
          if (point.actual != null) rows.push({ color: COLORS.emerald, text: `${formatINRFull(point.actual)} (Actual)` });
          if (point.projected != null) rows.push({ color: COLORS.slate, text: `${formatINRFull(point.projected)} (Projected)` });
          return tooltipShell(rows, formatDayOffset(point.dayOffset));
        },
      },
    };

    return { isCritical, series, options };
  }, [financials, climate, historyData]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-xs text-onyx/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.emerald }} />
          Actual revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.slate }} />
          Projected revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 border-t-2 border-dashed"
            style={{ borderColor: COLORS.red }}
          />
          Critical threshold
        </span>
      </div>

      {isCritical && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
          Projected revenue falls below the critical cash flow threshold by month 6.
        </p>
      )}

      <div className="mt-4 h-80 w-full sm:h-96">
        <ApexChart options={options} series={series} type="area" height="100%" width="100%" />
      </div>
    </>
  );
}

function BarView({ financials, climate, historyData }: RiskChartProps) {
  const { isCritical, series, options } = useMemo(() => {
    const { data, criticalThreshold, isCritical } = buildBarSeries(financials, climate, historyData);

    const series = [
      {
        name: "Revenue",
        data: data.map((point) => ({
          x: point.label,
          y: Math.round(point.value),
          fillColor: point.isProjected ? COLORS.slate : COLORS.emerald,
        })),
      },
    ];

    const options: ApexOptions = {
      chart: {
        type: "bar",
        fontFamily: FONT,
        toolbar: { show: false },
        animations: { enabled: true, speed: 500 },
      },
      plotOptions: { bar: { columnWidth: "55%", borderRadius: 4, borderRadiusApplication: "end" } },
      dataLabels: { enabled: false },
      grid: { borderColor: COLORS.grid, strokeDashArray: 3 },
      xaxis: {
        labels: { style: { colors: COLORS.muted, fontSize: "12px" } },
        axisBorder: { color: COLORS.grid },
        axisTicks: { color: COLORS.grid },
      },
      yaxis: {
        labels: { formatter: (v) => formatINR(v), style: { colors: COLORS.muted, fontSize: "12px" } },
      },
      annotations: {
        yaxis: [{ y: criticalThreshold, borderColor: COLORS.red, strokeDashArray: 4 }],
      },
      legend: { show: false },
      tooltip: {
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          const point = data[dataPointIndex];
          if (!point) return "";
          return tooltipShell(
            [
              {
                color: point.isProjected ? COLORS.slate : COLORS.emerald,
                text: `${formatINRFull(point.value)}${point.isProjected ? " (Projected)" : " (Current)"}`,
              },
            ],
            point.label
          );
        },
      },
    };

    return { isCritical, series, options };
  }, [financials, climate, historyData]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-xs text-onyx/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: COLORS.emerald }} />
          Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: COLORS.slate }} />
          Projected
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 border-t-2 border-dashed"
            style={{ borderColor: COLORS.red }}
          />
          Critical threshold
        </span>
      </div>

      {isCritical && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
          Projected revenue falls below the critical cash flow threshold by month 6.
        </p>
      )}

      <div className="mt-4 h-80 w-full sm:h-96">
        <ApexChart options={options} series={series} type="bar" height="100%" width="100%" />
      </div>
    </>
  );
}

function RiskProfileView({ financials, climate }: RiskChartProps) {
  const { data, weakMetrics, series, options } = useMemo(() => {
    const data = buildRiskProfile(financials, climate);
    const weakMetrics = data.filter((d) => d.value < 40);

    const series = [{ name: "Health Score", data: data.map((d) => d.value) }];

    const options: ApexOptions = {
      chart: { type: "radar", fontFamily: FONT, toolbar: { show: false }, animations: { enabled: true, speed: 500 } },
      colors: [COLORS.lime],
      stroke: { width: 2 },
      fill: { opacity: 0.3 },
      markers: { size: 3, colors: [COLORS.lime], strokeColors: "#fff", strokeWidth: 2 },
      xaxis: {
        categories: data.map((d) => d.metric),
        labels: { style: { colors: COLORS.muted, fontSize: "11px" } },
      },
      yaxis: { min: 0, max: 100, tickAmount: 4, labels: { style: { colors: COLORS.muted, fontSize: "10px" } } },
      plotOptions: { radar: { polygons: { strokeColors: COLORS.grid, connectorColors: COLORS.grid } } },
      legend: { show: false },
      tooltip: {
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          const point = data[dataPointIndex];
          if (!point) return "";
          return tooltipShell([{ color: COLORS.lime, text: `${point.value} / 100` }], point.metric);
        },
      },
    };

    return { data, weakMetrics, series, options };
  }, [financials, climate]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-xs text-onyx/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.lime }} />
          Normalized health score (0–100, higher is healthier)
        </span>
      </div>

      {weakMetrics.length > 0 && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
          {weakMetrics.length === 1
            ? `${weakMetrics[0].metric} is in a weak range (below 40/100).`
            : `${weakMetrics.length} signals are in a weak range (below 40/100): ${weakMetrics
                .map((m) => m.metric)
                .join(", ")}.`}
        </p>
      )}

      <div className="mt-4 h-80 w-full sm:h-96">
        <ApexChart options={options} series={series} type="radar" height="100%" width="100%" />
      </div>

      <table className="sr-only">
        <caption>Composite risk profile, normalized 0-100 per signal</caption>
        <thead>
          <tr>
            <th scope="col">Signal</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.metric}>
              <td>{point.metric}</td>
              <td>{point.value} / 100</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function RiskChart(props: RiskChartProps) {
  const [mode, setMode] = useState<ChartMode>("line");
  const meta = MODE_META[mode];

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold text-onyx">{meta.title}</h2>
          <p className="mt-0.5 text-xs text-onyx/40">{meta.subtitle}</p>
        </div>
        <ModeSelector mode={mode} onChange={setMode} />
      </div>

      {mode === "line" && <LineView {...props} />}
      {mode === "area" && <AreaView {...props} />}
      {mode === "bar" && <BarView {...props} />}
      {mode === "radar" && <RiskProfileView {...props} />}
    </div>
  );
}
