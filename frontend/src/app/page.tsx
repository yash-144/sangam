"use client";

import Navbar from "@/components/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import TrustSafety from "@/components/landing/TrustSafety";
import Roadmap from "@/components/landing/Roadmap";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar showLinks />
      <main style={{ paddingTop: "60px" }}>
        <HeroSection />
        <HowItWorks />
        <TrustSafety />
        <Roadmap />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
