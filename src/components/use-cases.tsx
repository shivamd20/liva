import { useInView } from "@/hooks/use-in-view"
import { ArrowUpRight } from "lucide-react"

const useCases = [
  {
    title: "System Design",
    subtitle: "Ace your interviews",
    description: "Diagram architectures, practice with AI feedback, nail your next technical interview.",
    gradient: "from-blue-500/20 via-cyan-500/10 to-transparent",
    icon: (
      <svg viewBox="0 0 80 60" className="w-full h-full opacity-60">
        <rect
          x="5"
          y="5"
          width="25"
          height="18"
          rx="3"
          className="fill-current/20 stroke-current/40"
          strokeWidth="1.5"
        />
        <rect
          x="40"
          y="5"
          width="25"
          height="18"
          rx="3"
          className="fill-current/20 stroke-current/40"
          strokeWidth="1.5"
        />
        <rect
          x="22"
          y="37"
          width="25"
          height="18"
          rx="3"
          className="fill-current/20 stroke-current/40"
          strokeWidth="1.5"
        />
        <path d="M17 23 L17 30 L34 30 L34 37" className="stroke-current/40" strokeWidth="1.5" fill="none" />
        <path d="M52 23 L52 30 L34 30" className="stroke-current/40" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    title: "Sprint Planning",
    subtitle: "Align your team",
    description: "Map user stories, prioritize backlogs, keep everyone synced in real-time.",
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
    icon: (
      <svg viewBox="0 0 80 60" className="w-full h-full opacity-60">
        <rect
          x="5"
          y="5"
          width="22"
          height="50"
          rx="3"
          className="fill-current/10 stroke-current/30"
          strokeWidth="1.5"
        />
        <rect
          x="32"
          y="5"
          width="22"
          height="50"
          rx="3"
          className="fill-current/10 stroke-current/30"
          strokeWidth="1.5"
        />
        <rect
          x="59"
          y="5"
          width="16"
          height="50"
          rx="3"
          className="fill-current/10 stroke-current/30"
          strokeWidth="1.5"
        />
        <rect x="9" y="10" width="14" height="8" rx="2" className="fill-current/30" />
        <rect x="9" y="22" width="14" height="8" rx="2" className="fill-current/20" />
        <rect x="36" y="10" width="14" height="8" rx="2" className="fill-current/25" />
      </svg>
    ),
  },
  {
    title: "Mathematics",
    subtitle: "Visualize concepts",
    description: "Sketch equations, draw graphs, work through problems with infinite space.",
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
    icon: (
      <svg viewBox="0 0 80 60" className="w-full h-full opacity-60">
        <text x="40" y="30" textAnchor="middle" className="fill-current text-2xl font-serif">
          ∫
        </text>
        <text x="52" y="35" textAnchor="middle" className="fill-current/60 text-sm font-serif">
          dx
        </text>
        <path d="M10 45 Q30 15 50 35 T75 25" className="stroke-current/40" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    title: "Study Sessions",
    subtitle: "Learn together",
    description: "Create mind maps, share notes, collaborate on materials with classmates.",
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    icon: (
      <svg viewBox="0 0 80 60" className="w-full h-full opacity-60">
        <circle cx="40" cy="30" r="12" className="fill-current/20 stroke-current/40" strokeWidth="1.5" />
        <circle cx="15" cy="15" r="8" className="fill-current/15 stroke-current/30" strokeWidth="1" />
        <circle cx="65" cy="15" r="8" className="fill-current/15 stroke-current/30" strokeWidth="1" />
        <circle cx="15" cy="45" r="8" className="fill-current/15 stroke-current/30" strokeWidth="1" />
        <circle cx="65" cy="45" r="8" className="fill-current/15 stroke-current/30" strokeWidth="1" />
        <line x1="30" y1="22" x2="21" y2="17" className="stroke-current/30" strokeWidth="1" />
        <line x1="50" y1="22" x2="59" y2="17" className="stroke-current/30" strokeWidth="1" />
        <line x1="30" y1="38" x2="21" y2="43" className="stroke-current/30" strokeWidth="1" />
        <line x1="50" y1="38" x2="59" y2="43" className="stroke-current/30" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: "Product Ideation",
    subtitle: "From chaos to clarity",
    description: "Brainstorm features, map user journeys, turn scattered ideas into plans.",
    gradient: "from-rose-500/20 via-pink-500/10 to-transparent",
    icon: (
      <svg viewBox="0 0 80 60" className="w-full h-full opacity-60">
        <circle cx="20" cy="30" r="6" className="fill-current/30" />
        <circle cx="40" cy="15" r="4" className="fill-current/20" />
        <circle cx="60" cy="25" r="5" className="fill-current/25" />
        <circle cx="35" cy="45" r="4" className="fill-current/20" />
        <circle cx="55" cy="45" r="3" className="fill-current/15" />
        <path
          d="M20 30 L40 15 L60 25"
          className="stroke-current/30"
          strokeWidth="1"
          fill="none"
          strokeDasharray="2 2"
        />
        <path
          d="M20 30 L35 45 L55 45"
          className="stroke-current/30"
          strokeWidth="1"
          fill="none"
          strokeDasharray="2 2"
        />
      </svg>
    ),
  },
  {
    title: "Team Retros",
    subtitle: "Reflect and improve",
    description: "Gather feedback, identify patterns, drive continuous improvement together.",
    gradient: "from-cyan-500/20 via-sky-500/10 to-transparent",
    icon: (
      <svg viewBox="0 0 80 60" className="w-full h-full opacity-60">
        <rect
          x="5"
          y="10"
          width="22"
          height="40"
          rx="3"
          className="fill-emerald-500/20 stroke-emerald-500/40"
          strokeWidth="1.5"
        />
        <rect
          x="32"
          y="10"
          width="22"
          height="40"
          rx="3"
          className="fill-amber-500/20 stroke-amber-500/40"
          strokeWidth="1.5"
        />
        <rect
          x="59"
          y="10"
          width="16"
          height="40"
          rx="3"
          className="fill-rose-500/20 stroke-rose-500/40"
          strokeWidth="1.5"
        />
        <text x="16" y="35" textAnchor="middle" className="fill-emerald-500/60 text-lg">
          +
        </text>
        <text x="43" y="35" textAnchor="middle" className="fill-amber-500/60 text-lg">
          Δ
        </text>
        <text x="67" y="35" textAnchor="middle" className="fill-rose-500/60 text-lg">
          -
        </text>
      </svg>
    ),
  },
]

export default function UseCases() {
  const { ref, isInView } = useInView()

  return (
    <section id="use-cases" className="py-24 md:py-32 px-6 bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Built for every
            <br />
            <span className="text-muted-foreground">kind of thinker.</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            From solo brainstorms to team workshops. Click any to start immediately.
          </p>
        </div>

        {/* Use case grid */}
        <div ref={ref} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => (
            <a
              key={index}
              href="/board"
              className={`group relative overflow-hidden rounded-2xl bg-card border border-border transition-all duration-500 hover:border-accent/30 hover:-translate-y-1 hover:shadow-xl ${
                isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${index * 60}ms` }}
            >
              {/* Visual */}
              <div className={`relative h-36 bg-gradient-to-br ${useCase.gradient} overflow-hidden p-6`}>
                {useCase.icon}
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-lg font-bold">{useCase.title}</h3>
                    <p className="text-sm text-accent font-medium">{useCase.subtitle}</p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{useCase.description}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
