import { useInView } from "@/hooks/use-in-view"
import { Button } from "@/components/ui/button"
import { Github, Cloud, Zap } from "lucide-react"

export default function TechnicalCredibility() {
  const { ref, isInView } = useInView()

  return (
    <section id="architecture" className="py-24 md:py-32 px-6 bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Enterprise-grade.
            <br />
            <span className="text-muted-foreground">Developer-loved.</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Built on Cloudflare's edge infrastructure. Real-time sync with zero race conditions. The kind of
            architecture you'd build if you had unlimited time.
          </p>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-6 mb-16">
          <div
            className={`stat-card transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
          >
            <Zap className="w-8 h-8 text-accent mb-4" />
            <div className="stat-value mb-2">&lt;50ms</div>
            <div className="text-muted-foreground">Global state sync via Durable Objects</div>
          </div>

          <div
            className={`stat-card transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            style={{ transitionDelay: "100ms" }}
          >
            <svg
              className="w-8 h-8 text-accent mb-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div className="stat-value mb-2">Zero</div>
            <div className="text-muted-foreground">Knowledge. We can't read your boards.</div>
          </div>

          <div
            className={`stat-card transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            style={{ transitionDelay: "200ms" }}
          >
            <Github className="w-8 h-8 text-accent mb-4" />
            <div className="stat-value mb-2">100%</div>
            <div className="text-muted-foreground">Open source. Fork it right now.</div>
          </div>
        </div>

        {/* Action buttons */}
        <div
          className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          style={{ transitionDelay: "300ms" }}
        >
          <Button
            variant="outline"
            size="lg"
            className="h-12 px-6 rounded-full border-2 border-border bg-background hover:bg-secondary"
            asChild
          >
            <a href="https://github.com/shivamd20/liva" target="_blank" rel="noopener noreferrer">
              <Github className="w-5 h-5 mr-2" />
              View on GitHub
            </a>
          </Button>
          <Button
            size="lg"
            className="h-12 px-6 rounded-full bg-foreground text-background hover:bg-foreground/90"
            asChild
          >
            <a href="https://calendar.app.google/uxqDsCepVjkX6MXj6" target="_blank" rel="noopener noreferrer">
              <Cloud className="w-5 h-5 mr-2" />
              Deploy to Your Cloudflare
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
