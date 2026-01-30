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
  const cooldownRef = useRef(false)
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
        // Cooldown prevents rapid re-triggers after loading completes
        if (cooldownRef.current) return
        
        const currentLastReelId = lastReelIdRef.current
        if (!currentLastReelId) return
        if (lastRequestedCursorRef.current === currentLastReelId) return

        lastRequestedCursorRef.current = currentLastReelId
        // Start cooldown - after requesting, wait for user to scroll before allowing another request
        cooldownRef.current = true
        onRequestMore(currentLastReelId)
      },
      { root, rootMargin: "0px 0px 30% 0px", threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinelRef, scrollRootRef, isLoading, onRequestMore, hasReels])

  // Clear cooldown when sentinel leaves viewport (user scrolled up to see new content)
  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollRootRef.current
    if (!sentinel || !root || !cooldownRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [e] = entries
        // When sentinel leaves viewport, clear cooldown
        if (e && !e.isIntersecting) {
          cooldownRef.current = false
        }
      },
      { root, threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinelRef, scrollRootRef, hasReels, isLoading])

  return {
    resetRequestedCursor: () => {
      lastRequestedCursorRef.current = null
      cooldownRef.current = false
    },
  }
}
