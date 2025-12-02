import { Button } from "@/components/ui/button"
import { ArrowRight, Play } from "lucide-react"

export default function CTASection() {
  return (
    <section className="py-32 md:py-40 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-sm font-medium text-accent mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/60"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          Free while in beta — limited time
        </div>

        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 text-balance">
          Start thinking in 2 seconds.
        </h2>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 text-balance leading-relaxed">
          No signup. No credit card. No friction. Just click and create.
          <span className="text-foreground font-medium"> Your first board is waiting.</span>
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="group h-14 px-8 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 shadow-lg shadow-foreground/10"
            asChild
          >
            <a href="/board">
              <Play className="w-4 h-4 mr-2 fill-current" />
              Try it now
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-8 text-base font-medium rounded-full border-2 border-border bg-background hover: transition-all duration-300"
            asChild
          >
            <a href="https://calendar.app.google/uxqDsCepVjkX6MXj6" target="_blank" rel="noopener noreferrer">
              Book a demo
            </a>
          </Button>
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-muted-foreground">
          <span>No signup required</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span>Instant board creation</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span>Open source</span>
        </div>
      </div>
    </section>
  )
}
