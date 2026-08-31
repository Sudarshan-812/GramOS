import {
  CheckCircle2,
  ClipboardList,
  Database,
  FileWarning,
  Landmark,
  Satellite,
  Sparkles,
  TrendingUp,
} from "@/components/icons/MaterialIcons";
import Reveal from "@/components/Reveal";

const legacyPoints = [
  "Static credit bureau scores, updated quarterly at best",
  "No visibility into informal or cash-based income",
  "Blind to climate and weather shocks on repayment ability",
  "Risk flagged only after a payment is missed",
];

const gramosPoints = [
  "UPI transaction logs & KCC utilization, fused in real time",
  "Alternative data: mobile money, utility, and input purchases",
  "AlphaEarth satellite metrics on rainfall, soil, and vegetation",
  "Gemini reasoning designed to flag risk before it hits repayment data",
];

export default function Architecture() {
  return (
    <section id="architecture" className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <Reveal className="mx-auto max-w-xl text-center">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600">
            Architecture
          </h2>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-onyx sm:text-3xl">
            Legacy credit scoring can&rsquo;t see rural risk coming
          </p>
          <p className="mt-4 text-base leading-7 text-onyx/60">
            GramOS fuses structured transaction data with real-time earth
            observation, then reasons over both with Gemini.
          </p>
        </Reveal>

        <Reveal className="mt-12 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
          {/* Legacy */}
          <div className="h-full rounded-2xl border border-black/10 bg-white p-8 shadow-sm transition hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mist">
                <Landmark className="h-4 w-4 text-onyx/40" />
              </div>
              <h3 className="text-sm font-medium uppercase tracking-widest text-onyx/40">
                Legacy Scoring
              </h3>
            </div>
            <ul className="mt-6 space-y-4">
              {legacyPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <FileWarning className="mt-1 h-3.5 w-3.5 shrink-0 text-onyx/30" />
                  <span className="text-sm leading-6 text-onyx/60">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* GramOS */}
          <div className="h-full rounded-2xl border border-lime-400/50 bg-white p-8 shadow-sm transition hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-100">
                <Database className="h-4 w-4 text-lime-700" />
              </div>
              <h3 className="text-sm font-medium uppercase tracking-widest text-lime-700">
                GramOS
              </h3>
            </div>
            <ul className="mt-6 space-y-4">
              {gramosPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-lime-600" />
                  <span className="text-sm leading-6 text-onyx/80">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* Pipeline strip */}
        <Reveal delay={200}>
          <div className="mt-5 flex flex-col items-stretch justify-center gap-1 rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm sm:flex-row sm:items-center sm:gap-0">
            <PipelineStep icon={ClipboardList} label="UPI Transaction Logs" />
            <PipelineArrow />
            <PipelineStep icon={Satellite} label="AlphaEarth Satellite Metrics" />
            <PipelineArrow />
            <PipelineStep
              icon={Sparkles}
              label="Gemini Reasoning Engine"
              highlight
            />
            <PipelineArrow />
            <PipelineStep icon={TrendingUp} label="Explainable Risk Score" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function PipelineStep({
  icon: Icon,
  label,
  highlight = false,
}: {
  icon: typeof Sparkles;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2.5 px-4 py-2 text-center">
      <Icon
        className={`h-4 w-4 shrink-0 ${
          highlight ? "text-lime-600" : "text-onyx/35"
        }`}
      />
      <span
        className={`text-xs font-medium uppercase tracking-wider ${
          highlight ? "text-lime-700" : "text-onyx/50"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function PipelineArrow() {
  return (
    <div aria-hidden className="mx-auto h-4 w-px bg-black/10 sm:h-px sm:w-8" />
  );
}
