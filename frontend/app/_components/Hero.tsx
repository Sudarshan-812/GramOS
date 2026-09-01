import { ArrowRight } from "@/components/icons/MaterialIcons";

const GITHUB_URL = "https://github.com/Sudarshan-812/GramOS";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center lg:px-8 lg:py-28">
        <span className="animate-rise inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-onyx/40 shadow-sm">
          Agri-credit risk research
        </span>

        <h1
          className="animate-rise mt-6 max-w-2xl text-balance text-[1.9rem] font-normal leading-snug tracking-[-0.03em] text-onyx sm:text-5xl sm:leading-[1.15]"
          style={{ animationDelay: "0.08s" }}
        >
          What mill payment data actually says about rural credit risk
        </h1>

        <p
          className="animate-rise mt-6 max-w-xl text-pretty text-base leading-7 text-onyx/60 sm:text-lg"
          style={{ animationDelay: "0.16s" }}
        >
          I filed an RTI for Karnataka sugar mill payment records to test whether
          mill arrears predict farmer default. The data said no. It said
          something more interesting instead.
        </p>

        <div
          className="animate-rise mt-8 flex flex-col items-center gap-4 sm:flex-row"
          style={{ animationDelay: "0.24s" }}
        >
          <a
            href="#findings"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-lime-300 px-6 py-3 text-sm font-semibold text-onyx shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-lime-200 hover:shadow-md active:translate-y-0 active:shadow-sm"
          >
            Read the findings
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-onyx/80 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:text-onyx hover:shadow-md active:translate-y-0 active:shadow-sm"
          >
            <GithubMark className="h-4 w-4" />
            Source on GitHub
          </a>
        </div>

        <a
          href="/dashboard"
          className="animate-rise mt-5 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-onyx/60 transition hover:text-onyx"
          style={{ animationDelay: "0.3s" }}
        >
          Explore the prototype dashboard
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  );
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
