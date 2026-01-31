import { useNavigate } from "react-router-dom"
import { ArrowRight, Brain, Zap, Target, TrendingUp } from "lucide-react"

export default function SystemShotsHomePage() {
  const navigate = useNavigate()

  return (
    <div className="w-full min-h-dvh bg-background overflow-x-hidden">
      {/* Hero Section */}
      <section className="min-h-dvh flex flex-col justify-center px-6 sm:px-8 md:px-12 relative">
        <div className="max-w-2xl mx-auto w-full animate-in fade-in duration-700">
          {/* Headline */}
          <h1 className="text-[clamp(2.5rem,8vw,4rem)] font-bold tracking-tight text-foreground leading-[1.1] mb-6">
            Master System Design
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-12 max-w-md">
            Swipe through bite-sized concepts. Build interview-ready intuition in minutes a day.
          </p>

          {/* CTA Button */}
          <button
            onClick={() => navigate("/app/system-shots")}
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[56px] text-lg font-semibold text-background bg-foreground rounded-full transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-lg"
          >
            Start Practicing
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Subtle social proof */}
          <p className="mt-8 text-sm text-muted-foreground/60">
            50+ concepts across 12 tracks
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/20 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-muted-foreground/40 rounded-full" />
          </div>
        </div>

        {/* Hero gradient */}
        <div 
          className="absolute inset-0 pointer-events-none -z-10"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% 100%, color-mix(in oklch, var(--accent) 8%, transparent) 0%, transparent 60%),
              radial-gradient(ellipse 60% 40% at 80% 20%, color-mix(in oklch, var(--accent) 4%, transparent) 0%, transparent 50%)
            `,
          }}
          aria-hidden
        />
      </section>

      {/* The Problem Section */}
      <section className="py-24 px-6 sm:px-8 md:px-12">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-medium text-muted-foreground/60 uppercase tracking-wider mb-4">
            The problem
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground leading-snug mb-6">
            Reading about system design isn't the same as knowing it.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            You've read the blog posts. Watched the videos. But when the interviewer asks 
            "How would you design Twitter?", your mind goes blank.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            That's because passive learning doesn't build the mental models you need. 
            You need active recall. You need to practice retrieving concepts under pressure, 
            again and again, until they become second nature.
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-6 sm:px-8 md:px-12 bg-muted/30">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-medium text-muted-foreground/60 uppercase tracking-wider mb-4">
            How it works
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground leading-snug mb-12">
            A feed that learns with you.
          </h2>

          <div className="space-y-12">
            <div className="flex gap-5">
              <div className="shrink-0 w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center">
                <Zap className="w-5 h-5 text-foreground/70" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Bite-sized questions
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  No hour-long videos. Each card takes 30 seconds. Swipe through during your 
                  commute, lunch break, or before bed.
                </p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="shrink-0 w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center">
                <Brain className="w-5 h-5 text-foreground/70" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Personalized to your level
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  The system tracks what you know and what you struggle with. It surfaces 
                  the concepts you need to review, exactly when you're about to forget them.
                </p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="shrink-0 w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center">
                <Target className="w-5 h-5 text-foreground/70" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  7 levels of mastery
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Progress from "Recognizer" to "Interview-Ready Expert". Each level 
                  tests deeper understanding — not just recall, but application, tradeoffs, 
                  and failure modes.
                </p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="shrink-0 w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-foreground/70" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  See your progress
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Track mastery across 12 tracks: Distributed Systems, Storage, Scalability, 
                  Reliability, and more. Know exactly where you stand before your interview.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Why This Works */}
      <section className="py-24 px-6 sm:px-8 md:px-12">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground leading-snug mb-6">
            Built on science, not hype.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Active recall and spaced repetition are the two most effective learning techniques 
            proven by cognitive science. We've combined them into a format that actually fits 
            your life.
          </p>
          <p className="text-base text-muted-foreground/70">
            5 minutes a day. Compounding knowledge. Interview confidence.
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-6 sm:px-8 md:px-12 bg-foreground text-background">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold leading-snug mb-6">
            Your next interview is closer than you think.
          </h2>
          <p className="text-lg opacity-70 leading-relaxed mb-10">
            Start building system design intuition today. No sign up required.
          </p>
          <button
            onClick={() => navigate("/app/system-shots")}
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[56px] text-lg font-semibold bg-background text-foreground rounded-full transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          >
            Start Practicing
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/50">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm text-muted-foreground/50">
            System Shots — Master system design, one swipe at a time.
          </p>
        </div>
      </footer>
    </div>
  )
}
