import { ArrowRight } from "@/components/icons/MaterialIcons";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Contact | GramOS",
  description: "Get in touch with the GramOS team.",
};

export default function ContactPage() {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-paper text-onyx">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-6 py-24 lg:px-8">
        <div className="w-full max-w-lg text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-600">
            Contact
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-onyx sm:text-4xl">
            Get in touch
          </h1>
          <p className="mt-4 text-base leading-7 text-onyx/60">
            Questions about GramOS, a pilot walkthrough, or a partnership
            enquiry — reach us directly and we&rsquo;ll get back to you.
          </p>
          <a
            href="mailto:sudarshankulkarni812@gmail.com"
            className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-md bg-lime-300 px-6 py-3 text-sm font-semibold text-onyx shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-lime-200 hover:shadow-md active:translate-y-0 active:shadow-sm"
          >
            sudarshankulkarni812@gmail.com
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
