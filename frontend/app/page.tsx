import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import Architecture from "./_components/Architecture";
import Chakra from "./_components/Chakra";

import CTA from "./_components/CTA";
import Features from "./_components/Features";
import Flora from "./_components/Flora";
import Hero from "./_components/Hero";

export default function Home() {
  return (
    <div id="top" className="flex flex-1 flex-col bg-paper text-onyx">
      <Chakra />
      <Flora />
      <Navbar />

      <main className="relative z-10 flex-1">
        <Hero />
        <Architecture />
        <Features />
        <CTA />
      </main>

      <Footer />
    </div>
  );
}
