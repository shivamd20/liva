import { useRef, useCallback, useState, useEffect } from "react"
import { useInfiniteQuery, useMutation } from "@tanstack/react-query"
import { trpcClient } from "@/trpcClient"
import { ReelCard } from "./ReelCard"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BarChart2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { REEL_THEMES, type ReelTheme } from "./types"
import { mockReels } from "./mockReels"
import { ProgressView } from "./ProgressView"

export type { ReelTheme } from "./types"

/** API reel shape (getReels) – compatible with ReelCard display type */
export type ApiReel = {
  id: string
  conceptId: string
  type: "mcq" | "flash"
  prompt: string
  options: string[] | null
  correctIndex: number | null
  explanation: string
  difficulty: number
}

const REELS_PAGE_SIZE = 50
/** Pre-fetch next page when user is this many reels from the end (e.g. 20 = fetch when at reel 30 of 50). */
const PREFETCH_WHEN_REELS_FROM_END = 20
/** Client-side mock only when explicitly set (server-side mock is controlled by USE_SYSTEM_SHOTS_MOCK in wrangler vars). */
const USE_MOCK = import.meta.env.VITE_USE_SYSTEM_SHOTS_MOCK === "true"

export interface SystemShotsPageProps {
  onBack: () => void
}

export function SystemShotsPage({ onBack }: SystemShotsPageProps) {
  const [showProgressView, setShowProgressView] = useState(false)
  const [answeredByReelId, setAnsweredByReelId] = useState<Record<string, number>>({})
  /** Reels we've sent any submit for (answer or skip) – used to avoid double-skip and in skip observer. */
  const [submittedReelIds, setSubmittedReelIds] = useState<Set<string>>(new Set())
  /** Reels we've submitted an answer for (consumed). Block handleContinue only for these; allow answering a reel that was only skipped (scroll-back-and-answer). */
  const [submittedAnswerReelIds, setSubmittedAnswerReelIds] = useState<Set<string>>(new Set())
  const [currentReelIndex, setCurrentReelIndex] = useState(0)
  const reelRefs = useRef<(HTMLElement | null)[]>([])
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const skipObservedRef = useRef<Set<string>>(new Set())
  /** Only count as "skip" when a reel was in view and then left without being answered. Reels below the fold on load must not be marked skipped. */
  const reelHasBeenInViewRef = useRef<Set<string>>(new Set())

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["system-shots", "reels"],
    queryFn: async ({ pageParam }) => {
      const result = await trpcClient.systemShots.getReels.query({
        cursor: pageParam,
        limit: REELS_PAGE_SIZE,
      })
      return result
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !USE_MOCK,
  })

  type SubmitAnswerInput = {
    reelId: string
    selectedIndex: number | null
    correct: boolean
    skipped?: boolean
  }

  const submitAnswerMutation = useMutation({
    mutationFn: (input: SubmitAnswerInput) =>
      trpcClient.systemShots.submitAnswer.mutate(input),
    onError: (error, variables: SubmitAnswerInput) => {
      // Rollback optimistic state so user can retry
      const { reelId, skipped } = variables
      setSubmittedReelIds((prev) => {
        const next = new Set(prev)
        next.delete(reelId)
        return next
      })
      setSubmittedAnswerReelIds((prev) => {
        const next = new Set(prev)
        next.delete(reelId)
        return next
      })
      if (skipped) skipObservedRef.current.delete(reelId)
      toast.error("Failed to save. You can try again.")
    },
    // Do not invalidate reels: keep list for scroll-back; next fetch will get fresh unconsumed reels
  })

  const reels: ApiReel[] = USE_MOCK
    ? (mockReels as ApiReel[])
    : (data?.pages.flatMap((p) => p.reels) ?? []) as ApiReel[]

  const scrollToReel = useCallback((index: number) => {
    reelRefs.current[index]?.scrollIntoView({ behavior: "smooth" })
  }, [])

  /** Submit MCQ answer as soon as user selects an option (not on Continue). */
  const handleSelectOption = useCallback(
    (reel: ApiReel, index: number) => {
      if (submittedAnswerReelIds.has(reel.id)) return
      const correct =
        reel.correctIndex !== null && index === reel.correctIndex
      setAnsweredByReelId((prev) => ({ ...prev, [reel.id]: index }))
      setSubmittedReelIds((prev) => new Set(prev).add(reel.id))
      setSubmittedAnswerReelIds((prev) => new Set(prev).add(reel.id))
      submitAnswerMutation.mutate({
        reelId: reel.id,
        selectedIndex: index,
        correct,
        skipped: false,
      })
    },
    [submittedAnswerReelIds, submitAnswerMutation]
  )

  /** Scroll to the next reel. Short timeout so refs/layout are stable after state commit. */
  const scrollToNextReel = useCallback((nextIndex: number) => {
    setTimeout(() => {
      reelRefs.current[nextIndex]?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }, [])

  /** Continue: for MCQ only scroll (answer already submitted on select); for Flash submit then scroll. */
  const handleContinue = useCallback(
    (reel: ApiReel, selectedIndex: number | undefined, index: number) => {
      const isFlash = reel.type === "flash"
      if (isFlash) {
        if (submittedAnswerReelIds.has(reel.id)) return
        setSubmittedReelIds((prev) => new Set(prev).add(reel.id))
        setSubmittedAnswerReelIds((prev) => new Set(prev).add(reel.id))
        submitAnswerMutation.mutate({
          reelId: reel.id,
          selectedIndex: null,
          correct: false,
          skipped: true,
        })
      }
      const nextIndex = index + 1
      if (nextIndex < reels.length) {
        scrollToNextReel(nextIndex)
      }
    },
    [reels.length, submittedAnswerReelIds, submitAnswerMutation, scrollToNextReel]
  )

  const submitSkip = useCallback(
    (reelId: string) => {
      // Don't skip if already answered (consumed) or already marked skipped
      if (skipObservedRef.current.has(reelId) || submittedReelIds.has(reelId)) return
      skipObservedRef.current.add(reelId)
      // Optimistic update: assume success; onError will rollback
      setSubmittedReelIds((prev) => new Set(prev).add(reelId))
      submitAnswerMutation.mutate({
        reelId,
        selectedIndex: null,
        correct: false,
        skipped: true,
      })
    },
    [submittedReelIds, submitAnswerMutation]
  )

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
  }, [reels.length])

  // Pre-fetch next 50 when user is ~halfway through current batch (e.g. at 30th reel of 50)
  useEffect(() => {
    if (USE_MOCK || reels.length === 0) return
    const reelsFromEnd = reels.length - 1 - currentReelIndex
    if (reelsFromEnd <= PREFETCH_WHEN_REELS_FROM_END && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [currentReelIndex, reels.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    if (USE_MOCK || reels.length === 0) return
    const sentinel = loadMoreRef.current
    const scrollRoot = scrollContainerRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        const [e] = entries
        if (e?.isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      {
        root: scrollRoot,
        rootMargin: "0px 0px 30% 0px",
        threshold: 0,
      }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [reels.length, isFetchingNextPage, fetchNextPage])

  // Skip = user scrolled past a reel that was in view without answering. Do NOT mark reels as skipped just because they're below the fold on load.
  useEffect(() => {
    if (USE_MOCK || reels.length === 0) return
    const reelElements = reelRefs.current
    const reelIds = reels.map((r) => r.id)
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
          // Reel left view: only count as skip if it was in view at least once and user never submitted (answer or skip)
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
  }, [reels, answeredByReelId, submittedReelIds, submitSkip])

  const progressPercent = reels.length > 0 ? ((currentReelIndex + 1) / reels.length) * 100 : 0

  const showEmpty = !USE_MOCK && reels.length === 0 && !isLoading
  const showGenerating = !USE_MOCK && reels.length === 0 && isLoading

  if (showProgressView) {
    return (
      <ProgressView onBack={() => setShowProgressView(false)} />
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
      <div
        className="fixed top-0 left-0 right-0 z-30 h-0.5 w-full bg-muted/40"
        aria-hidden
      >
        <div
          className="h-full bg-accent/90 rounded-r-full transition-[width] duration-500 ease-out"
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
        {showGenerating && (
          <div className="flex min-h-[100dvh] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Generating your first reels…</p>
            </div>
          </div>
        )}

        {showEmpty && (
          <div className="flex min-h-[100dvh] w-full items-center justify-center">
            <p className="text-muted-foreground">No reels yet. Try again in a moment.</p>
          </div>
        )}

        {reels.map((reel, i) => {
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

        {!USE_MOCK && reels.length > 0 && (
          <div
            ref={loadMoreRef}
            className="flex min-h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className={isFetchingNextPage ? "h-8 w-8 animate-spin" : "h-8 w-8"} />
              <p>{isFetchingNextPage ? "Loading more…" : hasNextPage ? "Scroll for more…" : "You're all caught up"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
