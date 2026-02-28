import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ReelTheme, DisplayReel, DisplayMCQ, DisplayFlash } from "./types"

const cardBaseClass =
  "reel-card w-full max-w-2xl min-w-0 mx-auto rounded-2xl border-0 bg-card/95 text-card-foreground shadow-2xl shadow-black/5 dark:shadow-black/20 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out"

/** Min height for the feedback block so layout doesn't shift when explanation appears. Smaller on mobile. */
const FEEDBACK_BLOCK_MIN_H_CLASS = "min-h-[8rem] sm:min-h-[10rem]"

function ReelMCQ({
  reel,
  selectedIndex,
  onSelectOption,
  onContinue,
  cardStyle,
  microSignal,
}: {
  reel: DisplayMCQ
  selectedIndex: number | undefined
  onSelectOption: (index: number) => void
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
}) {
  const answered = selectedIndex !== undefined
  const correct = answered && selectedIndex === reel.correctIndex

  const getOptionState = (i: number) => {
    if (!answered) return "default"
    const isCorrect = i === reel.correctIndex
    const isSelected = i === selectedIndex
    if (isCorrect && isSelected) return "correct-selected"
    if (isCorrect) return "correct"
    if (isSelected) return "incorrect-selected"
    return "muted"
  }

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <CardHeader className="space-y-2 pt-3 pb-2 px-3 min-w-0 sm:pb-6 sm:pt-8 sm:px-8 md:px-10">
        {microSignal && (
          <p className="text-xs italic text-muted-foreground/70 animate-in fade-in duration-300">
            {microSignal}
          </p>
        )}
        <CardTitle className="text-base font-semibold leading-tight tracking-tight break-words sm:text-xl md:text-2xl text-foreground">
          {reel.prompt}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        {/* Options always visible; after answer we show correct/incorrect state and disable clicks */}
        <ul className="space-y-2 min-w-0 sm:space-y-3">
          {reel.options.map((option, i) => {
            const state = getOptionState(i)
            const isCorrectOption = reel.correctIndex === i
            const isSelectedOption = selectedIndex === i
            return (
              <li key={i} className="min-w-0">
                <Button
                  variant="outline"
                  disabled={answered}
                  className={cn(
                    "w-full min-w-0 justify-start text-left h-auto min-h-[40px] py-2.5 px-3 text-sm font-normal rounded-2xl border-2 whitespace-normal break-words transition-all duration-200 ease-out sm:min-h-[52px] sm:py-4 sm:px-6 sm:text-base",
                    !answered &&
                      "border-border/80 bg-background/50 text-foreground hover:border-accent/40 hover:bg-accent/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] touch-manipulation cursor-pointer",
                    answered && state === "correct-selected" &&
                      "border-chart-2 bg-chart-2/15 text-chart-2 border-2 cursor-default",
                    answered && state === "correct" &&
                      "border-chart-2/80 bg-chart-2/10 text-chart-2 cursor-default",
                    answered && state === "incorrect-selected" &&
                      "border-destructive/80 bg-destructive/10 text-destructive cursor-default",
                    answered && state === "muted" &&
                      "border-border/60 bg-muted/30 text-muted-foreground cursor-default"
                  )}
                  onClick={() => !answered && onSelectOption(i)}
                >
                  <span className="flex items-center gap-2 flex-wrap">
                    {option}
                    {answered && isCorrectOption && (
                      <span className="text-xs font-medium text-chart-2 shrink-0">Correct</span>
                    )}
                    {answered && isSelectedOption && !isCorrectOption && (
                      <span className="text-xs font-medium text-destructive shrink-0">Your answer</span>
                    )}
                  </span>
                </Button>
              </li>
            )
          })}
        </ul>

        {/* Fixed-height block for explanation + Continue to avoid layout shift */}
        <div
          className={cn("flex flex-col", FEEDBACK_BLOCK_MIN_H_CLASS)}
          aria-live="polite"
        >
          {answered && (
            <div
              className={cn(
                "flex flex-col flex-1 min-h-0 pl-4 border-l-2 sm:pl-5 animate-in fade-in duration-200 slide-in-from-bottom-2",
                correct ? "border-chart-2" : "border-destructive/60"
              )}
            >
              <p
                className={cn(
                  "text-sm font-semibold shrink-0 sm:text-base",
                  correct ? "text-chart-2" : "text-destructive"
                )}
              >
                {correct ? "Correct" : "Incorrect"}
              </p>
              <div className="flex-1 min-h-0 overflow-y-auto py-1">
                <p className="text-sm text-reel-secondary leading-relaxed break-words sm:text-base">
                  {reel.explanation}
                </p>
              </div>
              <Button
                onClick={onContinue}
                className="w-full min-h-[40px] py-2.5 px-3 text-sm font-medium rounded-full bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] touch-manipulation transition-all duration-200 ease-out shadow-lg shadow-accent/20 shrink-0 mt-2 sm:min-h-[52px] sm:py-4 sm:text-base"
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ReelFlash({
  reel,
  onContinue,
  cardStyle,
  microSignal,
}: {
  reel: DisplayFlash
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
}) {
  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <CardHeader className="space-y-2 pt-3 pb-2 px-3 min-w-0 sm:pb-6 sm:pt-8 sm:px-8 md:px-10">
        {microSignal && (
          <p className="text-xs italic text-muted-foreground/70 animate-in fade-in duration-300">
            {microSignal}
          </p>
        )}
        <CardTitle className="text-base font-semibold leading-tight tracking-tight break-words sm:text-xl md:text-2xl text-foreground">
          {reel.prompt}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <p className="text-sm text-reel-secondary leading-relaxed break-words sm:text-base md:text-lg">
          {reel.explanation}
        </p>
        <Button
          onClick={onContinue}
          className="w-full min-h-[40px] py-2.5 px-3 text-sm font-medium rounded-full bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] touch-manipulation transition-all duration-200 ease-out shadow-lg shadow-accent/20 sm:min-h-[52px] sm:py-4 sm:text-base"
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
  microSignal,
}: {
  reel: DisplayReel
  theme: ReelTheme
  reelIndex: number
  selectedIndex?: number
  onSelectOption?: (index: number) => void
  onContinue: () => void
  microSignal?: string | null
}) {
  const cardStyle = { animationDelay: `${reelIndex * 40}ms` }

  return (
    <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
      {reel.type === "mcq" ? (
        <ReelMCQ
          reel={reel}
          selectedIndex={selectedIndex}
          onSelectOption={onSelectOption!}
          onContinue={onContinue}
          cardStyle={cardStyle}
          microSignal={microSignal}
        />
      ) : (
        <ReelFlash reel={reel} onContinue={onContinue} cardStyle={cardStyle} microSignal={microSignal} />
      )}
    </section>
  )
}
