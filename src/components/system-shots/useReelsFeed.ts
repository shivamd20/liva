import { useCallback, useState, useEffect, useMemo, useRef } from "react"
import type { ApiReel } from "./types"
import { consumeReelsStream } from "./reelsStream"

// #region agent log
const DEBUG_LOG = (loc: string, msg: string, data: Record<string, unknown>, hyp: string) => {
  fetch('http://127.0.0.1:7242/ingest/eb26fd3f-def7-4467-b4e3-673c03fa8800',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:loc,message:msg,data,timestamp:Date.now(),sessionId:'debug-session',hypothesisId:hyp})}).catch(()=>{});
};
// #endregion

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
  const { initialContinuedIds = [], onError } = options

  // Segments: either a batch of reels or a load-more sentinel
  const [segments, setSegments] = useState<FeedSegment[]>(() => [
    { id: createSegmentId(), type: "sentinel", cursor: null, status: "idle" }
  ])

  const [continuedReelIds, setContinuedReelIds] = useState<Set<string>>(
    () => new Set(initialContinuedIds)
  )

  // #region agent log
  // Synchronous guard to prevent double-loading (React state is async)
  const loadingSegmentsRef = useRef<Set<string>>(new Set());
  // #endregion

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

  // Load a specific sentinel segment
  const loadSegment = useCallback(
    async (segmentId: string) => {
      // #region agent log
      DEBUG_LOG('useReelsFeed.ts:loadSegment', 'loadSegment called', { segmentId, segmentsSnapshot: segments.map(s => ({ id: s.id, type: s.type, status: s.status })), alreadyLoading: loadingSegmentsRef.current.has(segmentId) }, 'H2');
      // #endregion
      
      // SYNCHRONOUS guard - prevents race condition from React StrictMode
      if (loadingSegmentsRef.current.has(segmentId)) {
        // #region agent log
        DEBUG_LOG('useReelsFeed.ts:loadSegment', 'REF GUARD: Already loading this segment', { segmentId }, 'H2');
        // #endregion
        return
      }
      
      // Find the segment
      const segmentIndex = segments.findIndex((s) => s.id === segmentId)
      if (segmentIndex === -1) {
        // #region agent log
        DEBUG_LOG('useReelsFeed.ts:loadSegment', 'Segment not found, returning', { segmentId }, 'H2');
        // #endregion
        return
      }

      const segment = segments[segmentIndex]
      if (segment.type !== "sentinel") {
        // #region agent log
        DEBUG_LOG('useReelsFeed.ts:loadSegment', 'Segment guard: not sentinel', { segmentId, type: segment.type, status: segment.status }, 'H2');
        // #endregion
        return
      }

      // Mark as loading SYNCHRONOUSLY first (ref), then async (state)
      loadingSegmentsRef.current.add(segmentId);
      
      // #region agent log
      DEBUG_LOG('useReelsFeed.ts:loadSegment', 'Starting load for segment (ref guard set)', { segmentId, cursor: segment.cursor }, 'H2');
      // #endregion

      // Mark as loading in state
      setSegments((prev) =>
        prev.map((s) => (s.id === segmentId ? { ...s, status: "loading" as const } : s))
      )

      const url = segment.cursor
        ? `${STREAM_URL}?cursor=${encodeURIComponent(segment.cursor)}`
        : STREAM_URL

      const batch: ApiReel[] = []
      let hasError = false

      await consumeReelsStream(
        url,
        (reel) => batch.push(reel),
        (err) => {
          hasError = true
          onError?.(err)
        }
      )

      if (hasError) {
        loadingSegmentsRef.current.delete(segmentId);
        setSegments((prev) =>
          prev.map((s) => (s.id === segmentId ? { ...s, status: "error" as const } : s))
        )
        return
      }

      // Clear the loading ref
      loadingSegmentsRef.current.delete(segmentId);
      
      // Replace sentinel with: reels segment + new sentinel
      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.id === segmentId)
        if (idx === -1) {
          // #region agent log
          DEBUG_LOG('useReelsFeed.ts:loadSegment', 'Segment not found during replacement', { segmentId }, 'H4');
          // #endregion
          return prev
        }

        const newCursor = batch.length > 0 ? batch[batch.length - 1].id : null

        if (batch.length === 0) {
          // No more reels - mark sentinel as done
          // #region agent log
          DEBUG_LOG('useReelsFeed.ts:loadSegment', 'No reels returned, marking as done', { segmentId }, 'H4');
          // #endregion
          return prev.map((s) =>
            s.id === segmentId ? { ...s, status: "done" as const } : s
          )
        }

        // Replace sentinel with reels + new sentinel
        const reelsSegment: FeedSegment = {
          id: createSegmentId(),
          type: "reels",
          reels: batch,
          cursor: newCursor,
          status: "idle",
        }

        const newSentinel: FeedSegment = {
          id: createSegmentId(),
          type: "sentinel",
          cursor: newCursor,
          status: "idle",
        }

        // #region agent log
        DEBUG_LOG('useReelsFeed.ts:loadSegment', 'Replacing sentinel with reels + new sentinel', { oldSegmentId: segmentId, reelsCount: batch.length, newSentinelId: newSentinel.id, newCursor }, 'H4');
        // #endregion

        return [...prev.slice(0, idx), reelsSegment, newSentinel, ...prev.slice(idx + 1)]
      })
    },
    [segments, onError]
  )

  // #region agent log
  const mountCountRef = useRef(0);
  // #endregion

  // Auto-load initial segment
  useEffect(() => {
    // #region agent log
    mountCountRef.current++;
    DEBUG_LOG('useReelsFeed.ts:autoLoad', 'Auto-load effect triggered', { mountCount: mountCountRef.current, segmentsLength: segments.length, segments: segments.map(s => ({ id: s.id, type: s.type, status: s.status })) }, 'H1');
    // #endregion
    const firstSentinel = segments.find((s) => s.type === "sentinel" && s.status === "idle")
    // #region agent log
    DEBUG_LOG('useReelsFeed.ts:autoLoad', 'First sentinel check', { foundSentinel: !!firstSentinel, sentinelId: firstSentinel?.id, willLoad: !!(firstSentinel && segments.length === 1) }, 'H3');
    // #endregion
    if (firstSentinel && segments.length === 1) {
      loadSegment(firstSentinel.id)
    }
  }, []) // Only on mount

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
