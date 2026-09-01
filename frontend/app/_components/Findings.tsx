import Reveal from "@/components/Reveal";

const stats = [
  {
    value: "0.62%",
    label: "real arrears across 53 mills, on Rs 18,071 Cr payable for the 2025-26 season",
  },
  {
    value: "40 to 50%",
    label: "the arrears rate the original model was built to expect",
  },
  {
    value: "35 of 53",
    label: "mills that had paid growers in full by the time the RTI response arrived",
  },
];

export default function Findings() {
  return (
    <section id="findings" className="border-y border-black/10 bg-mist py-20 sm:py-28">
      <div className="mx-auto w-full max-w-5xl px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600">
            What the data said
          </h2>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-onyx sm:text-3xl">
            The hypothesis was wrong
          </p>
        </Reveal>

        <Reveal className="mt-12 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
          {stats.map(({ value, label }) => (
            <div
              key={value}
              className="flex h-full flex-col rounded-2xl border border-black/10 bg-white px-5 py-6 text-center shadow-sm"
            >
              <dd className="text-3xl font-semibold tracking-tight text-onyx">
                {value}
              </dd>
              <dt className="mt-2 text-xs leading-5 text-onyx/50">{label}</dt>
            </div>
          ))}
        </Reveal>

        <Reveal delay={150} className="mx-auto mt-10 max-w-2xl">
          <div className="space-y-4 text-base leading-7 text-onyx/70">
            <p>
              Arrears in Karnataka for the 2025-26 season carry almost no
              discriminative power as a credit signal. Nearly every rupee owed
              had already been paid by the time the RTI response landed. Only 2
              of the 53 mills paid less than 98 percent of what they owed.
            </p>
            <p>
              A signal that reads zero for most of the population cannot separate
              good borrowers from bad ones. The correlated-shock event the engine
              was built to catch did not happen at any scale worth pricing.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
