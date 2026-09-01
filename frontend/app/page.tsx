import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import Chakra from "./_components/Chakra";
import DataSources from "./_components/DataSources";
import Findings from "./_components/Findings";
import Flora from "./_components/Flora";
import Hero from "./_components/Hero";
import Hypothesis from "./_components/Hypothesis";
import IncomeGap from "./_components/IncomeGap";
import Limitations from "./_components/Limitations";

export default function Home() {
  return (
    <div id="top" className="flex flex-1 flex-col bg-paper text-onyx">
      <Chakra />
      <Flora />
      <Navbar />

      <main className="relative z-10 flex-1">
        <Hero />
        <Hypothesis />
        <Findings />
        <IncomeGap />
        <DataSources />
        <Limitations />
      </main>

      <Footer />
    </div>
  );
}
