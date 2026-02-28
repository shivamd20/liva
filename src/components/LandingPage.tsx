import Navbar from "@/components/navbar"
import Hero from "@/components/hero"
import UseCases from "@/components/use-cases"
import FeaturesSection from "@/components/features-section"
import CTASection from "@/components/cta-section"
import Footer from "@/components/footer"

export function LandingPageContent() {
    return (
        <div className="w-full bg-background overflow-x-hidden">
            <Hero />
            <div className="section-divider" />
            <FeaturesSection />
            <div className="section-divider" />
            <UseCases />
            <CTASection />
        </div>
    )
}

export function LandingPage() {
    return (
        <>
            <Navbar />
            <LandingPageContent />
            <Footer />
        </>
    )
}

export default LandingPage;
