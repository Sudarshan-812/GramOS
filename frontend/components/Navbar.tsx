"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#architecture", label: "Architecture" },
  { href: "#features", label: "Platform" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="sticky top-0 z-50 flex justify-center px-4 transition-[padding-top] duration-[600ms] ease-in-out"
      style={{ paddingTop: scrolled ? "0.5rem" : "1rem" }}
    >
      <nav
        className={`flex w-full items-center justify-between rounded-full px-5 py-2.5 transition-all duration-[600ms] ease-in-out ${
          scrolled
            ? "border border-black/5 bg-white/90 shadow-[0_8px_30px_-12px_rgba(18,20,18,0.15)] backdrop-blur-md"
            : "border border-transparent bg-white/40 backdrop-blur-sm"
        }`}
        style={{ maxWidth: scrolled ? "50rem" : "64rem" }}
      >
        <a href="#top" className="flex cursor-pointer items-center gap-2">
          <Image
            src="/gramos-mark.png"
            alt="GramOS"
            width={442}
            height={442}
            className="h-6 w-6"
            priority
          />
          <span className="font-mono text-sm font-semibold tracking-tight text-onyx">
            GramOS
          </span>
        </a>

        <div className="hidden items-center gap-7 text-sm text-onyx/60 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="cursor-pointer transition hover:text-onyx"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden cursor-pointer text-sm font-medium text-onyx/70 transition hover:text-onyx sm:block"
          >
            Login
          </Link>
          <a
            href="/dashboard"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-lime-300 px-4 py-1.5 text-sm font-semibold text-onyx shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-lime-200 hover:shadow-md active:translate-y-0 active:shadow-sm"
          >
            Dashboard
          </a>
        </div>
      </nav>
    </div>
  );
}
