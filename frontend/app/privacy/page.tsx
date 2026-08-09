import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Privacy Policy | GramOS",
  description: "How GramOS collects, uses, and protects data.",
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

export default function PrivacyPage() {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-paper text-onyx">
      <Navbar />

      <main className="flex-1 px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-onyx sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-onyx/40">
            Last updated 8 August 2026
          </p>

          <Section title="Overview">
            <p>
              GramOS is a risk-assessment platform for lenders serving rural
              micro-enterprises. This policy explains what data we collect
              through the GramOS platform, why we collect it, and how it is
              used and protected.
            </p>
          </Section>

          <Section title="What we collect">
            <p>
              <strong className="font-medium text-onyx">
                Account information:
              </strong>{" "}
              email address and authentication credentials, used to sign in
              to the dashboard.
            </p>
            <p>
              <strong className="font-medium text-onyx">
                Enterprise and financial data:
              </strong>{" "}
              information entered or uploaded by a lender about a borrower
              enterprise — revenue, transaction activity, credit utilization,
              and repayment history — used to generate a risk assessment.
            </p>
            <p>
              <strong className="font-medium text-onyx">
                Uploaded documents:
              </strong>{" "}
              bank statements, KCC passbooks, invoices, or similar records a
              lender chooses to upload are processed to extract
              underwriting-relevant fields.
            </p>
            <p>
              <strong className="font-medium text-onyx">
                Climate and location data:
              </strong>{" "}
              satellite and ground-observation signals (vegetation, rainfall,
              soil moisture, groundwater) tied to an enterprise&rsquo;s
              district or taluk, not to any individual.
            </p>
          </Section>

          <Section title="How we use it">
            <p>
              Data is used solely to generate the risk assessments and
              dashboard analytics a lender requests, and to maintain an audit
              trail of any manual score overrides. We do not sell data to
              third parties, and we do not use uploaded documents or
              financial data for any purpose beyond producing the requested
              risk assessment.
            </p>
          </Section>

          <Section title="Third-party processing">
            <p>
              GramOS relies on a small number of infrastructure providers to
              operate:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="font-medium text-onyx">
                  Google (Gemini API):
                </strong>{" "}
                financial, climate, and document data is sent to Google&rsquo;s
                Gemini models to generate the explainable risk narrative and
                extract document fields.
              </li>
              <li>
                <strong className="font-medium text-onyx">Supabase:</strong>{" "}
                account authentication and application data are stored via
                Supabase&rsquo;s hosted Postgres and auth infrastructure.
              </li>
            </ul>
            <p>
              Each provider processes data under its own data-processing
              terms; GramOS does not share data with any party beyond what is
              required to operate these features.
            </p>
          </Section>

          <Section title="Data retention and security">
            <p>
              Data is retained for as long as an account remains active, or
              as needed to maintain the audit trail required for lending
              compliance. We apply standard access controls (authenticated,
              per-user API access) to all stored data. As an early-stage
              platform, GramOS has not yet completed a formal third-party
              security audit or certification.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You may request access to, correction of, or deletion of your
              account data at any time by contacting us. Enterprise financial
              data uploaded by a lender is controlled by that lender; requests
              regarding borrower data should be directed to the lending
              institution first.
            </p>
          </Section>

          <Section title="Children's data">
            <p>
              GramOS is a business-to-business platform for lending
              institutions and is not directed at, or knowingly used by,
              individuals under the age of 18.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy as GramOS evolves. Material changes
              will be reflected by updating the date at the top of this page.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy or a data request can be sent to{" "}
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
