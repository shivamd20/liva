import { useCallback, useState, useEffect, useMemo, useRef } from "react"
import type { ApiReel } from "./types"
import { consumeReelsStream } from "./reelsStream"

export type FeedStatus = "idle" | "loading" | "done" | "error"

export interface FeedSegment {
  id: string
  type: "reels" | "sentinel"
  reels?: ApiReel[]
  cursor: string | null
  status: FeedStatus
}

export interface UseReelsFeedOptions {
  initialContinuedIds?: string[]
  onError?: (err: string) => void
  /** If false, disables auto-loading. Useful for waiting for auth. Default: true */
  enabled?: boolean
}

export interface UseReelsFeedReturn {
  segments: FeedSegment[]
  allReels: ApiReel[]
  reelsToShow: ApiReel[]
  loadSegment: (segmentId: string) => void
  markContinued: (reelId: string) => void
}

const STREAM_URL = "/api/system-shots/reels/stream"

let segmentIdCounter = 0
const createSegmentId = () => `seg-${++segmentIdCounter}`

export function useReelsFeed(options: UseReelsFeedOptions = {}): UseReelsFeedReturn {
  const { initialContinuedIds = [], onError, enabled = true } = options

  // Segments: either a batch of reels or a load-more sentinel
  const [segments, setSegments] = useState<FeedSegment[]>(() => [
    { id: createSegmentId(), type: "sentinel", cursor: null, status: "idle" }
  ])

  const [continuedReelIds, setContinuedReelIds] = useState<Set<string>>(
    () => new Set(initialContinuedIds)
  )

  // Synchronous guard to prevent double-loading (React state is async)
  const loadingSegmentsRef = useRef<Set<string>>(new Set())

  // Track the currently streaming segment ID for incremental updates
  const streamingSegmentIdRef = useRef<string | null>(null)

  // Flatten all reels from segments
  const allReels = useMemo(() => {
    const reels: ApiReel[] = []
    for (const seg of segments) {
      if (seg.type === "reels" && seg.reels) {
        reels.push(...seg.reels)
      }
    }
    return reels
  }, [segments])

  // Filter out continued reels
  const reelsToShow = useMemo(
    () => allReels.filter((r) => !continuedReelIds.has(r.id)),
    [allReels, continuedReelIds]
  )

  // Load a specific sentinel segment - streams reels and renders them incrementally
  const loadSegment = useCallback(
    async (segmentId: string) => {
      // SYNCHRONOUS guard - prevents race condition from React StrictMode
      if (loadingSegmentsRef.current.has(segmentId)) {
        return
      }
      
      // Find the segment
      const segmentIndex = segments.findIndex((s) => s.id === segmentId)
      if (segmentIndex === -1) {
        return
      }

      const segment = segments[segmentIndex]
      if (segment.type !== "sentinel") {
        return
      }

      // Mark as loading SYNCHRONOUSLY first (ref), then async (state)
      loadingSegmentsRef.current.add(segmentId)

      // Create a new reels segment immediately to replace the sentinel
      // This allows us to render reels incrementally as they arrive
      const newReelsSegmentId = createSegmentId()
      streamingSegmentIdRef.current = newReelsSegmentId

      // Replace sentinel with empty reels segment (loading status)
      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.id === segmentId)
        if (idx === -1) return prev
        return [
          ...prev.slice(0, idx),
          { 
            id: newReelsSegmentId, 
            type: "reels" as const, 
            reels: [], 
            cursor: segment.cursor, 
            status: "loading" as const 
          },
          ...prev.slice(idx + 1)
        ]
      })

      const url = segment.cursor
        ? `${STREAM_URL}?cursor=${encodeURIComponent(segment.cursor)}`
        : STREAM_URL

      let hasError = false
      let reelCount = 0

      await consumeReelsStream(
        url,
        (reel) => {
          reelCount++
          // Update state immediately for each reel - render as you fetch
          setSegments((prev) => prev.map((seg) => 
            seg.id === streamingSegmentIdRef.current
              ? { ...seg, reels: [...(seg.reels ?? []), reel], cursor: reel.id }
              : seg
          ))
        },
        (err) => {
          hasError = true
          onError?.(err)
        }
      )

      // Clear the loading ref
      loadingSegmentsRef.current.delete(segmentId);
      streamingSegmentIdRef.current = null

      if (hasError) {
        // On error: convert reels segment back to sentinel (with error status) OR 
        // if some reels were loaded, keep reels and add error sentinel for retry
        setSegments((prev) => {
          const idx = prev.findIndex((s) => s.id === newReelsSegmentId)
          if (idx === -1) return prev
          
          const streamingSeg = prev[idx]
          const loadedReels = streamingSeg.reels ?? []
          
          if (loadedReels.length === 0) {
            // No reels loaded - convert back to sentinel with error status for retry
            return [
              ...prev.slice(0, idx),
              { 
                id: createSegmentId(), 
                type: "sentinel" as const, 
                cursor: segment.cursor, 
                status: "error" as const 
              },
              ...prev.slice(idx + 1)
            ]
          }
          
          // Some reels loaded - keep them and add error sentinel for retry
          const lastLoadedCursor = loadedReels[loadedReels.length - 1].id
          return [
            ...prev.slice(0, idx),
            { ...streamingSeg, status: "idle" as const }, // Finalize loaded reels
            { 
              id: createSegmentId(), 
              type: "sentinel" as const, 
              cursor: lastLoadedCursor, 
              status: "error" as const 
            },
            ...prev.slice(idx + 1)
          ]
        })
        return
      }

      // Stream complete - finalize the segment and add sentinel for "Load More"
      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.id === newReelsSegmentId)
        if (idx === -1) {
          return prev
        }

        const streamingSeg = prev[idx]
        const finalCursor = streamingSeg.reels?.length 
          ? streamingSeg.reels[streamingSeg.reels.length - 1].id 
          : null

        if (reelCount === 0) {
          // No more reels - mark segment as done (no new sentinel needed)
          return [
            ...prev.slice(0, idx),
            { 
              id: createSegmentId(), 
              type: "sentinel" as const, 
              cursor: streamingSeg.cursor, 
              status: "done" as const 
            },
            ...prev.slice(idx + 1)
          ]
        }

        // Add new sentinel for "Load More"
        const newSentinel: FeedSegment = {
          id: createSegmentId(),
          type: "sentinel",
          cursor: finalCursor,
          status: "idle",
        }

        return [
          ...prev.slice(0, idx),
          { ...streamingSeg, status: "idle" as const },
          newSentinel,
          ...prev.slice(idx + 1)
        ]
      })
    },
    [segments, onError]
  )

  // Auto-load initial segment on mount
  // authFetch in reelsStream.ts handles waiting for auth and 401 retries
  useEffect(() => {
    if (!enabled) return; // Optional: skip if explicitly disabled
    const firstSentinel = segments.find((s) => s.type === "sentinel" && s.status === "idle")
    if (firstSentinel && segments.length === 1) {
      loadSegment(firstSentinel.id)
    }
  }, []) // Only on mount - authFetch handles auth waiting

  // Mark a reel as continued
  const markContinued = useCallback((reelId: string) => {
    setContinuedReelIds((prev) => new Set(prev).add(reelId))
  }, [])

  return {
    segments,
    allReels,
    reelsToShow,
    loadSegment,
    markContinued,
  }
}
