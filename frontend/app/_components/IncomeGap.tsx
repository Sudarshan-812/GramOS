import { TrendingUp } from "@/components/icons/MaterialIcons";
import Reveal from "@/components/Reveal";

export default function IncomeGap() {
  return (
    <section id="income-gap" className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-3xl px-6 lg:px-8">
        <Reveal>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600">
            What was actually there
          </h2>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-onyx sm:text-3xl">
            Every mill pays below the statutory price, in a dataset reported as
            fully paid
          </p>

          <div className="mt-6 space-y-4 text-base leading-7 text-onyx/70">
            <p>
              The official figure says 99.4 percent paid. Reconciling that
              against the statutory Fair and Remunerative Price tells a different
              story. FRP is Rs 355 per quintal at 10.25 percent recovery,
              adjusted by Rs 3.46 for every 0.1 percentage point of recovery
              above or below that line.
            </p>
            <p>
              Compare each mill&rsquo;s declared cane rate against its own FRP
              entitlement, then subtract the harvesting and transport charge the
              mill deducts before the grower is paid, an average of Rs 906 per
              tonne. On that basis all 53 mills pay below FRP. The shortfall
              totals Rs 3,183 Cr across Belagavi, Bagalkote and Vijayapura.
            </p>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-lime-400/50 bg-white p-6 shadow-sm">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-lime-700" />
            <p className="text-sm leading-6 text-onyx/80">
              A lender that sizes repayment capacity from headline cane rates
              overestimates farm household income by roughly 20 percent.
            </p>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium uppercase tracking-widest text-onyx/40">
              The counter-argument
            </h3>
            <p className="mt-3 text-sm leading-6 text-onyx/60">
              The mills would object. On their accounting, which treats the
              harvesting and transport charge as value delivered to the grower,
              only 4 of 53 fall short of FRP. This write-up uses the
              farmer-received basis, because that is the cash that actually
              reaches the household.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
