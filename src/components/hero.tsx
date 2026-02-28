import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export default function Hero() {
  return (
    <section className="relative min-h-[90svh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,hsl(var(--accent)/0.08),transparent_50%),radial-gradient(circle_at_70%_60%,hsl(var(--accent)/0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_40%,transparent_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 py-32 text-center">
        <div className="space-y-8">
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-balance leading-[1.05] animate-fade-up opacity-0"
            style={{ animationDelay: "0.1s" }}
          >
            Think at the
            <br />
            <span className="bg-gradient-to-r from-accent to-accent/70 bg-clip-text text-transparent">
              speed of thought.
            </span>
          </h1>

          <p
            className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto text-balance leading-relaxed animate-fade-up opacity-0"
            style={{ animationDelay: "0.2s" }}
          >
            An AI-native infinite canvas with real-time collaboration.
            No signup. No friction.
          </p>

          <div
            className="flex justify-center pt-2 animate-fade-up opacity-0"
            style={{ animationDelay: "0.3s" }}
          >
            <Button
              size="lg"
              className="group h-14 px-8 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 shadow-lg shadow-foreground/10"
              asChild
            >
              <a href="/boards">
                Start drawing
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>

          <div
            className="flex flex-wrap items-center justify-center gap-6 pt-4 animate-fade-up opacity-0"
            style={{ animationDelay: "0.4s" }}
          >
            {["No signup required", "Instant boards", "100% open source"].map((text) => (
              <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
