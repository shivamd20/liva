import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  ReelTheme,
  DisplayReel,
  DisplayMCQ,
  DisplayFlash,
  DisplayBinary,
  DisplayFillBlank,
  DisplaySpotError,
  DisplayThisOrThat,
  DisplayComponentPicker,
  DisplayHotTake,
  DisplayEstimation,
  DisplayInterviewMoment,
  DisplayWhatBreaks,
  DisplayIncident,
  DisplayOrdering,
  DisplayFreeText,
} from "./types"

const cardBaseClass =
  "reel-card w-full max-w-2xl min-w-0 mx-auto rounded-2xl border-0 bg-card/95 text-card-foreground shadow-2xl shadow-black/5 dark:shadow-black/20 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out"

const FEEDBACK_BLOCK_MIN_H_CLASS = "min-h-[8rem] sm:min-h-[10rem]"

const CONTINUE_BTN_CLASS =
  "w-full min-h-[40px] py-2.5 px-3 text-sm font-medium rounded-full bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] touch-manipulation transition-all duration-200 ease-out shadow-lg shadow-accent/20 shrink-0 mt-2 sm:min-h-[52px] sm:py-4 sm:text-base"

// ---------------------------------------------------------------------------
// Type badge (small label showing reel format)
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  binary: "True / False",
  fill_blank: "Fill the Blank",
  this_or_that: "Tradeoff",
  component_picker: "Pick the Tech",
  hot_take: "Hot Take",
  estimation: "Estimate",
  interview_moment: "Interview Moment",
  what_breaks: "What Breaks?",
  incident: "Incident",
  spot_error: "Spot the Error",
  ordering: "Put in Order",
  free_text: "Explain",
  voice: "Voice",
  label_diagram: "Label the Architecture",
  spot_spof: "Spot the SPOF",
  progressive: "Design Challenge",
}

function TypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type]
  if (!label) return null
  return (
    <span className="inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent sm:text-xs">
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Shared header
// ---------------------------------------------------------------------------

function ReelHeader({
  type,
  prompt,
  microSignal,
}: {
  type: string
  prompt: string
  microSignal?: string | null
}) {
  return (
    <CardHeader className="space-y-2 pt-3 pb-2 px-3 min-w-0 sm:pb-6 sm:pt-8 sm:px-8 md:px-10">
      <div className="flex items-center gap-2 flex-wrap">
        <TypeBadge type={type} />
        {microSignal && (
          <p className="text-xs italic text-muted-foreground/70 animate-in fade-in duration-300">
            {microSignal}
          </p>
        )}
      </div>
      <CardTitle className="text-base font-semibold leading-tight tracking-tight break-words sm:text-xl md:text-2xl text-foreground">
        {prompt}
      </CardTitle>
    </CardHeader>
  )
}

// ---------------------------------------------------------------------------
// Shared feedback block (correct/incorrect + explanation + continue)
// ---------------------------------------------------------------------------

function FeedbackBlock({
  answered,
  correct,
  explanation,
  onContinue,
  noCorrectAnswer,
}: {
  answered: boolean
  correct: boolean
  explanation: string
  onContinue: () => void
  noCorrectAnswer?: boolean
}) {
  return (
    <div className={cn("flex flex-col", FEEDBACK_BLOCK_MIN_H_CLASS)} aria-live="polite">
      {answered && (
        <div
          className={cn(
            "flex flex-col flex-1 min-h-0 pl-4 border-l-2 sm:pl-5 animate-in fade-in duration-200 slide-in-from-bottom-2",
            noCorrectAnswer
              ? "border-accent"
              : correct
                ? "border-chart-2"
                : "border-destructive/60"
          )}
        >
          {!noCorrectAnswer && (
            <p
              className={cn(
                "text-sm font-semibold shrink-0 sm:text-base",
                correct ? "text-chart-2" : "text-destructive"
              )}
            >
              {correct ? "Correct" : "Incorrect"}
            </p>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto py-1">
            <p className="text-sm text-reel-secondary leading-relaxed break-words sm:text-base">
              {explanation}
            </p>
          </div>
          <Button onClick={onContinue} className={CONTINUE_BTN_CLASS}>
            Continue
          </Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Options list (shared by MCQ-like types)
// ---------------------------------------------------------------------------

function OptionsList({
  options,
  correctIndex,
  selectedIndex,
  answered,
  onSelect,
}: {
  options: string[]
  correctIndex: number
  selectedIndex: number | undefined
  answered: boolean
  onSelect: (i: number) => void
}) {
  const getOptionState = (i: number) => {
    if (!answered) return "default"
    if (correctIndex === -1) {
      return i === selectedIndex ? "neutral-selected" : "muted"
    }
    const isCorrect = i === correctIndex
    const isSelected = i === selectedIndex
    if (isCorrect && isSelected) return "correct-selected"
    if (isCorrect) return "correct"
    if (isSelected) return "incorrect-selected"
    return "muted"
  }

  return (
    <ul className="space-y-2 min-w-0 sm:space-y-3">
      {options.map((option, i) => {
        const state = getOptionState(i)
        const isCorrectOption = correctIndex >= 0 && correctIndex === i
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
                answered && state === "neutral-selected" &&
                  "border-accent bg-accent/10 text-accent cursor-default",
                answered && state === "muted" &&
                  "border-border/60 bg-muted/30 text-muted-foreground cursor-default"
              )}
              onClick={() => !answered && onSelect(i)}
            >
              <span className="flex items-center gap-2 flex-wrap">
                {option}
                {answered && isCorrectOption && (
                  <span className="text-xs font-medium text-chart-2 shrink-0">Correct</span>
                )}
                {answered && isSelectedOption && correctIndex >= 0 && !isCorrectOption && (
                  <span className="text-xs font-medium text-destructive shrink-0">Your answer</span>
                )}
                {answered && isSelectedOption && correctIndex === -1 && (
                  <span className="text-xs font-medium text-accent shrink-0">Your pick</span>
                )}
              </span>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// MCQ (original)
// ---------------------------------------------------------------------------

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

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <ReelHeader type="mcq" prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <OptionsList
          options={reel.options}
          correctIndex={reel.correctIndex}
          selectedIndex={selectedIndex}
          answered={answered}
          onSelect={onSelectOption}
        />
        <FeedbackBlock answered={answered} correct={correct} explanation={reel.explanation} onContinue={onContinue} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Flash
// ---------------------------------------------------------------------------

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
      <ReelHeader type="flash" prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <p className="text-sm text-reel-secondary leading-relaxed break-words sm:text-base md:text-lg">
          {reel.explanation}
        </p>
        <Button onClick={onContinue} className={CONTINUE_BTN_CLASS}>
          Continue
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Binary (True/False)
// ---------------------------------------------------------------------------

function ReelBinary({
  reel,
  selectedIndex,
  onSelectOption,
  onContinue,
  cardStyle,
  microSignal,
}: {
  reel: DisplayBinary
  selectedIndex: number | undefined
  onSelectOption: (index: number) => void
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
}) {
  const answered = selectedIndex !== undefined
  const correct = answered && selectedIndex === reel.correctIndex

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <ReelHeader type="binary" prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <div className="grid grid-cols-2 gap-3">
          {reel.options.map((option, i) => {
            const isSelected = selectedIndex === i
            const isCorrect = i === reel.correctIndex
            return (
              <Button
                key={i}
                variant="outline"
                disabled={answered}
                className={cn(
                  "h-auto min-h-[56px] py-4 px-4 text-base font-semibold rounded-2xl border-2 transition-all duration-200 ease-out sm:min-h-[72px] sm:text-lg",
                  !answered &&
                    "border-border/80 bg-background/50 text-foreground hover:border-accent/40 hover:bg-accent/5 active:scale-[0.98] touch-manipulation cursor-pointer",
                  answered && isCorrect && isSelected &&
                    "border-chart-2 bg-chart-2/15 text-chart-2 cursor-default",
                  answered && isCorrect && !isSelected &&
                    "border-chart-2/80 bg-chart-2/10 text-chart-2 cursor-default",
                  answered && isSelected && !isCorrect &&
                    "border-destructive/80 bg-destructive/10 text-destructive cursor-default",
                  answered && !isSelected && !isCorrect &&
                    "border-border/60 bg-muted/30 text-muted-foreground cursor-default"
                )}
                onClick={() => !answered && onSelectOption(i)}
              >
                {option}
              </Button>
            )
          })}
        </div>
        <FeedbackBlock answered={answered} correct={correct} explanation={reel.explanation} onContinue={onContinue} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// This-or-That (Tradeoff — no correct answer)
// ---------------------------------------------------------------------------

function ReelThisOrThat({
  reel,
  selectedIndex,
  onSelectOption,
  onContinue,
  cardStyle,
  microSignal,
}: {
  reel: DisplayThisOrThat
  selectedIndex: number | undefined
  onSelectOption: (index: number) => void
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
}) {
  const answered = selectedIndex !== undefined

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <ReelHeader type="this_or_that" prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          {reel.options.map((option, i) => {
            const isSelected = selectedIndex === i
            return (
              <Button
                key={i}
                variant="outline"
                disabled={answered}
                className={cn(
                  "flex-1 h-auto min-h-[56px] py-4 px-4 text-base font-semibold rounded-2xl border-2 transition-all duration-200 ease-out sm:min-h-[72px] sm:text-lg",
                  !answered &&
                    "border-border/80 bg-background/50 text-foreground hover:border-accent/40 hover:bg-accent/5 active:scale-[0.98] touch-manipulation cursor-pointer",
                  answered && isSelected &&
                    "border-accent bg-accent/10 text-accent cursor-default",
                  answered && !isSelected &&
                    "border-border/60 bg-muted/30 text-muted-foreground cursor-default"
                )}
                onClick={() => !answered && onSelectOption(i)}
              >
                {option}
              </Button>
            )
          })}
        </div>
        <FeedbackBlock answered={answered} correct={true} explanation={reel.explanation} onContinue={onContinue} noCorrectAnswer />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Hot Take (3-option: Agree / Disagree / It Depends)
// ---------------------------------------------------------------------------

function ReelHotTake({
  reel,
  selectedIndex,
  onSelectOption,
  onContinue,
  cardStyle,
  microSignal,
}: {
  reel: DisplayHotTake
  selectedIndex: number | undefined
  onSelectOption: (index: number) => void
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
}) {
  const answered = selectedIndex !== undefined
  const correct = answered && selectedIndex === reel.correctIndex

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <ReelHeader type="hot_take" prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {reel.options.map((option, i) => {
            const isSelected = selectedIndex === i
            const isCorrect = i === reel.correctIndex
            return (
              <Button
                key={i}
                variant="outline"
                disabled={answered}
                className={cn(
                  "h-auto min-h-[48px] py-3 px-2 text-xs font-semibold rounded-2xl border-2 transition-all duration-200 ease-out sm:min-h-[56px] sm:text-sm",
                  !answered &&
                    "border-border/80 bg-background/50 text-foreground hover:border-accent/40 hover:bg-accent/5 active:scale-[0.98] touch-manipulation cursor-pointer",
                  answered && isCorrect && isSelected &&
                    "border-chart-2 bg-chart-2/15 text-chart-2 cursor-default",
                  answered && isCorrect && !isSelected &&
                    "border-chart-2/80 bg-chart-2/10 text-chart-2 cursor-default",
                  answered && isSelected && !isCorrect &&
                    "border-destructive/80 bg-destructive/10 text-destructive cursor-default",
                  answered && !isSelected && !isCorrect &&
                    "border-border/60 bg-muted/30 text-muted-foreground cursor-default"
                )}
                onClick={() => !answered && onSelectOption(i)}
              >
                {option}
              </Button>
            )
          })}
        </div>
        <FeedbackBlock answered={answered} correct={correct} explanation={reel.explanation} onContinue={onContinue} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Estimation (magnitude choices)
// ---------------------------------------------------------------------------

function ReelEstimation({
  reel,
  selectedIndex,
  onSelectOption,
  onContinue,
  cardStyle,
  microSignal,
}: {
  reel: DisplayEstimation
  selectedIndex: number | undefined
  onSelectOption: (index: number) => void
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
}) {
  const answered = selectedIndex !== undefined
  const correct = answered && selectedIndex === reel.correctIndex

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <ReelHeader type="estimation" prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {reel.options.map((option, i) => {
            const isSelected = selectedIndex === i
            const isCorrect = i === reel.correctIndex
            return (
              <Button
                key={i}
                variant="outline"
                disabled={answered}
                className={cn(
                  "h-auto min-h-[52px] py-3 px-3 text-sm font-mono font-bold rounded-2xl border-2 transition-all duration-200 ease-out sm:min-h-[60px] sm:text-base",
                  !answered &&
                    "border-border/80 bg-background/50 text-foreground hover:border-accent/40 hover:bg-accent/5 active:scale-[0.98] touch-manipulation cursor-pointer",
                  answered && isCorrect && isSelected &&
                    "border-chart-2 bg-chart-2/15 text-chart-2 cursor-default",
                  answered && isCorrect && !isSelected &&
                    "border-chart-2/80 bg-chart-2/10 text-chart-2 cursor-default",
                  answered && isSelected && !isCorrect &&
                    "border-destructive/80 bg-destructive/10 text-destructive cursor-default",
                  answered && !isSelected && !isCorrect &&
                    "border-border/60 bg-muted/30 text-muted-foreground cursor-default"
                )}
                onClick={() => !answered && onSelectOption(i)}
              >
                {option}
              </Button>
            )
          })}
        </div>
        <FeedbackBlock answered={answered} correct={correct} explanation={reel.explanation} onContinue={onContinue} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Generic option-based reel (fill_blank, spot_error, component_picker,
// interview_moment, what_breaks, incident — all use MCQ layout with type badge)
// ---------------------------------------------------------------------------

type GenericOptionReel =
  | DisplayFillBlank
  | DisplaySpotError
  | DisplayComponentPicker
  | DisplayInterviewMoment
  | DisplayWhatBreaks
  | DisplayIncident

function ReelGenericOptions({
  reel,
  selectedIndex,
  onSelectOption,
  onContinue,
  cardStyle,
  microSignal,
}: {
  reel: GenericOptionReel
  selectedIndex: number | undefined
  onSelectOption: (index: number) => void
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
}) {
  const answered = selectedIndex !== undefined
  const correct = answered && selectedIndex === reel.correctIndex

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <ReelHeader type={reel.type} prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <OptionsList
          options={reel.options}
          correctIndex={reel.correctIndex}
          selectedIndex={selectedIndex}
          answered={answered}
          onSelect={onSelectOption}
        />
        <FeedbackBlock answered={answered} correct={correct} explanation={reel.explanation} onContinue={onContinue} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Ordering (drag to reorder)
// ---------------------------------------------------------------------------

function ReelOrdering({
  reel,
  onContinue,
  cardStyle,
  microSignal,
  selectedIndex,
  onSelectOption,
}: {
  reel: DisplayOrdering
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
  selectedIndex?: number
  onSelectOption?: (index: number) => void
}) {
  const correctOrder = reel.metadata.items
  const [userOrder, setUserOrder] = React.useState<string[]>(() => {
    const shuffled = [...correctOrder]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  })
  const [submitted, setSubmitted] = React.useState(false)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)

  const isCorrect = submitted && userOrder.every((item, i) => item === correctOrder[i])

  const moveItem = (from: number, to: number) => {
    if (submitted) return
    setUserOrder((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const handleSubmit = () => {
    setSubmitted(true)
    const correct = userOrder.every((item, i) => item === correctOrder[i])
    onSelectOption?.(correct ? 0 : 1)
  }

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <ReelHeader type="ordering" prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <ul className="space-y-2 sm:space-y-3">
          {userOrder.map((item, i) => {
            const correctPosition = correctOrder.indexOf(item)
            const isInCorrectPosition = submitted && correctPosition === i
            return (
              <li
                key={item}
                draggable={!submitted}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => { e.preventDefault() }}
                onDrop={() => { if (dragIndex !== null) moveItem(dragIndex, i); setDragIndex(null) }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border-2 px-3 py-3 text-sm transition-all sm:px-5 sm:py-4 sm:text-base",
                  !submitted && "border-border/80 bg-background/50 cursor-grab active:cursor-grabbing hover:border-accent/40",
                  submitted && isInCorrectPosition && "border-chart-2 bg-chart-2/10 text-chart-2",
                  submitted && !isInCorrectPosition && "border-destructive/60 bg-destructive/5 text-destructive"
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold sm:h-8 sm:w-8">
                  {i + 1}
                </span>
                <span className="break-words">{item}</span>
                {!submitted && (
                  <div className="ml-auto flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs p-0.5 touch-manipulation"
                      onClick={() => i > 0 && moveItem(i, i - 1)}
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs p-0.5 touch-manipulation"
                      onClick={() => i < userOrder.length - 1 && moveItem(i, i + 1)}
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {!submitted && (
          <Button onClick={handleSubmit} className={CONTINUE_BTN_CLASS}>
            Check Order
          </Button>
        )}

        {submitted && (
          <FeedbackBlock
            answered
            correct={isCorrect}
            explanation={reel.explanation}
            onContinue={onContinue}
          />
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Free Text (type answer)
// ---------------------------------------------------------------------------

function ReelFreeText({
  reel,
  onContinue,
  cardStyle,
  microSignal,
  onSelectOption,
}: {
  reel: DisplayFreeText
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
  onSelectOption?: (index: number) => void
}) {
  const [text, setText] = React.useState("")
  const [submitted, setSubmitted] = React.useState(false)

  const handleSubmit = () => {
    if (!text.trim()) return
    setSubmitted(true)
    onSelectOption?.(0)
  }

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <ReelHeader type="free_text" prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-3 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitted}
          placeholder="Type your answer..."
          className={cn(
            "w-full min-h-[100px] rounded-xl border-2 bg-background/50 px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors sm:min-h-[140px] sm:text-base",
            submitted && "opacity-70"
          )}
          rows={4}
        />
        {!submitted && (
          <Button onClick={handleSubmit} disabled={!text.trim()} className={CONTINUE_BTN_CLASS}>
            Submit
          </Button>
        )}
        {submitted && (
          <div className="animate-in fade-in duration-200 slide-in-from-bottom-2">
            <div className="pl-4 border-l-2 border-accent sm:pl-5">
              <p className="text-sm font-semibold text-accent sm:text-base mb-1">Model Answer</p>
              <p className="text-sm text-reel-secondary leading-relaxed break-words sm:text-base">
                {reel.explanation}
              </p>
            </div>
            <Button onClick={onContinue} className={cn(CONTINUE_BTN_CLASS, "mt-3")}>
              Continue
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Voice (speak your answer)
// ---------------------------------------------------------------------------

function ReelVoice({
  reel,
  onContinue,
  cardStyle,
  microSignal,
  onSelectOption,
}: {
  reel: DisplayReel
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
  onSelectOption?: (index: number) => void
}) {
  const [isRecording, setIsRecording] = React.useState(false)
  const [transcript, setTranscript] = React.useState("")
  const [submitted, setSubmitted] = React.useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = React.useRef<any>(null)

  const startRecording = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setTranscript("Speech recognition not supported in this browser.")
      return
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let result = ""
      for (let i = 0; i < event.results.length; i++) {
        result += event.results[i][0].transcript
      }
      setTranscript(result)
    }
    recognition.onerror = () => { setIsRecording(false) }
    recognition.onend = () => { setIsRecording(false) }
    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  const handleSubmit = () => {
    if (!transcript.trim()) return
    setSubmitted(true)
    onSelectOption?.(0)
  }

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <ReelHeader type="voice" prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-3 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        {!submitted && (
          <>
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  "h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300 touch-manipulation sm:h-20 sm:w-20",
                  isRecording
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "bg-accent text-accent-foreground hover:bg-accent/90"
                )}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                <span className="text-2xl sm:text-3xl">{isRecording ? "■" : "🎙"}</span>
              </button>
              <p className="text-xs text-muted-foreground">
                {isRecording ? "Listening... tap to stop" : "Tap to speak your answer"}
              </p>
            </div>
            {transcript && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 sm:p-4">
                <p className="text-sm text-foreground leading-relaxed sm:text-base">{transcript}</p>
              </div>
            )}
            {transcript && !isRecording && (
              <Button onClick={handleSubmit} className={CONTINUE_BTN_CLASS}>
                Submit
              </Button>
            )}
          </>
        )}
        {submitted && (
          <div className="animate-in fade-in duration-200 slide-in-from-bottom-2">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 mb-3 sm:p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Your answer</p>
              <p className="text-sm text-foreground leading-relaxed sm:text-base">{transcript}</p>
            </div>
            <div className="pl-4 border-l-2 border-accent sm:pl-5">
              <p className="text-sm font-semibold text-accent sm:text-base mb-1">Model Answer</p>
              <p className="text-sm text-reel-secondary leading-relaxed break-words sm:text-base">
                {reel.explanation}
              </p>
            </div>
            <Button onClick={onContinue} className={cn(CONTINUE_BTN_CLASS, "mt-3")}>
              Continue
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Diagram-based types (label_diagram, spot_spof)
// Renders mermaid source as a styled code block + options
// ---------------------------------------------------------------------------

function DiagramBlock({ mermaid }: { mermaid: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3 overflow-x-auto sm:p-4">
      <pre className="text-[11px] leading-relaxed font-mono text-muted-foreground whitespace-pre-wrap break-words sm:text-xs">
        {mermaid}
      </pre>
    </div>
  )
}

function ReelDiagram({
  reel,
  selectedIndex,
  onSelectOption,
  onContinue,
  cardStyle,
  microSignal,
}: {
  reel: (DisplayReel & { metadata?: { kind: "diagram"; mermaid: string } | null })
  selectedIndex: number | undefined
  onSelectOption: (index: number) => void
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
}) {
  const answered = selectedIndex !== undefined
  const correctIdx = reel.correctIndex ?? 0
  const correct = answered && selectedIndex === correctIdx

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <ReelHeader type={reel.type} prompt={reel.prompt} microSignal={microSignal} />
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-5 sm:px-8 sm:pb-10 md:px-10">
        {reel.metadata?.kind === "diagram" && reel.metadata.mermaid && (
          <DiagramBlock mermaid={reel.metadata.mermaid} />
        )}
        <OptionsList
          options={reel.options ?? []}
          correctIndex={correctIdx}
          selectedIndex={selectedIndex}
          answered={answered}
          onSelect={onSelectOption}
        />
        <FeedbackBlock answered={answered} correct={correct} explanation={reel.explanation} onContinue={onContinue} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Progressive chain indicator
// ---------------------------------------------------------------------------

function ChainIndicator({ order, total }: { order: number; total?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total ?? 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 w-6 rounded-full transition-colors",
            i <= order ? "bg-accent" : "bg-muted"
          )}
        />
      ))}
      <span className="text-[10px] text-muted-foreground ml-1">Step {order + 1}</span>
    </div>
  )
}

function ReelProgressive({
  reel,
  selectedIndex,
  onSelectOption,
  onContinue,
  cardStyle,
  microSignal,
}: {
  reel: DisplayReel & { chainId?: string; chainOrder?: number }
  selectedIndex: number | undefined
  onSelectOption: (index: number) => void
  onContinue: () => void
  cardStyle?: React.CSSProperties
  microSignal?: string | null
}) {
  const answered = selectedIndex !== undefined
  const correctIdx = reel.correctIndex ?? 0
  const correct = answered && selectedIndex === correctIdx

  return (
    <Card className={cn(cardBaseClass, "max-h-[85dvh] overflow-y-auto sm:max-h-none sm:overflow-visible")} style={cardStyle}>
      <CardHeader className="space-y-2 pt-3 pb-2 px-3 min-w-0 sm:pb-6 sm:pt-8 sm:px-8 md:px-10">
        <div className="flex items-center gap-3 flex-wrap">
          <TypeBadge type="progressive" />
          <ChainIndicator order={reel.chainOrder ?? 0} />
          {microSignal && (
            <p className="text-xs italic text-muted-foreground/70 animate-in fade-in duration-300">
              {microSignal}
            </p>
          )}
        </div>
        <CardTitle className="text-base font-semibold leading-tight tracking-tight break-words sm:text-xl md:text-2xl text-foreground">
          {reel.prompt}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-4 max-w-prose min-w-0 sm:space-y-6 sm:px-8 sm:pb-10 md:px-10">
        <OptionsList
          options={reel.options ?? []}
          correctIndex={correctIdx}
          selectedIndex={selectedIndex}
          answered={answered}
          onSelect={onSelectOption}
        />
        <FeedbackBlock answered={answered} correct={correct} explanation={reel.explanation} onContinue={onContinue} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main ReelCard entry point
// ---------------------------------------------------------------------------

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

  switch (reel.type) {
    case "flash":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelFlash reel={reel} onContinue={onContinue} cardStyle={cardStyle} microSignal={microSignal} />
        </section>
      )

    case "binary":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelBinary
            reel={reel as DisplayBinary}
            selectedIndex={selectedIndex}
            onSelectOption={onSelectOption!}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
          />
        </section>
      )

    case "this_or_that":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelThisOrThat
            reel={reel as DisplayThisOrThat}
            selectedIndex={selectedIndex}
            onSelectOption={onSelectOption!}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
          />
        </section>
      )

    case "hot_take":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelHotTake
            reel={reel as DisplayHotTake}
            selectedIndex={selectedIndex}
            onSelectOption={onSelectOption!}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
          />
        </section>
      )

    case "estimation":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelEstimation
            reel={reel as DisplayEstimation}
            selectedIndex={selectedIndex}
            onSelectOption={onSelectOption!}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
          />
        </section>
      )

    case "ordering":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelOrdering
            reel={reel as DisplayOrdering}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
            selectedIndex={selectedIndex}
            onSelectOption={onSelectOption}
          />
        </section>
      )

    case "free_text":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelFreeText
            reel={reel as DisplayFreeText}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
            onSelectOption={onSelectOption}
          />
        </section>
      )

    case "voice":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelVoice
            reel={reel}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
            onSelectOption={onSelectOption}
          />
        </section>
      )

    // All standard option-based types: fill_blank, spot_error, component_picker,
    // interview_moment, what_breaks, incident
    case "fill_blank":
    case "spot_error":
    case "component_picker":
    case "interview_moment":
    case "what_breaks":
    case "incident":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelGenericOptions
            reel={reel as GenericOptionReel}
            selectedIndex={selectedIndex}
            onSelectOption={onSelectOption!}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
          />
        </section>
      )

    case "label_diagram":
    case "spot_spof":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelDiagram
            reel={reel as DisplayReel & { metadata?: { kind: "diagram"; mermaid: string } | null }}
            selectedIndex={selectedIndex}
            onSelectOption={onSelectOption!}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
          />
        </section>
      )

    case "progressive":
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelProgressive
            reel={reel as DisplayReel & { chainId?: string; chainOrder?: number }}
            selectedIndex={selectedIndex}
            onSelectOption={onSelectOption!}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
          />
        </section>
      )

    // MCQ and any unknown type fall through to MCQ rendering
    default:
      return (
        <section className="flex min-h-full w-full min-w-0 flex-col items-center justify-center px-3 py-3 touch-manipulation sm:px-6 sm:py-12">
          <ReelMCQ
            reel={reel as DisplayMCQ}
            selectedIndex={selectedIndex}
            onSelectOption={onSelectOption!}
            onContinue={onContinue}
            cardStyle={cardStyle}
            microSignal={microSignal}
          />
        </section>
      )
  }
}
