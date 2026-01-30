import { useRef, useEffect } from "react"

export interface UseLoadMoreTriggerOptions {
  sentinelRef: React.RefObject<HTMLElement | null>
  scrollRootRef: React.RefObject<HTMLElement | null>
  isLoading: boolean
  lastReelId: string | null
  onRequestMore: (cursor: string) => void
}

export interface UseLoadMoreTriggerReturn {
  /** Clear the requested-cursor guard so the same cursor can be requested again (e.g. on Retry). */
  resetRequestedCursor: () => void
}

export function useLoadMoreTrigger(options: UseLoadMoreTriggerOptions): UseLoadMoreTriggerReturn {
  const {
    sentinelRef,
    scrollRootRef,
    isLoading,
    lastReelId,
    onRequestMore,
  } = options

  const lastRequestedCursorRef = useRef<string | null>(null)
  const lastReelIdRef = useRef<string | null>(null)
  lastReelIdRef.current = lastReelId

  // Re-run effect when we go from "no reels" to "has reels" so observer is set up
  // after the sentinel renders.
  const hasReels = lastReelId !== null

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollRootRef.current
    if (!sentinel || !root) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [e] = entries
        if (!e?.isIntersecting) return
        if (isLoading) return
        const currentLastReelId = lastReelIdRef.current
        if (!currentLastReelId) return
        if (lastRequestedCursorRef.current === currentLastReelId) return

        lastRequestedCursorRef.current = currentLastReelId
        onRequestMore(currentLastReelId)
      },
      { root, rootMargin: "0px 0px 30% 0px", threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinelRef, scrollRootRef, isLoading, onRequestMore, hasReels])

  return {
    resetRequestedCursor: () => {
      lastRequestedCursorRef.current = null
    },
  }
}
