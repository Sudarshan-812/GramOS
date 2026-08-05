"use client";

import { useState } from "react";
import {
  AreaChart as AreaChartIcon,
  BarChart3 as BarChartIcon,
  LineChart as LineChartIcon,
  Radar as RadarIcon,
} from "@/components/icons/MaterialIcons";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar as RadarSeries,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { ClimateProfile, FinancialProfile, HistoryPoint } from "@/lib/types";

interface RiskChartProps {
  financials: FinancialProfile;
  climate: ClimateProfile;
  historyData: HistoryPoint[];
}

const COLORS = {
  emerald: "#10b981", // historical + actual revenue
  slate: "#94a3b8", // projected revenue / historical NDVI
  slateGrid: "#e5e7eb",
  red: "#ef4444", // critical climate threshold
  gold: "#65a30d",
  ink: "#121412",
  muted: "#78716c",
};

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

function formatDayOffset(value: number): string {
  if (value === 0) return "Today";
  if (value < 0) return `D${value}`;
  return `M+${Math.round(value / DAYS_PER_MONTH)}`;
}

function formatINR(value: number): string {
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
  fullMark: number;
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
  return points.map(([metric, value]) => ({ metric, value: Math.round(value), fullMark: 100 }));
}

// --- Tooltip ---------------------------------------------------------------

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entries = payload.filter((p) => p.value != null);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 shadow-lg shadow-black/10">
      <p className="text-xs font-medium text-onyx/40">
        {typeof label === "number" ? formatDayOffset(label) : label}
      </p>
      <div className="mt-1 space-y-1">
        {entries.map((entry, idx) => {
          const isNdvi = entry.dataKey === "ndviActual";
          const isProjected = entry.dataKey === "projected";
          const color = isNdvi || isProjected ? COLORS.slate : entry.color ?? COLORS.emerald;
          const text = isNdvi
            ? `NDVI ${Number(entry.value).toFixed(2)}`
            : entry.dataKey === "value" && typeof entry.payload?.metric === "string"
              ? `${entry.value} / 100`
              : `${formatINRFull(Number(entry.value))}${
                  isProjected ? " (Projected)" : entry.dataKey === "actual" ? " (Actual)" : ""
                }`;
          return (
            <div key={idx} className="flex items-center gap-2">
              <span className="h-0.5 w-3 shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm font-semibold text-onyx">{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: TimelinePoint;
}

function ProjectedDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload || payload.projected == null) return null;
  if (payload.actual != null) return null; // avoid double-drawing at the hand-off point
  const isCritical = payload.projected < payload.criticalThreshold;
  const isLast = payload.dayOffset === PROJECTION_MONTHS * DAYS_PER_MONTH;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={isLast ? 5 : 4}
        fill={isCritical ? COLORS.red : COLORS.slate}
        stroke="#ffffff"
        strokeWidth={2}
      />
      {isLast && (
        <text
          x={cx - 8}
          y={cy - 10}
          textAnchor="end"
          className="text-[11px] font-semibold"
          fill={isCritical ? COLORS.red : COLORS.ink}
        >
          {formatINR(payload.projected)}
        </text>
      )}
    </g>
  );
}

function ActualDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload || payload.actual == null) return null;
  const isLast = payload.dayOffset === 0; // today, hand-off into the projection
  if (!isLast) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={COLORS.emerald} stroke="#ffffff" strokeWidth={2} />
      <text
        x={cx}
        y={cy - 14}
        textAnchor="middle"
        className="text-[11px] font-semibold"
        fill={COLORS.ink}
      >
        {formatINR(payload.actual)}
      </text>
    </g>
  );
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
  const projectionTicks = Array.from(
    { length: PROJECTION_MONTHS },
    (_, i) => (i + 1) * DAYS_PER_MONTH
  );
  const xTicks = hasHistory
    ? [minDayOffset, Math.round(minDayOffset / 2), 0, ...projectionTicks]
    : [0, ...projectionTicks];

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-xs text-onyx/50">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ backgroundColor: COLORS.emerald }} />
          Historical revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2" style={{ borderColor: COLORS.slate }} />
          Historical NDVI
        </span>
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

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={COLORS.slateGrid} />
            <XAxis
              dataKey="dayOffset"
              type="number"
              domain={[minDayOffset, PROJECTION_MONTHS * DAYS_PER_MONTH]}
              ticks={xTicks}
              tickFormatter={formatDayOffset}
              tickLine={false}
              axisLine={{ stroke: COLORS.slateGrid }}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
            />
            <YAxis
              yAxisId="revenue"
              tickLine={false}
              axisLine={false}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              tickFormatter={formatINR}
              domain={yDomain}
              ticks={yTicks}
              width={56}
            />
            {hasHistory && (
              <YAxis
                yAxisId="ndvi"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={{ fill: COLORS.muted, fontSize: 12 }}
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                width={40}
              />
            )}
            <Tooltip content={(props) => <ChartTooltip {...props} />} />
            <ReferenceLine
              yAxisId="revenue"
              y={criticalThreshold}
              stroke={COLORS.red}
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Line
              yAxisId="revenue"
              dataKey="actual"
              stroke={COLORS.emerald}
              strokeWidth={2}
              dot={<ActualDot />}
              connectNulls={false}
              isAnimationActive={false}
            />
            {hasHistory && (
              <Line
                yAxisId="ndvi"
                dataKey="ndviActual"
                stroke={COLORS.slate}
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            <Line
              yAxisId="revenue"
              dataKey="projected"
              stroke={COLORS.slate}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={<ProjectedDot />}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
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

  const projectionTicks = Array.from(
    { length: PROJECTION_MONTHS },
    (_, i) => (i + 1) * DAYS_PER_MONTH
  );
  const xTicks = [minDayOffset, Math.round(minDayOffset / 2), 0, ...projectionTicks];

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

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="riskChartActualFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="riskChartProjectedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.slate} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLORS.slate} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={COLORS.slateGrid} />
            <XAxis
              dataKey="dayOffset"
              type="number"
              domain={[minDayOffset, PROJECTION_MONTHS * DAYS_PER_MONTH]}
              ticks={xTicks}
              tickFormatter={formatDayOffset}
              tickLine={false}
              axisLine={{ stroke: COLORS.slateGrid }}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              tickFormatter={formatINR}
              domain={yDomain}
              ticks={yTicks}
              width={56}
            />
            <Tooltip content={(props) => <ChartTooltip {...props} />} />
            <ReferenceLine
              y={criticalThreshold}
              stroke={COLORS.red}
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Area
              dataKey="actual"
              stroke={COLORS.emerald}
              strokeWidth={2}
              fill="url(#riskChartActualFill)"
              connectNulls={false}
              isAnimationActive={false}
            />
            <Area
              dataKey="projected"
              stroke={COLORS.slate}
              strokeWidth={2}
              strokeDasharray="6 4"
              fill="url(#riskChartProjectedFill)"
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function BarView({ financials, climate, historyData }: RiskChartProps) {
  const { data, criticalThreshold, isCritical } = buildBarSeries(financials, climate, historyData);
  const values = data.map((d) => d.value);
  const yTicks = niceTicks(Math.min(...values, criticalThreshold) * 0.9, Math.max(...values), 5);
  const yDomain: [number, number] = [0, yTicks[yTicks.length - 1]];

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

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={COLORS.slateGrid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: COLORS.slateGrid }}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              tickFormatter={formatINR}
              domain={yDomain}
              ticks={yTicks}
              width={56}
            />
            <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
            <ReferenceLine
              y={criticalThreshold}
              stroke={COLORS.red}
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((point) => (
                <Cell
                  key={point.label}
                  fill={point.isProjected ? COLORS.slate : COLORS.emerald}
                  fillOpacity={point.isProjected && point.value < criticalThreshold ? 0.6 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function RiskProfileView({ financials, climate }: RiskChartProps) {
  const data = buildRiskProfile(financials, climate);
  const weakMetrics = data.filter((d) => d.value < 40);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-xs text-onyx/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.gold }} />
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

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke={COLORS.slateGrid} />
            <PolarAngleAxis dataKey="metric" tick={{ fill: COLORS.muted, fontSize: 11 }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: COLORS.muted, fontSize: 10 }}
              axisLine={false}
            />
            <Tooltip content={(props) => <ChartTooltip {...props} />} />
            <RadarSeries
              dataKey="value"
              stroke={COLORS.gold}
              fill={COLORS.gold}
              fillOpacity={0.35}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
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
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
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
