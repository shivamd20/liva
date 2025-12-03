interface EmptyStateProps {
  onCreateClick: () => void
}

export default function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center justify-center min-h-[60vh] py-16">
      {/* Illustration */}
      <div className="relative w-64 h-48 mb-8">
        {/* Abstract board representation */}
        <svg viewBox="0 0 256 192" fill="none" className="w-full h-full" aria-hidden="true">
          {/* Main board */}
          <rect
            x="28"
            y="24"
            width="200"
            height="144"
            rx="12"
            className="fill-foreground/[0.03] stroke-border"
            strokeWidth="1.5"
          />

          {/* Grid pattern */}
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.5" className="fill-foreground/10" />
          </pattern>
          <rect x="28" y="24" width="200" height="144" rx="12" fill="url(#grid)" />

          {/* Sticky notes */}
          <rect
            x="48"
            y="44"
            width="40"
            height="32"
            rx="4"
            className="fill-accent/20 stroke-accent/40"
            strokeWidth="1"
          />
          <rect
            x="108"
            y="52"
            width="48"
            height="36"
            rx="4"
            className="fill-blue-500/20 stroke-blue-500/40"
            strokeWidth="1"
          />
          <rect
            x="168"
            y="44"
            width="36"
            height="28"
            rx="4"
            className="fill-emerald-500/20 stroke-emerald-500/40"
            strokeWidth="1"
          />

          {/* Connection lines */}
          <path
            d="M88 60 Q98 56 108 68"
            className="stroke-foreground/20"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M156 70 Q162 58 168 58"
            className="stroke-foreground/20"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Bottom elements */}
          <circle cx="68" cy="120" r="16" className="fill-foreground/[0.04] stroke-border" strokeWidth="1" />
          <rect
            x="100"
            y="108"
            width="56"
            height="24"
            rx="4"
            className="fill-foreground/[0.04] stroke-border"
            strokeWidth="1"
          />
          <rect
            x="172"
            y="112"
            width="40"
            height="20"
            rx="4"
            className="fill-foreground/[0.04] stroke-border"
            strokeWidth="1"
          />

          {/* Animated cursor */}
          <g className="animate-cursor-1">
            <path
              d="M190 80 L190 92 L196 88 L200 96 L204 94 L200 86 L208 86 Z"
              className="fill-accent stroke-white"
              strokeWidth="1"
            />
          </g>

          {/* Floating plus icon */}
          <g className="animate-float" style={{ animationDelay: "1s" }}>
            <circle cx="48" cy="150" r="12" className="fill-accent/10" />
            <path d="M48 145 V155 M43 150 H53" className="stroke-accent" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      {/* Text content */}
      <div className="text-center max-w-md">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 text-balance">Create your first board</h2>
        <p className="text-muted-foreground text-lg leading-relaxed mb-8 text-pretty">
          Sketch ideas, map systems, brainstorm with your team, or plan your next big release. Liva boards stay fast and
          private.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          className="group relative inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold text-primary-foreground rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          onClick={onCreateClick}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-accent to-blue-500 rounded-2xl transition-transform duration-300 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-r from-accent to-blue-500 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
          <span className="relative z-10 flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Create new board
          </span>
        </button>

        <a
          href="/templates"
          className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          Explore templates
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8H13M13 8L9 4M13 8L9 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </section>
  )
}
