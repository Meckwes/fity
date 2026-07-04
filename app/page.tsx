import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import HowItWorks from "@/components/HowItWorks";
import SampleBriefing from "@/components/SampleBriefing";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import LeadForm from "@/components/LeadForm";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <Problem />
      <HowItWorks />
      <SampleBriefing />
      <Pricing />
      <FAQ />
      <LeadForm />
      <Footer />
    </main>
  );
}
