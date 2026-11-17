import Navbar from './Navbar';
import Hero from './Hero';
import Features from './Features';
import HowItWorks from './HowItWorks';
import Statistics from './Statistics';
import FAQ from './FAQ';
import Footer from './Footer';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#080808] dark:text-white">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Statistics />
      <FAQ />
      <Footer />
    </main>
  );
}
