import { useInView } from "@/hooks/use-in-view"
import { Check, Sparkles } from "lucide-react"

const features = {
  free: [
    { name: "Unlimited boards", description: "Create as many boards as you need" },
    { name: "Real-time collaboration", description: "Live cursors, instant sync via Cloudflare Durable Objects" },
    { name: "Share via link", description: "No signup required for collaborators" },
    { name: "Infinite canvas", description: "Pan and zoom without limits" },
    { name: "History & Rollback", description: "Travel back in time to any version" },
    { name: "Full shape library", description: "Rectangles, circles, arrows, freehand, and more" },
  ],
  coming: [
    { name: "AI Agents", description: "Passive suggestions + active commands (Cmd+K)", badge: "Coming to Free" },
    { name: "End-to-End Encryption", description: "Zero-knowledge, we can't read your boards", badge: "Post-Beta" },
    { name: "Open Source Release", description: "Fork it, audit it, run it yourself", badge: "Post-Beta" },
    { name: "Self-hosted Cloudflare", description: "Deploy on your own infrastructure", badge: "Coming to Free" },
  ],
}

export default function FeaturesSection() {
  const { ref, isInView } = useInView()

  return (
    <section id="features" className="py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Everything you need.
            <br />
            <span className="text-muted-foreground">Free. No catch.</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            A complete whiteboard that doesn't nickel-and-dime you. Premium features are coming—and they're coming to
            the free tier.
          </p>
        </div>

        <div ref={ref} className="grid lg:grid-cols-2 gap-12">
          {/* Free tier - presented as complete and valuable */}
          <div
            className={`space-y-6 transition-all duration-700 ${
              isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-2xl font-bold">Available Now</h3>
                <span className="badge-free">Free Forever</span>
              </div>
              <p className="text-muted-foreground">A fully-featured whiteboard. No artificial limits.</p>
            </div>

            <div className="space-y-3">
              {features.free.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50 border border-border hover:border-accent/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-emerald-500" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-semibold">{feature.name}</h4>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`space-y-6 transition-all duration-700 ${
              isInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
            style={{ transitionDelay: "150ms" }}
          >
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-2xl font-bold">The Roadmap</h3>
                <span className="badge-soon">Building Fast</span>
              </div>
              <p className="text-muted-foreground">Not a roadmap of dreams. These are in active development.</p>
            </div>

            <div className="space-y-3">
              {features.coming.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-xl border border-dashed border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-semibold">{feature.name}</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent whitespace-nowrap">
                        {feature.badge}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-foreground/5 to-foreground/[0.02] border border-foreground/10">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center text-xs">
                  💡
                </span>
                Our Philosophy
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Liva isn't just a tool—it's an ecosystem that runs anywhere and belongs to you. No vendor lock-in. No
                data hostage. When we're out of beta, you'll be able to fork it, self-host it, and own it completely.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
