import { useRef, useCallback, useState, useEffect, useMemo } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { useSession } from "@/lib/auth-client"
import { trpcClient } from "@/trpcClient"
import { ReelCard } from "./ReelCard"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCcw } from "lucide-react"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { toast } from "sonner"
import { REEL_THEMES, type ReelTheme, type ApiReel, type ConceptInfo } from "./types"
import { ProgressView } from "./ProgressView"
import { ReelSkeleton } from "./ReelSkeleton"
import { useReelsFeed } from "./useReelsFeed"
import { SentinelSection } from "./SentinelSection"
import { FocusSidebar, SidebarTrigger } from "./FocusSidebar"
import { addDone, getDoneSet, addAnswered, removeAnswered, removeDone, getAnswers } from "./seenReelsCache"
import { mixpanelService, MixpanelEvents } from "@/lib/mixpanel"

export type { ReelTheme } from "./types"

export interface SystemShotsPageProps {
  onBack: () => void
}

export function SystemShotsPage({ onBack }: SystemShotsPageProps) {
  const { data: session } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showProgressView, setShowProgressView] = useState(false)
  const [currentReelIndex, setCurrentReelIndex] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)

  // Unified done-reels store (localStorage-backed)
  const [doneReelIds, setDoneReelIds] = useState<Set<string>>(() => getDoneSet())
  const [answeredByReelId, setAnsweredByReelId] = useState<Record<string, number>>(() => getAnswers())

  const refreshDoneState = useCallback(() => {
    setDoneReelIds(getDoneSet())
    setAnsweredByReelId(getAnswers())
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const markReelDone = useCallback((reelId: string) => {
    addDone(reelId)
    setDoneReelIds((prev) => new Set(prev).add(reelId))
  }, [])

  // Focus Mode: sync with URL
  const focusFromUrl = searchParams.get("focus") ?? null

  const handleFocusChange = useCallback((conceptId: string | null) => {
    if (conceptId) {
      setSearchParams({ focus: conceptId })
    } else {
      setSearchParams({})
    }
  }, [setSearchParams])

  const feed = useReelsFeed({
    excludedReelIds: doneReelIds,
    onError: (err) => toast.error(err === "Unauthorized" ? "Please sign in." : err),
    focusConceptId: focusFromUrl,
    onFocusChange: handleFocusChange,
  })
  const { segments, reelsToShow, loadSegment, focusedConceptId, switchFocus, clearFocus, refresh } = feed

  const { data: availableTopics = [] } = useQuery({
    queryKey: ["system-shots", "available-topics"],
    queryFn: async () => {
      const result = await trpcClient.systemShots.getAvailableTopics.query()
      return result as ConceptInfo[]
    },
    staleTime: 1000 * 60 * 60,
  })

  const reelRefs = useRef<(HTMLElement | null)[]>([])
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingIndicatorRef = useRef<HTMLDivElement | null>(null)
  const skipObservedRef = useRef<Set<string>>(new Set())

  const reelViewEnterTimeRef = useRef<number | null>(null)
  const lastViewedReelIdRef = useRef<string | null>(null)
  const lastViewedReelIndexRef = useRef<number>(-1)
  const sessionStartTimeRef = useRef<number>(Date.now())
  const sessionReelsViewedRef = useRef<Set<string>>(new Set())
  const shownReelIdsRef = useRef<Set<string>>(new Set())

  const submitAnswerMutation = useMutation({
    mutationFn: (input: { reelId: string; selectedIndex: number | null; correct: boolean; skipped?: boolean }) =>
      trpcClient.systemShots.submitAnswer.mutate(input),
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    onError: (_error, variables) => {
      const { reelId, skipped } = variables
      removeDone(reelId)
      removeAnswered(reelId)
      refreshDoneState()
      if (skipped) skipObservedRef.current.delete(reelId)
      toast.error("Failed to save. You can try again.")
    },
  })

  const handleSelectOption = useCallback(
    (reel: ApiReel, index: number) => {
      if (answeredByReelId[reel.id] !== undefined) return
      const correct = reel.correctIndex !== null && index === reel.correctIndex
      mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_REEL_ANSWER, {
        reelId: reel.id,
        conceptId: reel.conceptId,
        selectedIndex: index,
        correct,
        reelType: "mcq",
      })
      addAnswered(reel.id, index)
      setAnsweredByReelId((prev) => ({ ...prev, [reel.id]: index }))
      submitAnswerMutation.mutate({ reelId: reel.id, selectedIndex: index, correct, skipped: false })
    },
    [answeredByReelId, submitAnswerMutation]
  )

  const scrollToReel = useCallback((index: number) => {
    setTimeout(() => {
      reelRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }, [])

  const handleContinue = useCallback(
    (reel: ApiReel, selectedIndex: number | undefined, index: number, totalRenderedReels: number) => {
      mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_REEL_CONTINUE, {
        reelId: reel.id,
        conceptId: reel.conceptId,
        reelType: reel.type,
        reelIndex: index,
        totalReels: totalRenderedReels,
        hadAnswer: reel.type === "mcq" && selectedIndex !== undefined,
        correct: reel.type === "mcq" && reel.correctIndex !== null && selectedIndex === reel.correctIndex,
      })
      markReelDone(reel.id)
      if (reel.type === "flash" && !doneReelIds.has(reel.id)) {
        submitAnswerMutation.mutate({ reelId: reel.id, selectedIndex: null, correct: false, skipped: true })
      }
      const nextIndex = index + 1
      if (nextIndex < totalRenderedReels) {
        scrollToReel(nextIndex)
      } else if (sentinelRef.current || loadingIndicatorRef.current) {
        setTimeout(() => {
          (sentinelRef.current || loadingIndicatorRef.current)?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 50)
      }
    },
    [markReelDone, doneReelIds, submitAnswerMutation, scrollToReel]
  )

  const submitSkip = useCallback(
    (reelId: string) => {
      if (skipObservedRef.current.has(reelId) || doneReelIds.has(reelId)) return
      skipObservedRef.current.add(reelId)
      const reel = reelsToShow.find((r) => r.id === reelId)
      mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_REEL_SKIP, {
        reelId,
        conceptId: reel?.conceptId,
        reelType: reel?.type,
        reason: "scrolled_away",
      })
      markReelDone(reelId)
      submitAnswerMutation.mutate({ reelId, selectedIndex: null, correct: false, skipped: true })
    },
    [markReelDone, reelsToShow, doneReelIds, submitAnswerMutation]
  )

  // Track view open on mount, view close on unmount
  useEffect(() => {
    mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_VIEW_OPEN, {
      focusConceptId: focusFromUrl,
    })
    return () => {
      const sessionDurationMs = Date.now() - sessionStartTimeRef.current
      mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_VIEW_CLOSE, {
        sessionDurationMs,
        sessionDurationSec: Math.round(sessionDurationMs / 1000),
        uniqueReelsViewed: sessionReelsViewedRef.current.size,
        focusConceptId: focusFromUrl,
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- intentional: only on mount/unmount

  // Compute total rendered reels count and IDs in DOM order (for engagement tracking)
  const { totalRenderedReels, renderedReelIds, renderedReelMap } = useMemo(() => {
    const ids: string[] = []
    const map = new Map<string, ApiReel>()
    for (const segment of segments) {
      if (segment.type === "reels" && segment.reels) {
        for (const reel of segment.reels) {
          if (!doneReelIds.has(reel.id)) {
            ids.push(reel.id)
            map.set(reel.id, reel)
          }
        }
      }
    }
    return {
      totalRenderedReels: ids.length,
      renderedReelIds: ids,
      renderedReelMap: map,
    }
  }, [segments, doneReelIds])

  // Track current reel for progress bar + engagement (time spent, scroll)
  useEffect(() => {
    const nodes = reelRefs.current
    const reelIds = renderedReelIds
    const reelMap = renderedReelMap
    if (nodes.length === 0 || reelIds.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = nodes.indexOf(entry.target as HTMLElement)
          if (index !== -1) {
            const reelId = reelIds[index]
            const prevIndex = lastViewedReelIndexRef.current
            const reel = reelMap.get(reelId)

            // Record time spent on previous reel when scrolling to new one
            if (reelViewEnterTimeRef.current !== null && lastViewedReelIdRef.current && lastViewedReelIdRef.current !== reelId) {
              const timeSpentMs = Date.now() - reelViewEnterTimeRef.current
              mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_REEL_TIME_SPENT, {
                reelId: lastViewedReelIdRef.current,
                timeSpentMs,
                timeSpentSec: Math.round(timeSpentMs / 1000),
                fromIndex: prevIndex,
                toIndex: index,
                scrollDirection: index > prevIndex ? "down" : "up",
              })
              mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_REEL_SCROLL, {
                fromReelId: lastViewedReelIdRef.current,
                toReelId: reelId,
                fromIndex: prevIndex,
                toIndex: index,
                direction: index > prevIndex ? "down" : "up",
              })
            }

            lastViewedReelIdRef.current = reelId
            lastViewedReelIndexRef.current = index
            reelViewEnterTimeRef.current = Date.now()
            sessionReelsViewedRef.current.add(reelId)

            if (!shownReelIdsRef.current.has(reelId)) {
              shownReelIdsRef.current.add(reelId)
              trpcClient.systemShots.trackReelShown.mutate({ reelId }).catch(() => {})
            }

            mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_REEL_VIEW, {
              reelId,
              reelIndex: index,
              totalReels: reelIds.length,
              conceptId: reel?.conceptId,
              reelType: reel?.type,
            })
            setCurrentReelIndex(index)
          }
        }
      },
      { threshold: 0.5 }
    )
    nodes.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [renderedReelIds, renderedReelMap])

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
            const alreadyDone = doneReelIds.has(reelId)
            const answered = answeredByReelId[reelId] !== undefined
            if (!alreadyDone && !answered) submitSkip(reelId)
          }
        }
      },
      { threshold: 0 }
    )
    reelElements.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [reelsToShow, answeredByReelId, doneReelIds, submitSkip])

  // Check if initial loading (either old sentinel loading or new reels segment with no reels yet)
  const isInitialLoading =
    (segments.length === 1 && segments[0].type === "sentinel" && segments[0].status === "loading") ||
    (segments.length === 1 && segments[0].type === "reels" && segments[0].status === "loading" && (!segments[0].reels || segments[0].reels.length === 0))

  // Check if we're streaming more reels (reels segment exists with loading status and has some reels)
  const isStreaming = segments.some((s) => s.type === "reels" && s.status === "loading" && s.reels && s.reels.length > 0)

  const hasNoReels = reelsToShow.length === 0 && !isInitialLoading && !isStreaming

  const progressPercent = totalRenderedReels > 0 ? ((currentReelIndex + 1) / totalRenderedReels) * 100 : 0

  const handleSidebarOpen = useCallback(() => {
    setSidebarOpen(true)
    mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_SIDEBAR_OPEN)
  }, [])

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false)
    mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_SIDEBAR_CLOSE)
  }, [])

  const handleBack = useCallback(() => {
    mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_BACK, {
      sessionDurationMs: Date.now() - sessionStartTimeRef.current,
      uniqueReelsViewed: sessionReelsViewedRef.current.size,
    })
    onBack()
  }, [onBack])

  const handleProgressOpen = useCallback(() => {
    mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_PROGRESS_OPEN)
    setShowProgressView(true)
  }, [])

  const handleProgressClose = useCallback(() => {
    mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_PROGRESS_CLOSE)
    setShowProgressView(false)
  }, [])

  if (showProgressView) {
    return <ProgressView onBack={handleProgressClose} />
  }

  // Build flat list with reel index tracking
  let reelIndex = 0

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-background">
      {/* Focus Sidebar - calm, minimal, supportive */}
      <FocusSidebar
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
        topics={availableTopics}
        activeTopicId={focusedConceptId}
        onTopicSelect={switchFocus}
        onClearFocus={clearFocus}
        onBack={handleBack}
        onProgress={handleProgressOpen}
        session={session}
        onRefresh={refresh}
      />

      {/* Hamburger (top-left) and dark mode toggle (top-right) */}
      <SidebarTrigger isOpen={sidebarOpen} onToggle={() => (sidebarOpen ? handleSidebarClose() : handleSidebarOpen())} />
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      {/* Main reel container - full width on mobile, with sidebar offset on desktop */}
      <div className="flex-1 flex flex-col min-h-0 md:ml-56">
        {/* Progress bar - thin, unobtrusive */}
        <div className="fixed top-0 left-0 right-0 z-30 h-0.5 w-full bg-muted/20" aria-hidden>
          <div
            className="h-full bg-muted-foreground/30 rounded-r-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Offline banner */}
        {isOffline && (
          <div className="fixed top-2 left-1/2 z-40 -translate-x-1/2 rounded-md bg-destructive/90 px-3 py-1.5 text-center text-sm text-destructive-foreground shadow">
            You're offline. Reels may not load until you're back online.
          </div>
        )}

        {/* Reel scroll container - doom scroll enabled */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory overscroll-contain touch-pan-y">
          {/* Render segments in order */}
          {segments.map((segment) => {
            if (segment.type === "reels") {
              // Render reels from this segment
              const reelElements = (segment.reels ?? [])
                .filter((reel) => !doneReelIds.has(reel.id))
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
                        onContinue={() => handleContinue(reel, answeredByReelId[reel.id], i, totalRenderedReels)}
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
                    ref={(el) => { loadingIndicatorRef.current = el }}
                    className="flex min-h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center p-6"
                  >
                    <ReelSkeleton />
                  </div>
                )
              }

              // If segment is still streaming and has some reels, show streaming indicator after reels
              if (segment.status === "loading" && reelElements.length > 0) {
                return [
                  ...reelElements,
                  <div
                    key={`streaming-indicator-${segment.id}`}
                    ref={(el) => { loadingIndicatorRef.current = el }}
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
                  segmentId={segment.id}
                  loadSegment={loadSegment}
                  onRefresh={refresh}
                  isInitial={segments.length === 1}
                  sentinelRef={segment.status === "idle" || segment.status === "loading" ? sentinelRef : undefined}
                />
              )
            }

            return null
          })}

          {/* Empty state */}
          {hasNoReels && (
            <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4">
              <p className="text-muted-foreground">No reels available. Try again later.</p>
              <Button onClick={refresh} variant="outline" className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SystemShotsPage

