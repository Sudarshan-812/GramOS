import Image from "next/image";

const NAV_LINKS = [
  { href: "#architecture", label: "Architecture" },
  { href: "#features", label: "Platform" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-700/60 bg-onyx/90 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-2.5 lg:px-8">
        <a href="#top" className="flex cursor-pointer items-center gap-2">
          <Image
            src="/GramOStpt.png"
            alt="GramOS"
            width={1024}
            height={1024}
            className="h-6 w-6"
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-slate-50">
            GramOS
          </span>
        </a>

        <div className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="cursor-pointer transition hover:text-slate-50"
            >
              {label}
            </a>
          ))}
        </div>

        <a
          href="#demo"
          className="inline-flex cursor-pointer items-center rounded-full bg-amber-400 px-4 py-1.5 text-sm font-semibold text-onyx transition hover:bg-amber-300"
        >
          Request Demo
        </a>
      </nav>
    </header>
  );
}
