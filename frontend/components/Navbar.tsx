"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "@/components/icons/MaterialIcons";

const NAV_LINKS = [
  { href: "/#findings", label: "Findings" },
  { href: "/#sources", label: "Data sources" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
        className={`relative flex w-full items-center justify-between rounded-full px-4 py-2.5 transition-all duration-[600ms] ease-in-out sm:px-5 ${
          scrolled || menuOpen
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

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/login"
            className="hidden cursor-pointer text-sm font-medium text-onyx/70 transition hover:text-onyx md:block"
          >
            Login
          </Link>
          <a
            href="/dashboard"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-lime-300 px-3.5 py-1.5 text-sm font-semibold text-onyx shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-lime-200 hover:shadow-md active:translate-y-0 active:shadow-sm sm:px-4"
          >
            Prototype
          </a>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-onyx/70 transition hover:bg-black/5 hover:text-onyx md:hidden"
          >
            {menuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 flex flex-col gap-1 rounded-2xl border border-black/5 bg-white/95 p-2 shadow-[0_8px_30px_-12px_rgba(18,20,18,0.2)] backdrop-blur-md md:hidden">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-onyx/70 transition hover:bg-black/5 hover:text-onyx"
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-onyx/70 transition hover:bg-black/5 hover:text-onyx"
            >
              Login
            </Link>
          </div>
        )}
      </nav>
    </div>
  );
}
