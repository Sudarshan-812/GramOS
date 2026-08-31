import Image from "next/image";
import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
];

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-black/5 bg-paper">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <a href="#top" className="flex cursor-pointer items-center gap-2">
            <Image
              src="/gramos-mark.png"
              alt="GramOS"
              width={442}
              height={442}
              className="h-5 w-5"
            />
            <span className="font-mono font-semibold text-onyx/80">GramOS</span>
          </a>
          <nav className="flex items-center gap-6 text-sm text-onyx/50">
            {FOOTER_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="cursor-pointer transition hover:text-onyx"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col items-center justify-between gap-2 border-t border-black/5 pt-6 text-sm text-onyx/50 sm:flex-row">
          <span>© {new Date().getFullYear()} GramOS. All rights reserved.</span>
          <span>Powered by Gemini &amp; Google AlphaEarth</span>
        </div>
      </div>
    </footer>
  );
}
