import { useRef, useCallback, useState, useEffect, useMemo } from "react"
import type { ApiReel } from "./types"
import { consumeReelsStream } from "./reelsStream"

export type FeedStatus = "idle" | "initial" | "loadingMore"

export interface UseReelsFeedOptions {
  /** Initial set of reel IDs to treat as "continued" (already consumed) on mount. */
  initialContinuedIds?: string[]
  /** Called when the stream errors (e.g. to show a toast). */
  onError?: (err: string) => void
}

export interface UseReelsFeedReturn {
  reels: ApiReel[]
  reelsToShow: ApiReel[]
  status: FeedStatus
  error: string | null
  loadMore: (cursor: string) => void
  retry: () => void
  markContinued: (reelId: string) => void
}

const STREAM_URL = "/api/system-shots/reels/stream"

export function useReelsFeed(options: UseReelsFeedOptions = {}): UseReelsFeedReturn {
  const { initialContinuedIds = [], onError: onErrorCallback } = options

  const [reels, setReels] = useState<ApiReel[]>([])
  const [continuedReelIds, setContinuedReelIds] = useState<Set<string>>(
    () => new Set(initialContinuedIds)
  )
  const [status, setStatus] = useState<FeedStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const streamInFlightRef = useRef(false)
  const streamAttemptedForEmptyRef = useRef(false)
  const initialContinuedIdsRef = useRef(initialContinuedIds)

  // Simple append function using setReels directly (stable from useState)
  const appendReel = useCallback((reel: ApiReel) => {
    setReels((prev) => {
      const exists = prev.some((r) => r.id === reel.id)
      if (exists) return prev
      return [...prev, reel]
    })
  }, [])

  const reelsToShow = useMemo(
    () => reels.filter((r) => !continuedReelIds.has(r.id)),
    [reels, continuedReelIds]
  )
  const hasUnconsumed = reelsToShow.length > 0
  const isEmpty = reels.length === 0 || !hasUnconsumed

  // One-time sync of initial continued IDs on mount
  useEffect(() => {
    setContinuedReelIds(new Set(initialContinuedIdsRef.current))
  }, [])

  // Initial stream: once per empty session
  useEffect(() => {
    if (!isEmpty || status === "initial" || status === "loadingMore") return
    if (streamAttemptedForEmptyRef.current) return
    if (streamInFlightRef.current) return

    streamAttemptedForEmptyRef.current = true
    streamInFlightRef.current = true
    setStatus("initial")
    setError(null)

    consumeReelsStream(
      STREAM_URL,
      (reel) => {
        appendReel(reel)
        streamAttemptedForEmptyRef.current = false
      },
      (err) => {
        setError(err)
        onErrorCallback?.(err)
      }
    ).finally(() => {
      streamInFlightRef.current = false
      setStatus((s) => (s === "initial" ? "idle" : s))
    })
  }, [isEmpty, status, appendReel])

  const loadMore = useCallback((cursor: string) => {
    if (streamInFlightRef.current) return
    streamInFlightRef.current = true
    setStatus("loadingMore")
    setError(null)
    const url = `${STREAM_URL}?cursor=${encodeURIComponent(cursor)}`
    consumeReelsStream(
      url,
      (reel) => appendReel(reel),
      (err) => {
        setError(err)
        onErrorCallback?.(err)
      }
    ).finally(() => {
      streamInFlightRef.current = false
      setStatus("idle")
    })
  }, [appendReel])

  const retry = useCallback(() => {
    setError(null)
    const lastReel = reelsToShow[reelsToShow.length - 1]
    if (lastReel) {
      loadMore(lastReel.id)
    } else {
      streamAttemptedForEmptyRef.current = false
    }
  }, [reelsToShow, loadMore])

  const markContinued = useCallback((reelId: string) => {
    setContinuedReelIds((prev) => new Set(prev).add(reelId))
  }, [])

  return {
    reels,
    reelsToShow,
    status,
    error,
    loadMore,
    retry,
    markContinued,
  }
}
