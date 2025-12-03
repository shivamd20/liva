"use client"

import { useInView } from "@/hooks/use-in-view"
import { Shield, Server, GitBranch, Lock } from "lucide-react"

export default function DataOwnership() {
  const { ref, isInView } = useInView()

  return (
    <section className="py-24 md:py-32 px-6 bg-foreground text-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/10 text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            Data Sovereignty
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Your data. Your rules.
            <br />
            <span className="text-background/60">Zero compromise.</span>
          </h2>
          <p className="text-lg text-background/70 leading-relaxed">
            We're building Liva for people who care where their data lives. Every feature is designed with ownership in
            mind.
          </p>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-8 mb-16">
          {/* E2E Encryption */}
          <div
            className={`p-8 rounded-2xl bg-background/5 border border-background/10 transition-all duration-700 ${
              isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-background/10 flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-background" />
            </div>
            <h3 className="text-xl font-bold mb-3">End-to-End Encryption</h3>
            <p className="text-background/70 leading-relaxed mb-4">
              Your data is encrypted before it leaves your device. We technically cannot read your boards. Nobody can.
            </p>
            <span className="badge-soon text-[10px]">Post-Beta</span>
          </div>

          {/* Self-host */}
          <div
            className={`p-8 rounded-2xl bg-background/5 border border-background/10 transition-all duration-700 ${
              isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            <div className="w-14 h-14 rounded-2xl bg-background/10 flex items-center justify-center mb-6">
              <Server className="w-7 h-7 text-background" />
            </div>
            <h3 className="text-xl font-bold mb-3">Deploy on Your Cloudflare</h3>
            <p className="text-background/70 leading-relaxed mb-4">
              Run Liva on your own Cloudflare account. Your infrastructure, your data, your terms. Complete sovereignty.
            </p>
            <a
              href="https://calendar.app.google/uxqDsCepVjkX6MXj6"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-background hover:text-background/80 transition-colors"
            >
              Set up deployment →
            </a>
          </div>

          {/* Open Source */}
          <div
            className={`p-8 rounded-2xl bg-background/5 border border-background/10 transition-all duration-700 ${
              isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            <div className="w-14 h-14 rounded-2xl bg-background/10 flex items-center justify-center mb-6">
              <GitBranch className="w-7 h-7 text-background" />
            </div>
            <h3 className="text-xl font-bold mb-3">100% Open Source</h3>
            <p className="text-background/70 leading-relaxed mb-4">
              Every line of code is public. Audit it, fork it, contribute to it. Zero black boxes, zero trust required.
            </p>
            <a
              href="https://github.com/liva-app/liva"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-background hover:text-background/80 transition-colors"
            >
              View on GitHub →
            </a>
          </div>
        </div>

        <div
          className={`rounded-2xl bg-background/5 border border-background/10 p-8 md:p-12 transition-all duration-700 ${
            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            {/* Diagram */}
            <div className="flex-1 w-full">
              <svg viewBox="0 0 400 200" className="w-full h-auto" aria-hidden="true">
                {/* Client */}
                <rect
                  x="20"
                  y="70"
                  width="80"
                  height="60"
                  rx="8"
                  className="fill-background/10 stroke-background/30"
                  strokeWidth="2"
                />
                <text x="60" y="95" textAnchor="middle" className="fill-background text-xs font-semibold">
                  Your
                </text>
                <text x="60" y="110" textAnchor="middle" className="fill-background text-xs font-semibold">
                  Browser
                </text>

                {/* Encryption symbol */}
                <circle cx="140" cy="100" r="15" className="fill-background/20 stroke-background/40" strokeWidth="2" />
                <text x="140" y="105" textAnchor="middle" className="fill-background text-sm">
                  🔐
                </text>

                {/* Arrow 1 */}
                <path d="M100 100 L125 100" className="stroke-background/40" strokeWidth="2" strokeDasharray="4 2" />

                {/* Cloudflare */}
                <rect
                  x="160"
                  y="70"
                  width="80"
                  height="60"
                  rx="8"
                  className="fill-accent/20 stroke-accent/40"
                  strokeWidth="2"
                />
                <text x="200" y="95" textAnchor="middle" className="fill-background text-xs font-semibold">
                  Cloudflare
                </text>
                <text x="200" y="110" textAnchor="middle" className="fill-background/70 text-[10px]">
                  Durable Objects
                </text>

                {/* Arrow 2 */}
                <path d="M240 100 L280 100" className="stroke-background/40" strokeWidth="2" strokeDasharray="4 2" />

                {/* Your infra */}
                <rect
                  x="280"
                  y="70"
                  width="100"
                  height="60"
                  rx="8"
                  className="fill-background/10 stroke-background/30"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <text x="330" y="95" textAnchor="middle" className="fill-background text-xs font-semibold">
                  Your Infra
                </text>
                <text x="330" y="110" textAnchor="middle" className="fill-background/50 text-[10px]">
                  (Optional)
                </text>
              </svg>
            </div>

            {/* Stats */}
            <div className="flex-1 space-y-6">
              <div>
                <div className="text-4xl font-bold mb-1">&lt;50ms</div>
                <div className="text-background/60">Global state sync latency</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-1">Zero</div>
                <div className="text-background/60">Knowledge of your content</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-1">100%</div>
                <div className="text-background/60">Auditable source code</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
