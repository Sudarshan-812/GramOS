import { ArrowRight } from "@/components/icons/MaterialIcons";
import Reveal from "@/components/Reveal";

const BACKTEST_URL =
  "https://github.com/Sudarshan-812/GramOS/blob/main/BACKTEST.md";

export default function Limitations() {
  return (
    <section id="limits" className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-3xl px-6 lg:px-8">
        <Reveal>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600">
            What this does not show
          </h2>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-onyx sm:text-3xl">
            A wired signal is not a validated one
          </p>

          <div className="mt-6 space-y-4 text-base leading-7 text-onyx/70">
            <p>
              The RTI data is a single season-end snapshot, 99.4 percent of it
              already paid by the time it arrived. The ablation study in
              BACKTEST.md confirms the buyer-payment term is bounded, monotonic,
              and tracks real rupee arrears with a Spearman rho of 0.88 against
              the final score. It flips the risk band for 7 of 21 taluks, every
              move upward, every move in a taluk with real arrears, with zero
              spurious moves.
            </p>
            <p>
              That is not predictive validation. It cannot show the signal
              forecasts borrower repayment stress 60 to 120 days out, or that it
              adds lift over a bureau score. The synthetic features here were
              seeded to co-vary with RTI stress. Establishing real predictive
              power requires backtesting against real, anonymised
              loan-repayment data from a lending partner, which has not
              happened.
            </p>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <a
            href={BACKTEST_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-lime-700 transition hover:text-lime-800"
          >
            Read the full ablation study
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
