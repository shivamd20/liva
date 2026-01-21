import { Link } from 'react-router-dom';
import {
    LayoutGrid,
    Zap,
    Link as LinkIcon,
    Folder,
    Shield,
    Github,
    Cloud,
    ArrowRight,
    MousePointer2
} from 'lucide-react';
import content from '../landingPage.json';
import { Button } from '@/components/ui/button';
import Navbar from "@/components/navbar"
import Hero from "@/components/hero"
import ValuePropositions from "@/components/value-propositions"
import UseCases from "@/components/use-cases"
import FeaturesSection from "@/components/features-section"
import DataOwnership from "@/components/data-ownership"
import TechnicalCredibility from "@/components/technical-credibility"
import CTASection from "@/components/cta-section"
import Footer from "@/components/footer"


const Icons = {
    LayoutGrid,
    Zap,
    Link: LinkIcon,
    Folder,
    Shield,
    Github,
    Cloud
};

export function LandingPageContent() {
    return (
        <div className="w-full bg-background overflow-x-hidden">
            <Hero />
            <div className="section-divider" />
            <ValuePropositions />
            <div className="section-divider" />
            <UseCases />
            <div className="section-divider" />
            <FeaturesSection />
            <div className="section-divider" />
            <DataOwnership />
            <div className="section-divider" />
            <TechnicalCredibility />
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


export function LandingPage_old() {
    return (
        <div className="min-h-screen w-screen bg-white text-gray-900 font-sans antialiased overflow-x-hidden">
            {/* Section 1: Hero */}
            <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-24 overflow-hidden">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left: Copy */}
                        <div className="text-left">
                            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 leading-[1.1] mb-8">
                                {content.hero.headline}
                            </h1>
                            <p className="text-xl sm:text-2xl text-gray-500 mb-10 max-w-lg leading-relaxed">
                                {content.hero.subheadline}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                                <Link
                                    to={content.hero.primaryCta.link}
                                    className="inline-flex justify-center items-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:from-[#2563EB] hover:to-[#0891B2] rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                                >
                                    {content.hero.primaryCta.text}
                                </Link>
                                <Button variant="secondary" asChild>
                                    <a
                                        href={content.hero.secondaryCta.link}
                                        className="text-lg"
                                    >
                                        {content.hero.secondaryCta.text}
                                    </a>
                                </Button>
                            </div>
                            <p className="text-sm text-gray-400 font-medium">
                                {content.hero.microcopy}
                            </p>
                        </div>

                        {/* Right: Hero Visual */}
                        <div className="relative lg:h-[600px] w-full bg-gray-50 rounded-3xl border border-gray-100 shadow-2xl overflow-hidden p-8 hidden lg:block transform rotate-1 hover:rotate-0 transition-transform duration-700">
                            {/* Abstract Board UI */}
                            <div className="absolute top-4 left-4 right-4 h-12 bg-white rounded-xl shadow-sm flex items-center px-4 gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                <div className="h-full w-px bg-gray-100 mx-2"></div>
                                <div className="flex gap-2">
                                    <div className="w-8 h-8 rounded bg-gray-100"></div>
                                    <div className="w-8 h-8 rounded bg-gradient-to-br from-[#3B82F6] to-[#06B6D4]"></div>
                                    <div className="w-8 h-8 rounded bg-gray-100"></div>
                                </div>
                            </div>

                            {/* Simulated Content */}
                            <div className="absolute inset-0 mt-20 p-8">
                                <div className="w-64 h-40 border-2 border-gray-800 rounded-lg transform -rotate-2 absolute top-20 left-20 flex items-center justify-center bg-white shadow-sm">
                                    <span className="font-handwriting text-xl text-gray-600">Architecture Diagram</span>
                                </div>
                                <div className="w-48 h-48 border-2 border-[#3B82F6] rounded-full absolute top-40 right-20 opacity-20"></div>
                                <div className="absolute bottom-32 left-40 w-32 h-32 bg-yellow-50 border-2 border-yellow-200 shadow-sm transform rotate-3 p-4 font-handwriting text-gray-600">
                                    Don't forget to update the schema!
                                </div>

                                {/* Animated Pointers */}
                                <div className="absolute top-1/3 left-1/3 animate-[float_3s_ease-in-out_infinite]">
                                    <div className="px-2 py-1 bg-blue-500 text-white text-xs rounded rounded-tl-none whitespace-nowrap transform translate-x-3 translate-y-3">
                                        Alice
                                    </div>
                                    <MousePointer2 className="w-5 h-5 text-blue-500 fill-blue-500" />
                                </div>
                                <div className="absolute top-2/3 right-1/3 animate-[float_4s_ease-in-out_infinite_1s]">
                                    <div className="px-2 py-1 bg-green-500 text-white text-xs rounded rounded-tl-none whitespace-nowrap transform translate-x-3 translate-y-3">
                                        Bob
                                    </div>
                                    <MousePointer2 className="w-5 h-5 text-green-500 fill-green-500" />
                                </div>
                                <div className="absolute bottom-20 left-20 animate-[float_5s_ease-in-out_infinite_0.5s]">
                                    <div className="px-2 py-1 bg-pink-500 text-white text-xs rounded rounded-tl-none whitespace-nowrap transform translate-x-3 translate-y-3">
                                        Sarah
                                    </div>
                                    <MousePointer2 className="w-5 h-5 text-pink-500 fill-pink-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 2: Why This Exists */}
            <section className="py-24 bg-gray-50">
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-12">
                        {content.whyThisExists.headline}
                    </h2>
                    <div className="flex flex-wrap justify-center gap-4 mb-16">
                        {content.whyThisExists.features.map((feature, i) => (
                            <div key={i} className="bg-white px-6 py-3 rounded-full shadow-sm border border-gray-100 text-gray-600 font-medium">
                                {feature}
                            </div>
                        ))}
                    </div>

                    {/* Looping Animation Placeholder */}
                    <div className="w-full max-w-lg mx-auto h-64 bg-white rounded-2xl border border-gray-200 shadow-inner flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                            <div className="w-32 h-32 border-4 border-gray-300 rounded-full animate-ping"></div>
                        </div>
                        <div className="text-gray-400 font-medium">Realtime Sync Visualization</div>
                        <MousePointer2 className="absolute top-10 left-10 w-6 h-6 text-[#3B82F6] animate-bounce" />
                        <MousePointer2 className="absolute bottom-10 right-10 w-6 h-6 text-orange-500 animate-pulse" />
                    </div>
                </div>
            </section>

            {/* Section 3: How It Works */}
            <section className="py-24 border-b border-gray-100">
                <div className="container mx-auto px-4 max-w-3xl text-center">
                    <h2 className="text-sm font-semibold bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] bg-clip-text text-transparent uppercase tracking-wide mb-4">
                        Under the Hood
                    </h2>
                    <h3 className="text-3xl font-bold text-gray-900 mb-6">
                        {content.howItWorks.headline}
                    </h3>
                    <p className="text-xl text-gray-600 leading-relaxed">
                        {content.howItWorks.copy}
                    </p>
                </div>
            </section>

            {/* Section 4: Features Grid */}
            <section className="py-24">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {content.features.map((feature, i) => {
                            const Icon = Icons[feature.icon as keyof typeof Icons] || LayoutGrid;
                            return (
                                <div key={i} className="p-8 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-[#3B82F6]/20 group">
                                    <div className="w-12 h-12 bg-gradient-to-br from-[#3B82F6] to-[#06B6D4] rounded-xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-white">
                                        <Icon size={24} />
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-900 mb-3">
                                        {feature.title}
                                    </h4>
                                    <p className="text-gray-600 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Section 5: Comparison */}
            <section className="py-24 bg-gradient-to-br from-gray-900 via-[#1e3a8a] to-gray-900 text-white relative overflow-hidden">
                {/* Gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#3B82F6]/10 to-[#06B6D4]/10 pointer-events-none"></div>
                <div className="container mx-auto px-4 max-w-5xl relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl font-bold mb-6 bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] bg-clip-text text-transparent">
                            {content.comparison.headline}
                        </h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            {content.comparison.subheadline}
                        </p>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gray-800">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-800/50">
                                    <th className="p-6 font-medium text-gray-400">Feature</th>
                                    <th className="p-6 font-medium text-gray-400">Excalidraw</th>
                                    <th className="p-6 font-bold text-white bg-gradient-to-r from-[#3B82F6]/10 to-[#06B6D4]/10 border-b border-[#3B82F6]/20">Liva</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {content.comparison.table.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                                        <td className="p-6 text-gray-300 font-medium">{row.feature}</td>
                                        <td className="p-6 text-gray-500">{row.excalidraw}</td>
                                        <td className="p-6 text-white bg-gradient-to-r from-[#3B82F6]/5 to-[#06B6D4]/5 font-medium shadow-[inset_3px_0_0_0_#3B82F6]">{row.liva}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Section 6: For Engineers */}
            <section className="py-24 border-b border-gray-100">
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-900 mb-8">
                        <Icons.Github size={32} />
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                        {content.forEngineers.headline}
                    </h2>
                    <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                        {content.forEngineers.copy}
                    </p>
                    <a
                        href={content.forEngineers.cta.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] bg-clip-text text-transparent font-semibold hover:from-[#2563EB] hover:to-[#0891B2] text-lg group"
                    >
                        {content.forEngineers.cta.text}
                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                </div>
            </section>

            {/* Section 7: Deploy */}
            <section id="deploy" className="py-24 bg-gradient-to-br from-[#3B82F6]/5 to-[#06B6D4]/5">
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                        {content.deploy.headline}
                    </h2>
                    <p className="text-xl text-gray-600 mb-10">
                        {content.deploy.subheadline}
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        {content.deploy.buttons.map((btn, i) => (
                            <a
                                key={i}
                                href={btn.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all ${i === 0
                                    ? "bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] text-white hover:from-[#2563EB] hover:to-[#0891B2] shadow-lg hover:shadow-xl"
                                    : "bg-white text-gray-900 border border-gray-200 hover:border-gray-400"
                                    }`}
                            >
                                {btn.text}
                            </a>
                        ))}
                    </div>
                </div>
            </section>

            {/* Section 8: Founder */}
            <section className="py-24">
                <div className="container mx-auto px-4 max-w-2xl text-center">
                    <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-6 overflow-hidden">
                        <img
                            src={content.founder.image}
                            alt={content.founder.headline}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        {content.founder.headline}
                    </h3>
                    <p className="text-gray-600 mb-8">
                        {content.founder.subcopy}
                    </p>
                    <div className="flex justify-center gap-6">
                        {content.founder.links.map((link, i) => (
                            <a
                                key={i}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-gray-900 font-medium transition-colors"
                            >
                                {link.text}
                            </a>
                        ))}
                    </div>
                </div>
            </section>

            {/* Section 9: Final CTA */}
            <section className="py-32 bg-gradient-to-br from-gray-900 via-[#1e3a8a] to-gray-900 text-center relative overflow-hidden">
                {/* Gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#3B82F6]/10 to-[#06B6D4]/10 pointer-events-none"></div>
                <div className="container mx-auto px-4 relative z-10">
                    <h2 className="text-4xl sm:text-6xl font-bold mb-12 tracking-tight bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] bg-clip-text text-transparent">
                        {content.finalCta.headline}
                    </h2>
                    <div className="flex flex-col sm:flex-row justify-center gap-6 items-center">
                        <Link
                            to={content.finalCta.primaryButton.link}
                            className="px-10 py-5 text-xl font-bold text-white bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:from-[#2563EB] hover:to-[#0891B2] rounded-full transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:-translate-y-1"
                        >
                            {content.finalCta.primaryButton.text}
                        </Link>
                        <a
                            href={content.finalCta.secondaryButton.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-white font-semibold transition-colors"
                        >
                            {content.finalCta.secondaryButton.text}
                        </a>
                    </div>
                </div>
            </section>
        </div>
    );
}
