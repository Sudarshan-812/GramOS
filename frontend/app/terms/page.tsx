import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Terms & Conditions | GramOS",
  description: "Terms of use for the GramOS platform.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-onyx">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-base leading-7 text-onyx/60">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-paper text-onyx">
      <Navbar />

      <main className="flex-1 px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-onyx sm:text-4xl">
            Terms &amp; Conditions
          </h1>
          <p className="mt-4 text-sm text-onyx/40">
            Last updated 8 August 2026
          </p>

          <Section title="Acceptance of terms">
            <p>
              By creating an account or otherwise using GramOS, you agree to
              these terms. If you are using GramOS on behalf of a lending
              institution, you represent that you have authority to bind that
              institution to these terms.
            </p>
          </Section>

          <Section title="What GramOS is">
            <p>
              GramOS is a decision-support platform that generates risk
              assessments for rural micro-enterprise borrowers by combining
              financial data, climate/satellite signals, and AI-generated
              analysis (via Google&rsquo;s Gemini models). Risk scores and
              narratives produced by GramOS are{" "}
              <strong className="font-medium text-onyx">
                advisory, not determinative
              </strong>
              . GramOS does not make lending decisions, and every AI-generated
              score can be manually overridden by a loan officer, with the
              override logged to an audit trail.
            </p>
          </Section>

          <Section title="Your responsibilities">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                You are responsible for the accuracy of any financial data,
                documents, or borrower information you enter or upload.
              </li>
              <li>
                You are responsible for keeping your account credentials
                confidential and for all activity under your account.
              </li>
              <li>
                You remain solely responsible for your own lending decisions
                and for compliance with applicable lending regulations —
                GramOS output does not substitute for your institution&rsquo;s
                own underwriting judgment or regulatory obligations.
              </li>
            </ul>
          </Section>

          <Section title="Data ownership">
            <p>
              You (or your institution) retain ownership of any borrower and
              enterprise data you submit to GramOS. We process it only to
              provide the platform&rsquo;s features, as described in our{" "}
              <a
                href="/privacy"
                className="font-medium text-lime-700 underline decoration-lime-300 underline-offset-2 hover:text-lime-800"
              >
                Privacy Policy
              </a>
              .
            </p>
          </Section>

          <Section title="No warranty">
            <p>
              GramOS is provided &ldquo;as is,&rdquo; as an early-stage
              platform under active development. We do not warrant that risk
              scores or AI-generated narratives are accurate, complete, or
              free of error, and we disclaim liability for lending decisions
              made in reliance on GramOS output.
            </p>
          </Section>

          <Section title="Intellectual property">
            <p>
              The GramOS platform, including its risk-scoring methodology,
              design, and software, is owned by GramOS. These terms do not
              grant you any rights to our intellectual property beyond the
              right to use the platform as intended.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              We may suspend or terminate access to GramOS for any account
              found to be misusing the platform or violating these terms.
            </p>
          </Section>

          <Section title="Governing law">
            <p>These terms are governed by the laws of India.</p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms as GramOS evolves. Material changes
              will be reflected by updating the date at the top of this page.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms can be sent to{" "}
              <a
                href="mailto:sudarshankulkarni812@gmail.com"
                className="font-medium text-lime-700 underline decoration-lime-300 underline-offset-2 hover:text-lime-800"
              >
                sudarshankulkarni812@gmail.com
              </a>
              .
            </p>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
