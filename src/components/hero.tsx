import { Button } from "@/components/ui/button"
import { ArrowRight, Play } from "lucide-react"
import { CanvasVisualization } from "@/components/canvas-visualization"

export default function Hero() {
  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
      {/* Interactive canvas background showing collaboration */}
      <div className="absolute inset-0 -z-10">
        <CanvasVisualization />
        {/* Subtle radial gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-32 text-center">
        <div className="space-y-8">
          <div className="animate-fade-up opacity-0" style={{ animationDelay: "0.1s" }}>
            <span className="badge-beta">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              Free while in beta
            </span>
          </div>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-balance leading-[1.02] animate-fade-up opacity-0"
            style={{ animationDelay: "0.2s" }}
          >
            Think at the
            <br />
            <span className="bg-gradient-to-r from-accent to-accent/70 bg-clip-text text-transparent">
              speed of thought.
            </span>
          </h1>

          <p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed animate-fade-up opacity-0"
            style={{ animationDelay: "0.3s" }}
          >
            The AI-native infinite canvas that moves as fast as your mind. Real-time collaboration with live cursors.
            Zero friction.
            <span className="text-foreground font-medium"> Start thinking in 2 seconds.</span>
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-fade-up opacity-0"
            style={{ animationDelay: "0.4s" }}
          >
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
              className="h-14 px-8 text-base font-medium rounded-full border-2 border-border bg-background/80 hover:text-green-500 backdrop-blur-sm hover:bg-secondary transition-all duration-300"
              asChild
            >
              <a href="https://calendar.app.google/uxqDsCepVjkX6MXj6" target="_blank" rel="noopener noreferrer">
                Book a demo
              </a>
            </Button>
          </div>

          <div
            className="flex flex-wrap items-center justify-center gap-6 pt-8 animate-fade-up opacity-0"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              No signup required
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Instant board creation
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              100% open source
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="pt-12 animate-fade-up opacity-0" style={{ animationDelay: "0.7s" }}>
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/20 mx-auto flex justify-center pt-2">
              <div className="w-1 h-2 rounded-full bg-muted-foreground/40 animate-bounce" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
