"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export default function CTASection() {
  return (
    <section className="py-28 md:py-36 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 text-balance">
          Start thinking in 2 seconds.
        </h2>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 text-balance leading-relaxed">
          No signup. No credit card. Just click and create.
        </p>

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
    </section>
  )
}
