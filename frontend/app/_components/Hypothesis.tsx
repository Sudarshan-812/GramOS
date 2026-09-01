import { Satellite } from "@/components/icons/MaterialIcons";
import Reveal from "@/components/Reveal";

export default function Hypothesis() {
  return (
    <section id="hypothesis" className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-3xl px-6 lg:px-8">
        <Reveal>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600">
            The hypothesis
          </h2>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-onyx sm:text-3xl">
            A mill that stops paying takes a whole catchment down at once
          </p>

          <div className="mt-6 space-y-4 text-base leading-7 text-onyx/70">
            <p>
              Sugar mills must pay growers within 14 days of cane supply, by
              statute. When a mill delays that payment, every household in its
              catchment absorbs the same cash-flow shock in the same week.
              Conventional credit models treat each borrower as an independent
              risk, so they miss it entirely.
            </p>
            <p>
              Satellite crop monitoring misses it too, because the standing crop
              looks healthy. The buyer simply has not paid. I built a
              deterministic risk engine on that premise: map each mill&rsquo;s
              arrears to its catchment taluks, and price every borrower there as
              correlated risk, 60 to 120 days before it would surface as a missed
              instalment.
            </p>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <Satellite className="mt-0.5 h-4 w-4 shrink-0 text-onyx/35" />
            <p className="text-sm leading-6 text-onyx/60">
              This was the thesis under test, not an established fact. The rest of
              this page is what the RTI data did to it.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
