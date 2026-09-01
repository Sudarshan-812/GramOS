import { ArrowRight } from "@/components/icons/MaterialIcons";

const stats = [
  { value: "Early Warning", label: "Built to flag risk before default" },
  { value: "2 sources", label: "Transaction Logs + AlphaEarth" },
  { value: "100%", label: "Explainable by Gemini" },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center lg:px-8 lg:py-28">
        <span className="animate-rise inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-onyx/40 shadow-sm">
          Built for rural credit risk
        </span>

        <h1
          className="animate-rise mt-6 max-w-2xl text-balance text-[1.75rem] font-normal leading-snug tracking-[-0.03em] text-onyx sm:text-5xl sm:leading-[1.15]"
          style={{ animationDelay: "0.08s" }}
        >
          The AI Operating System for{" "}
          <span className="relative inline whitespace-normal sm:inline-block sm:whitespace-nowrap">
            <svg
              aria-hidden
              viewBox="-8 0 320 46"
              preserveAspectRatio="none"
              className="animate-paint-stroke absolute -inset-x-3 inset-y-0 hidden h-full w-[calc(100%+1.5rem)] origin-left sm:block"
            >
              {/* under-layer, offset slightly for two-tone brush depth */}
              <path
                d="M9,17 L27,10 L47,15 L67,8 L91,13 L113,7 L137,12 L159,9 L181,14 L201,8 L219,13 L235,10 L249,16 L260,13 L253,26 L237,32 L221,28 L199,35 L177,30 L153,36 L129,32 L105,37 L81,33 L59,38 L37,33 L19,29 L11,23 Z"
                fill="#65a30d"
                fillOpacity="0.22"
              />
              {/* main stroke body — jagged torn edges, not a clean rectangle */}
              <path
                d="M6,15 L23,7 L44,12 L65,5 L88,11 L110,4 L134,10 L157,6 L179,12 L198,6 L217,11 L233,7 L246,13 L257,10 L249,23 L233,29 L217,25 L196,32 L175,27 L151,33 L127,29 L103,34 L79,30 L57,35 L35,30 L17,26 L8,21 Z"
                fill="#bef264"
              />
              {/* dry-brush fraying at the trailing edge */}
              <path
                d="M257,10 L278,5 L266,14 L284,10"
                stroke="#bef264"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.75"
              />
              <path
                d="M253,20 L274,17 L262,24 L280,22"
                stroke="#bef264"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                opacity="0.5"
              />
              <path
                d="M247,28 L266,31 L256,35"
                stroke="#bef264"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.35"
              />
              {/* paint flecks */}
              <circle cx="290" cy="8" r="1.6" fill="#bef264" opacity="0.6" />
              <circle cx="296" cy="15" r="1.2" fill="#84cc16" opacity="0.5" />
              <circle cx="287" cy="21" r="1" fill="#bef264" opacity="0.4" />
              <circle cx="298" cy="26" r="1.1" fill="#84cc16" opacity="0.35" />
            </svg>
            <span className="relative z-10 box-decoration-clone rounded-md bg-lime-200/70 px-1.5 py-0.5 sm:bg-transparent sm:px-2">
              Rural Financial Intelligence
            </span>
          </span>
        </h1>

        <p
          className="animate-rise mt-6 max-w-lg text-pretty text-base leading-7 text-onyx/60 sm:text-lg"
          style={{ animationDelay: "0.16s" }}
        >
          Predict NPA risk before it happens using climate satellite data
          and alternative transaction logs.
        </p>

        <div
          className="animate-rise mt-8 flex flex-col items-center gap-5 sm:flex-row"
          style={{ animationDelay: "0.24s" }}
        >
          <a
            href="/dashboard"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-lime-300 px-6 py-3 text-sm font-semibold text-onyx shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-lime-200 hover:shadow-md active:translate-y-0 active:shadow-sm"
          >
            Dashboard
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#architecture"
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-onyx/70 transition hover:text-onyx"
          >
            See how it works
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Stat cards */}
        <dl
          className="animate-rise mt-16 grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
          style={{ animationDelay: "0.32s" }}
        >
          {stats.map(({ value, label }) => (
            <div
              key={label}
              className="rounded-2xl border border-black/10 bg-white px-3 py-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-5"
            >
              <dd className="text-xl font-semibold tracking-tight text-onyx sm:text-2xl">
                {value}
              </dd>
              <dt className="mt-1 text-[11px] uppercase tracking-wide text-onyx/45 sm:text-xs">
                {label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
