"use client"

import { useInView } from "@/hooks/use-in-view"
import { Layers, Users, History, Shapes, Link2, Maximize } from "lucide-react"

const features = [
  {
    icon: Maximize,
    title: "Infinite Canvas",
    description: "Pan and zoom without limits. Your ideas deserve room to breathe.",
  },
  {
    icon: Users,
    title: "Real-time Collaboration",
    description: "Live cursors, instant sync. No signup required for collaborators.",
  },
  {
    icon: Layers,
    title: "Unlimited Boards",
    description: "Create as many boards as you need. No artificial limits.",
  },
  {
    icon: History,
    title: "History & Rollback",
    description: "Travel back in time to any version of your board.",
  },
  {
    icon: Link2,
    title: "Share via Link",
    description: "Send a link and collaborate instantly. Zero friction.",
  },
  {
    icon: Shapes,
    title: "Full Shape Library",
    description: "Rectangles, circles, arrows, freehand, text, and more.",
  },
]

export default function FeaturesSection() {
  const { ref, isInView } = useInView()

  return (
    <section id="features" className="py-24 md:py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            What you get.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            A complete whiteboard with real-time collaboration. Free, no catch.
          </p>
        </div>

        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className={`flex items-start gap-4 p-5 rounded-2xl bg-secondary/50 border border-border hover:border-accent/30 transition-all duration-500 ${
                  isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${index * 60}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
