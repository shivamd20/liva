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
import { useReelsFeed } from "./useReelsFeed"
import { useLoadMoreTrigger } from "./useLoadMoreTrigger"

export type { ReelTheme } from "./types"

const SKELETON_COUNT = 10

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
  const { reelsToShow, reels, status, error, loadMore, retry, markContinued } = feed

  const loadMoreRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastReelId = reelsToShow.length > 0 ? reelsToShow[reelsToShow.length - 1]?.id ?? null : null
  
  // Track reels count before loading to auto-scroll to first new reel
  const prevReelsCountRef = useRef(reelsToShow.length)
  const wasLoadingMoreRef = useRef(false)
  const reelRefs = useRef<(HTMLElement | null)[]>([])
  
  // Auto-scroll to first new reel when load-more completes
  useEffect(() => {
    const wasLoading = wasLoadingMoreRef.current
    const isLoading = status === "loadingMore"
    const prevCount = prevReelsCountRef.current
    const currentCount = reelsToShow.length
    
    // Loading just completed and we have new reels
    if (wasLoading && !isLoading && currentCount > prevCount) {
      // Scroll to the first new reel
      const firstNewReelIndex = prevCount
      setTimeout(() => {
        reelRefs.current[firstNewReelIndex]?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 50)
    }
    
    // Update refs for next comparison
    wasLoadingMoreRef.current = isLoading
    if (!isLoading) {
      prevReelsCountRef.current = currentCount
    }
  }, [status, reelsToShow.length])
  
  const loadMoreTrigger = useLoadMoreTrigger({
    sentinelRef: loadMoreRef,
    scrollRootRef: scrollContainerRef,
    isLoading: status === "loadingMore",
    lastReelId,
    onRequestMore: loadMore,
  })

  const submittedReelIds = useMemo(
    () => new Set(localAnswerState.submittedReelIds),
    [localAnswerState.submittedReelIds]
  )
  const submittedAnswerReelIds = useMemo(
    () => new Set(localAnswerState.submittedAnswerReelIds),
    [localAnswerState.submittedAnswerReelIds]
  )
  const answeredByReelId = localAnswerState.answeredByReelId
  const skipObservedRef = useRef<Set<string>>(new Set())
  const reelHasBeenInViewRef = useRef<Set<string>>(new Set())

  type SubmitAnswerInput = {
    reelId: string
    selectedIndex: number | null
    correct: boolean
    skipped?: boolean
  }

  const updateLocalAnswerState = useCallback(
    (updater: (prev: LocalAnswerState) => LocalAnswerState) => {
      queryClient.setQueryData(LOCAL_ANSWER_STATE_KEY, (prev: LocalAnswerState | undefined) =>
        updater(prev ?? EMPTY_ANSWER_STATE)
      )
    },
    [queryClient]
  )

  const submitAnswerMutation = useMutation({
    mutationFn: (input: SubmitAnswerInput) =>
      trpcClient.systemShots.submitAnswer.mutate(input),
    onError: (_error, variables: SubmitAnswerInput) => {
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
      const correct =
        reel.correctIndex !== null && index === reel.correctIndex
      updateLocalAnswerState((prev) => ({
        submittedReelIds: [...prev.submittedReelIds, reel.id],
        submittedAnswerReelIds: [...prev.submittedAnswerReelIds, reel.id],
        answeredByReelId: { ...prev.answeredByReelId, [reel.id]: index },
      }))
      submitAnswerMutation.mutate({
        reelId: reel.id,
        selectedIndex: index,
        correct,
        skipped: false,
      })
    },
    [submittedAnswerReelIds, submitAnswerMutation, updateLocalAnswerState]
  )

  const scrollToNextReel = useCallback((nextIndex: number) => {
    setTimeout(() => {
      reelRefs.current[nextIndex]?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }, [])

  const handleContinue = useCallback(
    (reel: ApiReel, _selectedIndex: number | undefined, index: number) => {
      const isFlash = reel.type === "flash"
      if (isFlash) {
        if (submittedAnswerReelIds.has(reel.id)) return
        updateLocalAnswerState((prev) => ({
          submittedReelIds: [...prev.submittedReelIds, reel.id],
          submittedAnswerReelIds: [...prev.submittedAnswerReelIds, reel.id],
          answeredByReelId: prev.answeredByReelId,
        }))
        submitAnswerMutation.mutate({
          reelId: reel.id,
          selectedIndex: null,
          correct: false,
          skipped: true,
        })
      }
      markContinued(reel.id)
      const nextIndex = index + 1
      if (nextIndex < reelsToShow.length) scrollToNextReel(nextIndex)
    },
    [reelsToShow.length, submittedAnswerReelIds, submitAnswerMutation, scrollToNextReel, updateLocalAnswerState, markContinued]
  )

  const submitSkip = useCallback(
    (reelId: string) => {
      if (skipObservedRef.current.has(reelId) || submittedReelIds.has(reelId)) return
      skipObservedRef.current.add(reelId)
      updateLocalAnswerState((prev) => ({
        ...prev,
        submittedReelIds: [...prev.submittedReelIds, reelId],
      }))
      submitAnswerMutation.mutate({
        reelId,
        selectedIndex: null,
        correct: false,
        skipped: true,
      })
    },
    [submittedReelIds, submitAnswerMutation, updateLocalAnswerState]
  )

  // Current reel index (for progress bar).
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
      { threshold: 0.5, rootMargin: "0px" }
    )
    nodes.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [reelsToShow.length])

  // Skip when scrolled away (intersection).
  useEffect(() => {
    if (reelsToShow.length === 0) return
    const reelElements = reelRefs.current
    const reelIds = reelsToShow.map((r) => r.id)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement
          const index = reelElements.indexOf(el)
          if (index === -1) continue
          const reelId = reelIds[index]
          if (!reelId) continue
          if (entry.isIntersecting) {
            reelHasBeenInViewRef.current.add(reelId)
            continue
          }
          const wasInView = reelHasBeenInViewRef.current.has(reelId)
          const alreadySubmitted = submittedReelIds.has(reelId)
          const answered = answeredByReelId[reelId] !== undefined
          if (wasInView && !alreadySubmitted && !answered) submitSkip(reelId)
        }
      },
      { threshold: 0, rootMargin: "0px" }
    )
    reelElements.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [reelsToShow, answeredByReelId, submittedReelIds, submitSkip])

  const progressPercent = reelsToShow.length > 0 ? ((currentReelIndex + 1) / reelsToShow.length) * 100 : 0
  const showEmpty = reelsToShow.length === 0 && status !== "initial" && !error
  const showSkeleton = reels.length === 0 && status === "initial"
  const showErrorBanner = error && reelsToShow.length > 0
  const isFetchingNextPage = status === "loadingMore"

  const handleRetry = useCallback(() => {
    loadMoreTrigger.resetRequestedCursor()
    retry()
  }, [loadMoreTrigger, retry])

  if (showProgressView) {
    return <ProgressView onBack={() => setShowProgressView(false)} />
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
      <div
        className="fixed top-0 left-0 right-0 z-30 h-0.5 w-full bg-muted/40"
        aria-hidden
      >
        <div
          className="h-full bg-accent/90 rounded-r-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="fixed top-5 left-5 z-20 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-background/70 text-foreground shadow-sm backdrop-blur-md hover:bg-background/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] touch-manipulation transition-all duration-200"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowProgressView(true)}
        className="fixed top-5 right-5 z-20 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-background/70 text-foreground shadow-sm backdrop-blur-md hover:bg-background/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] touch-manipulation transition-all duration-200"
        aria-label="View progress"
      >
        <BarChart2 className="h-5 w-5" />
      </Button>

      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory overscroll-contain touch-pan-y"
      >
        {showSkeleton && (
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
        )}

        {showEmpty && !showSkeleton && (
          <div className="flex min-h-[100dvh] w-full items-center justify-center">
            <p className="text-muted-foreground">No reels yet. Try again in a moment.</p>
          </div>
        )}

        {reelsToShow.map((reel, i) => {
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
              ref={(el) => {
                reelRefs.current[i] = el
              }}
              className="typeform-bg w-full shrink-0 snap-start snap-always"
              style={dynamicBg}
            >
              <ReelCard
                reel={displayReel}
                theme={theme}
                reelIndex={i}
                selectedIndex={
                  reel.type === "mcq" ? answeredByReelId[reel.id] : undefined
                }
                onSelectOption={
                  reel.type === "mcq"
                    ? (index) => handleSelectOption(reel, index)
                    : undefined
                }
                onContinue={() =>
                  handleContinue(reel, answeredByReelId[reel.id], i)
                }
              />
            </div>
          )
        })}

        {reelsToShow.length > 0 && (
          <div
            ref={loadMoreRef}
            className="flex min-h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className={isFetchingNextPage ? "h-8 w-8 animate-spin" : "h-8 w-8"} />
              <p>{isFetchingNextPage ? "Loading more…" : "Scroll for more…"}</p>
            </div>
          </div>
        )}

        {showErrorBanner && (
          <div className="sticky bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-4 bg-destructive/10 px-4 py-3 text-destructive">
            <span>Could not load more. Retry?</span>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
