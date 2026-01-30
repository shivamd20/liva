import { useRef, useCallback, useState, useEffect, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { trpcClient } from "@/trpcClient"
import { ReelCard } from "./ReelCard"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BarChart2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { REEL_THEMES, type ReelTheme, type ApiReel } from "./types"
import { ProgressView } from "./ProgressView"
import { Skeleton } from "@/components/ui/skeleton"
import { useReelsFeed, type FeedSegment } from "./useReelsFeed"

export type { ReelTheme } from "./types"

const SKELETON_COUNT = 3

/** Persisted local answer state (serializable for query cache). */
const LOCAL_ANSWER_STATE_KEY = ["system-shots", "local-answer-state"] as const
const EMPTY_ANSWER_STATE = {
  submittedReelIds: [] as string[],
  submittedAnswerReelIds: [] as string[],
  answeredByReelId: {} as Record<string, number>,
}
type LocalAnswerState = typeof EMPTY_ANSWER_STATE

export interface SystemShotsPageProps {
  onBack: () => void
}

export function SystemShotsPage({ onBack }: SystemShotsPageProps) {
  const queryClient = useQueryClient()
  const [showProgressView, setShowProgressView] = useState(false)
  const [currentReelIndex, setCurrentReelIndex] = useState(0)

  const { data: localAnswerState = EMPTY_ANSWER_STATE } = useQuery({
    queryKey: LOCAL_ANSWER_STATE_KEY,
    queryFn: () => EMPTY_ANSWER_STATE,
    initialData: EMPTY_ANSWER_STATE,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const feed = useReelsFeed({
    initialContinuedIds: localAnswerState.submittedAnswerReelIds,
    onError: (err) => toast.error(err === "Unauthorized" ? "Please sign in." : err),
  })
  const { segments, reelsToShow, loadSegment, markContinued } = feed

  const reelRefs = useRef<(HTMLElement | null)[]>([])
  const skipObservedRef = useRef<Set<string>>(new Set())

  const submittedReelIds = useMemo(
    () => new Set(localAnswerState.submittedReelIds),
    [localAnswerState.submittedReelIds]
  )
  const submittedAnswerReelIds = useMemo(
    () => new Set(localAnswerState.submittedAnswerReelIds),
    [localAnswerState.submittedAnswerReelIds]
  )
  const answeredByReelId = localAnswerState.answeredByReelId

  const updateLocalAnswerState = useCallback(
    (updater: (prev: LocalAnswerState) => LocalAnswerState) => {
      queryClient.setQueryData(LOCAL_ANSWER_STATE_KEY, (prev: LocalAnswerState | undefined) =>
        updater(prev ?? EMPTY_ANSWER_STATE)
      )
    },
    [queryClient]
  )

  const submitAnswerMutation = useMutation({
    mutationFn: (input: { reelId: string; selectedIndex: number | null; correct: boolean; skipped?: boolean }) =>
      trpcClient.systemShots.submitAnswer.mutate(input),
    onError: (_error, variables) => {
      const { reelId, skipped } = variables
      updateLocalAnswerState((prev) => ({
        submittedReelIds: prev.submittedReelIds.filter((id) => id !== reelId),
        submittedAnswerReelIds: prev.submittedAnswerReelIds.filter((id) => id !== reelId),
        answeredByReelId: Object.fromEntries(
          Object.entries(prev.answeredByReelId).filter(([id]) => id !== reelId)
        ),
      }))
      if (skipped) skipObservedRef.current.delete(reelId)
      toast.error("Failed to save. You can try again.")
    },
  })

  const handleSelectOption = useCallback(
    (reel: ApiReel, index: number) => {
      if (submittedAnswerReelIds.has(reel.id)) return
      const correct = reel.correctIndex !== null && index === reel.correctIndex
      // Only update answeredByReelId and submittedReelIds - do NOT add to submittedAnswerReelIds
      // The card should remain visible so user can see feedback and click Continue
      updateLocalAnswerState((prev) => ({
        submittedReelIds: [...prev.submittedReelIds, reel.id],
        submittedAnswerReelIds: prev.submittedAnswerReelIds,
        answeredByReelId: { ...prev.answeredByReelId, [reel.id]: index },
      }))
      submitAnswerMutation.mutate({ reelId: reel.id, selectedIndex: index, correct, skipped: false })
    },
    [submittedAnswerReelIds, submitAnswerMutation, updateLocalAnswerState]
  )

  const scrollToReel = useCallback((index: number) => {
    setTimeout(() => {
      reelRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }, [])

  const handleContinue = useCallback(
    (reel: ApiReel, _selectedIndex: number | undefined, index: number) => {
      if (reel.type === "flash") {
        if (submittedAnswerReelIds.has(reel.id)) return
        updateLocalAnswerState((prev) => ({
          submittedReelIds: [...prev.submittedReelIds, reel.id],
          submittedAnswerReelIds: [...prev.submittedAnswerReelIds, reel.id],
          answeredByReelId: prev.answeredByReelId,
        }))
        submitAnswerMutation.mutate({ reelId: reel.id, selectedIndex: null, correct: false, skipped: true })
      }
      // For MCQ, don't add to submittedAnswerReelIds - keep the card visible with feedback
      markContinued(reel.id)
      const nextIndex = index + 1
      if (nextIndex < reelsToShow.length) scrollToReel(nextIndex)
    },
    [reelsToShow.length, submittedAnswerReelIds, submitAnswerMutation, scrollToReel, updateLocalAnswerState, markContinued]
  )

  const submitSkip = useCallback(
    (reelId: string) => {
      if (skipObservedRef.current.has(reelId) || submittedReelIds.has(reelId)) return
      skipObservedRef.current.add(reelId)
      updateLocalAnswerState((prev) => ({
        ...prev,
        submittedReelIds: [...prev.submittedReelIds, reelId],
      }))
      submitAnswerMutation.mutate({ reelId, selectedIndex: null, correct: false, skipped: true })
    },
    [submittedReelIds, submitAnswerMutation, updateLocalAnswerState]
  )

  // Track current reel for progress bar
  useEffect(() => {
    const nodes = reelRefs.current
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = nodes.indexOf(entry.target as HTMLElement)
          if (index !== -1) setCurrentReelIndex(index)
        }
      },
      { threshold: 0.5 }
    )
    nodes.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [reelsToShow.length])

  // Mark as skipped when scrolled away without answering
  useEffect(() => {
    if (reelsToShow.length === 0) return
    const reelElements = reelRefs.current
    const reelIds = reelsToShow.map((r) => r.id)
    const seenReels = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = reelElements.indexOf(entry.target as HTMLElement)
          if (index === -1) continue
          const reelId = reelIds[index]
          if (!reelId) continue

          if (entry.isIntersecting) {
            seenReels.add(reelId)
          } else if (seenReels.has(reelId)) {
            const alreadySubmitted = submittedReelIds.has(reelId)
            const answered = answeredByReelId[reelId] !== undefined
            if (!alreadySubmitted && !answered) submitSkip(reelId)
          }
        }
      },
      { threshold: 0 }
    )
    reelElements.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [reelsToShow, answeredByReelId, submittedReelIds, submitSkip])

  // Check if initial loading (either old sentinel loading or new reels segment with no reels yet)
  const isInitialLoading = 
    (segments.length === 1 && segments[0].type === "sentinel" && segments[0].status === "loading") ||
    (segments.length === 1 && segments[0].type === "reels" && segments[0].status === "loading" && (!segments[0].reels || segments[0].reels.length === 0))
  
  // Check if we're streaming more reels (reels segment exists with loading status and has some reels)
  const isStreaming = segments.some((s) => s.type === "reels" && s.status === "loading" && s.reels && s.reels.length > 0)
  
  const hasNoReels = reelsToShow.length === 0 && !isInitialLoading && !isStreaming

  const progressPercent = reelsToShow.length > 0 ? ((currentReelIndex + 1) / reelsToShow.length) * 100 : 0

  if (showProgressView) {
    return <ProgressView onBack={() => setShowProgressView(false)} />
  }

  // Build flat list with reel index tracking
  let reelIndex = 0

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-30 h-0.5 w-full bg-muted/40" aria-hidden>
        <div
          className="h-full bg-accent/90 rounded-r-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="fixed top-5 left-5 z-20 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-background/70 text-foreground shadow-sm backdrop-blur-md hover:bg-background/90"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Progress view button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowProgressView(true)}
        className="fixed top-5 right-5 z-20 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-background/70 text-foreground shadow-sm backdrop-blur-md hover:bg-background/90"
        aria-label="View progress"
      >
        <BarChart2 className="h-5 w-5" />
      </Button>

      {/* Main content */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory overscroll-contain touch-pan-y">
        {/* Render segments in order */}
        {segments.map((segment) => {
          if (segment.type === "reels") {
            // Render reels from this segment
            const reelElements = (segment.reels ?? [])
              .filter((reel) => !new Set(localAnswerState.submittedAnswerReelIds).has(reel.id))
              .map((reel) => {
                const i = reelIndex++
                const theme: ReelTheme = REEL_THEMES[i % REEL_THEMES.length]
                const themeVar = `var(--color-${theme})`
                const dynamicBg = {
                  height: "100dvh" as const,
                  minHeight: "100dvh" as const,
                  background: `
                    linear-gradient(135deg, color-mix(in oklch, ${themeVar} 4%, var(--background)) 0%, transparent 50%),
                    linear-gradient(225deg, color-mix(in oklch, ${themeVar} 3%, var(--background)) 0%, transparent 45%),
                    linear-gradient(to bottom, var(--background) 0%, color-mix(in oklch, ${themeVar} 6%, var(--muted)) 100%)
                  `,
                  backgroundSize: "200% 200%, 200% 200%, 100% 100%",
                }
                const displayReel =
                  reel.type === "mcq"
                    ? {
                        id: reel.id,
                        type: "mcq" as const,
                        prompt: reel.prompt,
                        explanation: reel.explanation,
                        options: reel.options ?? [],
                        correctIndex: reel.correctIndex ?? 0,
                      }
                    : {
                        id: reel.id,
                        type: "flash" as const,
                        prompt: reel.prompt,
                        explanation: reel.explanation,
                      }
                return (
                  <div
                    key={reel.id}
                    ref={(el) => { reelRefs.current[i] = el }}
                    className="typeform-bg w-full shrink-0 snap-start snap-always"
                    style={dynamicBg}
                  >
                    <ReelCard
                      reel={displayReel}
                      theme={theme}
                      reelIndex={i}
                      selectedIndex={reel.type === "mcq" ? answeredByReelId[reel.id] : undefined}
                      onSelectOption={reel.type === "mcq" ? (index) => handleSelectOption(reel, index) : undefined}
                      onContinue={() => handleContinue(reel, answeredByReelId[reel.id], i)}
                      microSignal={reel.microSignal}
                    />
                  </div>
                )
              })

            // If segment is still streaming and has no reels yet, show skeleton
            if (segment.status === "loading" && reelElements.length === 0) {
              return (
                <div
                  key={`streaming-skeleton-${segment.id}`}
                  className="flex min-h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center p-6"
                >
                  <div className="w-full max-w-2xl space-y-4">
                    <Skeleton className="h-8 w-full rounded-lg" />
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                </div>
              )
            }

            // If segment is still streaming and has some reels, show streaming indicator after reels
            if (segment.status === "loading" && reelElements.length > 0) {
              return [
                ...reelElements,
                <div
                  key={`streaming-indicator-${segment.id}`}
                  className="flex min-h-[50dvh] w-full shrink-0 items-center justify-center"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading more...</p>
                  </div>
                </div>
              ]
            }

            return reelElements
          }

          if (segment.type === "sentinel") {
            return (
              <SentinelSection
                key={segment.id}
                segment={segment}
                onLoad={() => loadSegment(segment.id)}
                isInitial={segments.length === 1}
              />
            )
          }

          return null
        })}

        {/* Empty state */}
        {hasNoReels && (
          <div className="flex min-h-[100dvh] w-full items-center justify-center">
            <p className="text-muted-foreground">No reels available. Try again later.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Sentinel section - auto-loads on scroll via IntersectionObserver */
function SentinelSection({
  segment,
  onLoad,
  isInitial,
}: {
  segment: FeedSegment
  onLoad: () => void
  isInitial: boolean
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { status } = segment

  // Auto-load when sentinel becomes visible (infinite scroll)
  useEffect(() => {
    if (status !== "idle") return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoad()
        }
      },
      { rootMargin: "200px" } // Trigger slightly before visible for smoother UX
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [status, onLoad])

  // Initial loading - show skeleton
  if (isInitial && status === "loading") {
    return (
      <>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="flex min-h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center p-6"
          >
            <div className="w-full max-w-2xl space-y-4">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </>
    )
  }

  // Done - no more reels
  if (status === "done") {
    return (
      <div className="flex min-h-[50dvh] w-full items-center justify-center">
        <p className="text-muted-foreground">You've reached the end!</p>
      </div>
    )
  }

  // Error state - manual retry required
  if (status === "error") {
    return (
      <div className="flex min-h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-destructive">Failed to load reels</p>
          <Button onClick={onLoad} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Loading state (non-initial) - show skeleton card
  if (status === "loading") {
    return (
      <div className="flex min-h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  // Idle - invisible trigger element with fallback button for accessibility
  return (
    <div 
      ref={sentinelRef}
      className="flex min-h-[50dvh] w-full shrink-0 items-center justify-center"
    >
      {/* Fallback button for accessibility (hidden by default, shows if JS fails) */}
      <Button 
        onClick={onLoad} 
        variant="ghost" 
        size="sm"
        className="text-muted-foreground hover:text-foreground"
      >
        Load More
      </Button>
    </div>
  )
}
