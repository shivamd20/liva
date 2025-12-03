"use client"

import { useInView } from "@/hooks/use-in-view"

const pillars = [
  {
    title: "Infinite Canvas",
    subtitle: "Boundless thinking space",
    description:
      "Your ideas deserve room to breathe. Pan infinitely. Zoom from bird's eye to pixel-perfect detail. No edges, no limits.",
    visual: "canvas",
    gradient: "from-blue-500/20 to-cyan-500/10",
  },
  {
    title: "Real-time Sync",
    subtitle: "Thought-speed collaboration",
    description:
      "See cursors dance. Watch ideas form. Sub-50ms sync powered by Cloudflare Durable Objects. It feels like telepathy.",
    visual: "sync",
    gradient: "from-emerald-500/20 to-teal-500/10",
  },
  {
    title: "AI Co-Pilot",
    subtitle: "Coming to free tier",
    description:
      "AI that suggests while you sketch. Organizes while you brainstorm. Press Cmd+K for instant transformations.",
    visual: "ai",
    gradient: "from-violet-500/20 to-purple-500/10",
    comingSoon: true,
  },
]

function PillarVisual({ type }: { type: string }) {
  switch (type) {
    case "canvas":
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Infinite grid representation */}
          <div className="absolute inset-0 opacity-20">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute border border-current rounded-lg"
                style={{
                  width: `${(i + 1) * 20}%`,
                  height: `${(i + 1) * 20}%`,
                  top: `${50 - (i + 1) * 10}%`,
                  left: `${50 - (i + 1) * 10}%`,
                  opacity: 1 - i * 0.15,
                }}
              />
            ))}
          </div>
          {/* Zoom indicator */}
          <div className="relative z-10 flex items-center gap-2 text-xs font-mono opacity-60">
            <span>100%</span>
            <svg width="40" height="2" className="opacity-40">
              <line x1="0" y1="1" x2="40" y2="1" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span>∞</span>
          </div>
        </div>
      )
    case "sync":
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Multiple cursors */}
          <div className="relative">
            <div className="absolute -top-4 -left-8 animate-cursor-1">
              <svg width="16" height="20" viewBox="0 0 16 20" className="text-blue-500">
                <path d="M0 0L16 12L8 12L6 20L0 0Z" fill="currentColor" />
              </svg>
              <span className="absolute top-4 left-3 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                Sarah
              </span>
            </div>
            <div className="absolute top-2 left-12 animate-cursor-2">
              <svg width="16" height="20" viewBox="0 0 16 20" className="text-emerald-500">
                <path d="M0 0L16 12L8 12L6 20L0 0Z" fill="currentColor" />
              </svg>
              <span className="absolute top-4 left-3 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                Alex
              </span>
            </div>
            <div className="absolute -bottom-2 left-0 animate-cursor-3">
              <svg width="16" height="20" viewBox="0 0 16 20" className="text-amber-500">
                <path d="M0 0L16 12L8 12L6 20L0 0Z" fill="currentColor" />
              </svg>
              <span className="absolute top-4 left-3 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                Jordan
              </span>
            </div>
          </div>
        </div>
      )
    case "ai":
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Command palette hint */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-current/10 border border-current/20">
              <kbd className="text-[10px] font-mono opacity-60">⌘</kbd>
              <span className="text-[10px] font-mono opacity-60">+</span>
              <kbd className="text-[10px] font-mono opacity-60">K</kbd>
            </div>
            <div className="flex gap-1">
              {["format", "critique", "suggest"].map((cmd, i) => (
                <span key={cmd} className="text-[9px] px-2 py-0.5 rounded bg-current/5 opacity-50">
                  {cmd}
                </span>
              ))}
            </div>
          </div>
        </div>
      )
    default:
      return null
  }
}

export default function ValuePropositions() {
  const { ref, isInView } = useInView()

  return (
    <section className="py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">Why Liva?</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Not another whiteboard. An AI-native canvas built for how modern teams actually think and create.
          </p>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-6">
          {pillars.map((pillar, index) => (
            <div
              key={index}
              className={`group relative rounded-3xl overflow-hidden transition-all duration-700 hover:-translate-y-2 ${
                isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {/* Card with gradient border effect */}
              <div
                className="absolute inset-0 rounded-3xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl"
                style={{ background: `linear-gradient(135deg, var(--accent) 0%, transparent 50%)` }}
              />

              <div className="relative h-full bg-card border border-border rounded-3xl p-8 flex flex-col">
                {/* Visual area */}
                <div className={`relative h-40 rounded-2xl bg-gradient-to-br ${pillar.gradient} mb-8 overflow-hidden`}>
                  <PillarVisual type={pillar.visual} />
                  {pillar.comingSoon && <span className="absolute top-4 right-4 badge-soon text-[10px]">Soon</span>}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <p className="text-sm font-medium text-accent mb-2">{pillar.subtitle}</p>
                  <h3 className="text-2xl font-bold mb-4">{pillar.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{pillar.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
