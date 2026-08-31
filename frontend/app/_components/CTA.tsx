import { ArrowRight } from "@/components/icons/MaterialIcons";
import Reveal from "@/components/Reveal";

export default function CTA() {
  return (
    <section id="get-started" className="border-t border-black/10 bg-mist">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-20 text-center sm:py-28 lg:px-8">
        <Reveal className="flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600">
            Get started
          </p>
          <h2 className="mt-3 max-w-lg text-2xl font-semibold tracking-tight text-onyx sm:text-3xl">
            See GramOS flag risk in your portfolio
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-onyx/60">
            Open the live dashboard, pick an enterprise profile, and run
            the explainable AI risk engine yourself.
          </p>
          <a
            href="/dashboard"
            className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-md bg-lime-300 px-6 py-3 text-sm font-semibold text-onyx shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-lime-200 hover:shadow-md active:translate-y-0 active:shadow-sm"
          >
            Dashboard
            <ArrowRight className="h-4 w-4" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
