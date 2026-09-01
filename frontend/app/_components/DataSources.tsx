import Reveal from "@/components/Reveal";

const rows = [
  {
    source: "Karnataka Cane Commissionerate RTI",
    detail:
      "Ref. SECCI/R/2026/60049, received 2026-08-23. 53 sugar mills, 2025-26 season, Belagavi / Bagalkote / Vijayapura.",
    real: true,
  },
  {
    source: "India-WRIS monitoring stations",
    detail:
      "District rainfall from rain-gauge readings and groundwater borewell depth, from indiawris.gov.in.",
    real: true,
  },
  {
    source: "Per-enterprise financial ledgers",
    detail:
      "UPI volume, DPD, KCC utilisation. Seeded deterministically per taluk, scaled to that taluk's real stress level.",
    real: false,
  },
  {
    source: "NDVI and soil moisture",
    detail:
      "Placeholder for a satellite climate integration that was scoped but never built.",
    real: false,
  },
];

export default function DataSources() {
  return (
    <section id="sources" className="border-y border-black/10 bg-mist py-20 sm:py-28">
      <div className="mx-auto w-full max-w-4xl px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600">
            Data sources
          </h2>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-onyx sm:text-3xl">
            Two inputs are real. Two are synthetic. Both are labelled.
          </p>
        </Reveal>

        <Reveal delay={100} className="mt-10">
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wider text-onyx/40">
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">
                    Detail
                  </th>
                  <th className="px-5 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ source, detail, real }) => (
                  <tr
                    key={source}
                    className={`border-b border-black/5 last:border-0 ${
                      real ? "" : "bg-mist/60"
                    }`}
                  >
                    <td
                      className={`px-5 py-4 align-top font-medium ${
                        real ? "text-onyx" : "text-onyx/45"
                      }`}
                    >
                      {source}
                      <p
                        className={`mt-1 font-normal sm:hidden ${
                          real ? "text-onyx/55" : "text-onyx/35"
                        }`}
                      >
                        {detail}
                      </p>
                    </td>
                    <td
                      className={`hidden px-5 py-4 align-top leading-6 sm:table-cell ${
                        real ? "text-onyx/55" : "text-onyx/35"
                      }`}
                    >
                      {detail}
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                          real
                            ? "bg-lime-100 text-lime-700"
                            : "bg-black/5 text-onyx/40"
                        }`}
                      >
                        {real ? "Real" : "Synthetic"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
