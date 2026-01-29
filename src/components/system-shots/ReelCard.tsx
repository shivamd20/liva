import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Reel, MCQReel, FlashReel } from "./mockReels"
import type { ReelTheme } from "./types"

const cardBaseClass =
  "reel-card w-full max-w-2xl min-w-0 mx-auto rounded-2xl border-0 bg-card/95 text-card-foreground shadow-2xl shadow-black/5 dark:shadow-black/20 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out"

function ReelMCQ({
  reel,
  selectedIndex,
  onSelectOption,
  onContinue,
  cardStyle,
}: {
  reel: MCQReel
  selectedIndex: number | undefined
  onSelectOption: (index: number) => void
  onContinue: () => void
  cardStyle?: React.CSSProperties
}) {
  const answered = selectedIndex !== undefined
  const correct = answered && selectedIndex === reel.correctIndex

  return (
    <Card className={cardBaseClass} style={cardStyle}>
      <CardHeader className="space-y-2 pb-6 pt-8 px-8 sm:px-10 min-w-0">
        <CardTitle className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight tracking-tight break-words">
          {reel.prompt}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-10 sm:px-10 max-w-prose min-w-0">
        {!answered ? (
          <ul className="space-y-3 min-w-0">
            {reel.options.map((option, i) => (
              <li key={i} className="min-w-0">
                <Button
                  variant="outline"
                  className="w-full min-w-0 justify-start text-left h-auto min-h-[52px] py-4 px-6 text-base font-normal rounded-2xl border-2 border-border/80 bg-background/50 text-foreground hover:border-accent/40 hover:bg-accent/5 hover:text-foreground whitespace-normal break-words focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] touch-manipulation transition-all duration-200 ease-out"
                  onClick={() => onSelectOption(i)}
                >
                  {option}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div
            className={cn(
              "space-y-6 pl-5 border-l-2",
              correct ? "border-chart-2" : "border-destructive/60"
            )}
          >
            <p
              className={cn(
                "text-base font-semibold animate-in fade-in duration-200",
                correct ? "text-chart-2" : "text-destructive"
              )}
            >
              {correct ? "Correct" : "Incorrect"}
            </p>
            <p className="text-base text-reel-secondary leading-relaxed break-words animate-in fade-in duration-200 delay-100 slide-in-from-bottom-2">
              {reel.explanation}
            </p>
            <Button
              onClick={onContinue}
              className="w-full min-h-[52px] py-4 text-base font-medium rounded-full bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] touch-manipulation transition-all duration-200 ease-out shadow-lg shadow-accent/20"
            >
              Continue
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReelFlash({
  reel,
  onContinue,
  cardStyle,
}: {
  reel: FlashReel
  onContinue: () => void
  cardStyle?: React.CSSProperties
}) {
  return (
    <Card className={cardBaseClass} style={cardStyle}>
      <CardHeader className="space-y-2 pb-6 pt-8 px-8 sm:px-10 min-w-0">
        <CardTitle className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight tracking-tight break-words">
          {reel.prompt}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-10 sm:px-10 max-w-prose min-w-0">
        <p className="text-base sm:text-lg text-reel-secondary leading-relaxed break-words">
          {reel.explanation}
        </p>
        <Button
          onClick={onContinue}
          className="w-full min-h-[52px] py-4 text-base font-medium rounded-full bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] touch-manipulation transition-all duration-200 ease-out shadow-lg shadow-accent/20"
        >
          Continue
        </Button>
      </CardContent>
    </Card>
  )
}

export function ReelCard({
  reel,
  theme: _theme,
  reelIndex,
  selectedIndex,
  onSelectOption,
  onContinue,
}: {
  reel: Reel
  theme: ReelTheme
  reelIndex: number
  selectedIndex?: number
  onSelectOption?: (index: number) => void
  onContinue: () => void
}) {
  const cardStyle = { animationDelay: `${reelIndex * 40}ms` }

  return (
    <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-4 py-12 touch-manipulation sm:px-6">
      {reel.type === "mcq" ? (
        <ReelMCQ
          reel={reel}
          selectedIndex={selectedIndex}
          onSelectOption={onSelectOption!}
          onContinue={onContinue}
          cardStyle={cardStyle}
        />
      ) : (
        <ReelFlash reel={reel} onContinue={onContinue} cardStyle={cardStyle} />
      )}
    </section>
  )
}
