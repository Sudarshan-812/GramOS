import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-gray-700/60 bg-onyx">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-slate-500 sm:flex-row lg:px-8">
        <a href="#top" className="flex cursor-pointer items-center gap-2">
          <Image
            src="/GramOStpt.png"
            alt="GramOS"
            width={1024}
            height={1024}
            className="h-5 w-5"
          />
          <span className="font-semibold text-slate-300">GramOS</span>
        </a>
        <span>© {new Date().getFullYear()} GramOS. All rights reserved.</span>
        <span>Powered by Gemini &amp; Google AlphaEarth</span>
      </div>
    </footer>
  );
}
