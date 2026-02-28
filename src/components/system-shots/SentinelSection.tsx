import { useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCcw } from "lucide-react"
import type { FeedSegment } from "./useReelsFeed"
import { ReelSkeleton } from "./ReelSkeleton"

const SKELETON_COUNT = 3

/** User-facing message from stream/fetch error. */
function errorDisplayMessage(errorMessage?: string): string {
  if (!errorMessage) return "Failed to load reels."
  const lower = errorMessage.toLowerCase()
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return "Connection timed out. Check your network and retry."
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Connection failed. Check your network and retry."
  }
  if (lower.includes("401") || lower.includes("unauthorized")) {
    return "Session expired. Retry or refresh the page."
  }
  return "Server error. Retry in a moment."
}

export interface SentinelSectionProps {
  segment: FeedSegment
  segmentId: string
  loadSegment: (segmentId: string) => void
  onRefresh?: () => void
  isInitial: boolean
  sentinelRef?: React.MutableRefObject<HTMLDivElement | null>
}

/** Sentinel section - auto-loads on scroll via IntersectionObserver. */
export function SentinelSection({
  segment,
  segmentId,
  loadSegment,
  onRefresh,
  isInitial,
  sentinelRef: externalSentinelRef,
}: SentinelSectionProps) {
  const internalSentinelRef = useRef<HTMLDivElement | null>(null)
  const { status, errorMessage } = segment

  const onLoad = useCallback(() => {
    loadSegment(segmentId)
  }, [loadSegment, segmentId])

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      internalSentinelRef.current = el
      if (externalSentinelRef) {
        externalSentinelRef.current = el
      }
    },
    [externalSentinelRef]
  )

  useEffect(() => {
    if (status !== "idle") return
    const el = internalSentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoad()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [status, onLoad])

  if (isInitial && status === "loading") {
    return (
      <>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="flex min-h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center p-6"
          >
            <ReelSkeleton />
          </div>
        ))}
      </>
    )
  }

  if (status === "done") {
    return (
      <div className="flex min-h-[50dvh] w-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">You've reached the end!</p>
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline" className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        )}
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-destructive text-center">{errorDisplayMessage(errorMessage)}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={onLoad} variant="outline" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Retry
            </Button>
            {onRefresh && (
              <Button onClick={onRefresh} variant="ghost" size="sm" className="text-muted-foreground">
                Refresh feed
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center p-6">
        <ReelSkeleton />
      </div>
    )
  }

  return (
    <div
      ref={setRefs}
      className="flex min-h-[50dvh] w-full shrink-0 items-center justify-center"
    >
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
