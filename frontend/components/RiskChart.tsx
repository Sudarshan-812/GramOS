"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
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
  slateGrid: "#e2e8f0",
  red: "#ef4444", // critical climate threshold
  ink: "#0f172a",
  muted: "#64748b",
};

const PROJECTION_MONTHS = 6;
const DAYS_PER_MONTH = 30;

interface TimelinePoint {
  dayOffset: number;
  actual: number | null;
  ndviActual: number | null;
  projected: number | null;
  criticalThreshold: number;
}

function formatDayOffset(value: number): string {
  if (value === 0) return "Today";
  if (value < 0) return `D${value}`;
  return `M+${Math.round(value / DAYS_PER_MONTH)}`;
}

function buildTimeline(
  financials: FinancialProfile,
  climate: ClimateProfile,
  historyData: HistoryPoint[]
): { data: TimelinePoint[]; criticalThreshold: number; isCritical: boolean; minDayOffset: number } {
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

  const criticalThreshold = baseline * 0.5;

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
    const projected = baseline * (1 - (combinedImpact * monthNumber) / PROJECTION_MONTHS);
    return {
      dayOffset: monthNumber * DAYS_PER_MONTH,
      actual: null,
      ndviActual: null,
      projected,
      criticalThreshold,
    };
  });

  const data = [...historicalPoints, ...projectedPoints];
  const finalProjected = projectedPoints[projectedPoints.length - 1]?.projected ?? baseline;
  const minDayOffset = historicalPoints[0]?.dayOffset ?? 0;
  return { data, criticalThreshold, isCritical: finalProjected < criticalThreshold, minDayOffset };
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

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entries = payload.filter((p) => p.value != null);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-slate-500">
        {formatDayOffset(Number(label))}
      </p>
      <div className="mt-1 space-y-1">
        {entries.map((entry, idx) => {
          const isNdvi = entry.dataKey === "ndviActual";
          const isProjected = entry.dataKey === "projected";
          const color = isNdvi || isProjected ? COLORS.slate : COLORS.emerald;
          const text = isNdvi
            ? `NDVI ${Number(entry.value).toFixed(2)}`
            : `${formatINRFull(Number(entry.value))} (${isProjected ? "Projected" : "Actual"})`;
          return (
            <div key={idx} className="flex items-center gap-2">
              <span className="h-0.5 w-3 shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm font-semibold text-slate-900">{text}</span>
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
        stroke="#fff"
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
      <circle cx={cx} cy={cy} r={4} fill={COLORS.emerald} stroke="#fff" strokeWidth={2} />
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

export default function RiskChart({ financials, climate, historyData }: RiskChartProps) {
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            30-Day History &amp; 6-Month Cash Flow Projection
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Day &minus;30 to today: actual revenue &amp; NDVI trend from Supabase. Months
            +1&ndash;6: projected against climate stress signals.
          </p>
        </div>
        {/* Legend: line keys, not boxes */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
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
              <td>{point.ndviActual != null ? point.ndviActual.toFixed(2) : "—"}</td>
              <td>{point.actual != null ? "Actual" : "Projected"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
