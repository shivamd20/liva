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
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <CardHeader className="space-y-2 pb-3 pt-4 px-4 min-w-0 sm:pb-6 sm:pt-8 sm:px-8 md:px-10">
        <CardTitle className="text-base font-semibold leading-tight tracking-tight break-words sm:text-xl md:text-2xl text-foreground">
          {reel.prompt}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-6 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        {!answered ? (
          <ul className="space-y-3 min-w-0">
            {reel.options.map((option, i) => (
              <li key={i} className="min-w-0">
                <Button
                  variant="outline"
                  className="w-full min-w-0 justify-start text-left h-auto min-h-[44px] py-3 px-4 text-sm font-normal rounded-2xl border-2 border-border/80 bg-background/50 text-foreground hover:border-accent/40 hover:bg-accent/5 hover:text-foreground whitespace-normal break-words focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] touch-manipulation transition-all duration-200 ease-out sm:min-h-[52px] sm:py-4 sm:px-6 sm:text-base"
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
              "space-y-3 pl-4 border-l-2 sm:space-y-6 sm:pl-5",
              correct ? "border-chart-2" : "border-destructive/60"
            )}
          >
            <p
              className={cn(
                "text-sm font-semibold animate-in fade-in duration-200 sm:text-base",
                correct ? "text-chart-2" : "text-destructive"
              )}
            >
              {correct ? "Correct" : "Incorrect"}
            </p>
            <p className="text-sm text-reel-secondary leading-relaxed break-words animate-in fade-in duration-200 delay-100 slide-in-from-bottom-2 sm:text-base">
              {reel.explanation}
            </p>
            <Button
              onClick={onContinue}
              className="w-full min-h-[44px] py-3 text-sm font-medium rounded-full bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] touch-manipulation transition-all duration-200 ease-out shadow-lg shadow-accent/20 sm:min-h-[52px] sm:py-4 sm:text-base"
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
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <CardHeader className="space-y-2 pb-3 pt-4 px-4 min-w-0 sm:pb-6 sm:pt-8 sm:px-8 md:px-10">
        <CardTitle className="text-base font-semibold leading-tight tracking-tight break-words sm:text-xl md:text-2xl text-foreground">
          {reel.prompt}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-6 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <p className="text-sm text-reel-secondary leading-relaxed break-words sm:text-base md:text-lg">
          {reel.explanation}
        </p>
        <Button
          onClick={onContinue}
          className="w-full min-h-[44px] py-3 text-sm font-medium rounded-full bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] touch-manipulation transition-all duration-200 ease-out shadow-lg shadow-accent/20 sm:min-h-[52px] sm:py-4 sm:text-base"
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
    <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-4 touch-manipulation sm:px-6 sm:py-12">
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
