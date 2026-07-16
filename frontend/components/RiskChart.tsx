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
import type { ClimateProfile, FinancialProfile } from "@/lib/types";

interface RiskChartProps {
  financials: FinancialProfile;
  climate: ClimateProfile;
}

const COLORS = {
  emerald: "#10b981", // stable revenue
  slate: "#94a3b8", // projected drop
  slateGrid: "#e2e8f0",
  red: "#ef4444", // critical climate threshold
  ink: "#0f172a",
  muted: "#64748b",
};

const MONTH_LABELS = ["M1", "M2", "M3", "M4", "M5", "M6"];

interface TimelinePoint {
  month: string;
  actual: number | null;
  projected: number | null;
  criticalThreshold: number;
}

function buildTimeline(
  financials: FinancialProfile,
  climate: ClimateProfile
): { data: TimelinePoint[]; criticalThreshold: number; isCritical: boolean } {
  const baseline = financials.monthly_revenue_inr;

  // Climate stress: drought (negative rainfall deviation) and poor vegetation
  // health (NDVI below a healthy 0.5) both erode future cash flow. Combine
  // them into a single 0-0.6 impact fraction applied ramping over months 4-6.
  const rainfallImpact = Math.max(0, -climate.rainfall_deviation_pct) / 100;
  const ndviImpact = Math.max(0, 0.5 - climate.ndvi_index);
  const combinedImpact = Math.min(0.6, rainfallImpact * 0.7 + ndviImpact * 1.0);

  const criticalThreshold = baseline * 0.5;

  const data: TimelinePoint[] = MONTH_LABELS.map((month, i) => {
    const monthNumber = i + 1;
    if (monthNumber <= 3) {
      return {
        month,
        actual: baseline,
        // Month 3 is duplicated onto the projected series so the two lines
        // connect visually at the hand-off point.
        projected: monthNumber === 3 ? baseline : null,
        criticalThreshold,
      };
    }
    const stepsIntoProjection = monthNumber - 3; // 1, 2, 3
    const projected = baseline * (1 - (combinedImpact * stepsIntoProjection) / 3);
    return { month, actual: null, projected, criticalThreshold };
  });

  const finalProjected = data[data.length - 1].projected ?? baseline;
  return { data, criticalThreshold, isCritical: finalProjected < criticalThreshold };
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
  const point = payload[0];
  const isProjected = point.dataKey === "projected";
  const value = Number(point.value);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span
          className="h-0.5 w-3 shrink-0"
          style={{ backgroundColor: isProjected ? COLORS.slate : COLORS.emerald }}
        />
        <span className="text-sm font-semibold text-slate-900">
          {formatINRFull(value)}
        </span>
        <span className="text-xs text-slate-500">
          {isProjected ? "Projected" : "Actual"}
        </span>
      </div>
    </div>
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: TimelinePoint;
}

function ProjectedDot({ cx, cy, index, payload }: DotProps) {
  if (cx == null || cy == null || !payload || payload.projected == null) return null;
  const isCritical = payload.projected < payload.criticalThreshold;
  const isLast = index === MONTH_LABELS.length - 1;
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
          x={cx}
          y={cy - 14}
          textAnchor="middle"
          className="text-[11px] font-semibold"
          fill={isCritical ? COLORS.red : COLORS.ink}
        >
          {formatINR(payload.projected)}
        </text>
      )}
    </g>
  );
}

function ActualDot({ cx, cy, index, payload }: DotProps) {
  if (cx == null || cy == null || !payload || payload.actual == null) return null;
  const isLast = index === 2; // month 3, last point of the "actual" series
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={COLORS.emerald} stroke="#fff" strokeWidth={2} />
      {isLast && (
        <text
          x={cx}
          y={cy - 14}
          textAnchor="middle"
          className="text-[11px] font-semibold"
          fill={COLORS.ink}
        >
          {formatINR(payload.actual)}
        </text>
      )}
    </g>
  );
}

export default function RiskChart({ financials, climate }: RiskChartProps) {
  const { data, criticalThreshold, isCritical } = buildTimeline(financials, climate);
  const values = data.flatMap((d) => [d.actual, d.projected]).filter((v): v is number => v != null);
  const minValue = Math.min(...values, criticalThreshold);
  const maxValue = Math.max(...values);
  const yTicks = niceTicks(minValue - (maxValue - minValue) * 0.1, maxValue, 5);
  const yDomain: [number, number] = [yTicks[0], yTicks[yTicks.length - 1]];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            6-Month Cash Flow Projection
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Months 1&ndash;3 actual revenue, months 4&ndash;6 projected against climate
            stress signals.
          </p>
        </div>
        {/* Legend: line keys, not boxes */}
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4" style={{ backgroundColor: COLORS.emerald }} />
            Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 border-t-2 border-dashed"
              style={{ borderColor: COLORS.slate }}
            />
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
              dataKey="month"
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
            <Line
              dataKey="actual"
              stroke={COLORS.emerald}
              strokeWidth={2}
              dot={<ActualDot />}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
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
        <caption>6-month cash flow projection by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Revenue (INR)</th>
            <th scope="col">Basis</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.month}>
              <td>{point.month}</td>
              <td>{formatINRFull(point.actual ?? point.projected ?? 0)}</td>
              <td>{point.actual != null ? "Actual" : "Projected"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
