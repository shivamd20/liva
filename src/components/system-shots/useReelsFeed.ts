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
  /** Focus Mode: if set, only load reels for this concept. */
  focusConceptId?: string | null
  /** Callback when focus changes (for URL sync). */
  onFocusChange?: (conceptId: string | null) => void
}

export interface UseReelsFeedReturn {
  segments: FeedSegment[]
  allReels: ApiReel[]
  reelsToShow: ApiReel[]
  loadSegment: (segmentId: string) => void
  markContinued: (reelId: string) => void
  /** Switch to Focus Mode for a specific concept. Clears all segments and reloads. */
  switchFocus: (conceptId: string) => void
  /** Exit Focus Mode and return to mixed feed. Clears all segments and reloads. */
  clearFocus: () => void
  /** Current focused concept ID, if any. */
  focusedConceptId: string | null
}

const STREAM_URL = "/api/system-shots/reels/stream"

let segmentIdCounter = 0
const createSegmentId = () => `seg-${++segmentIdCounter}`

/**
 * Robust reels feed hook with:
 * - Single stream guarantee (no duplicate calls)
 * - AbortController for request cancellation on topic change
 * - Proper deduplication with generation counter
 * - Edge case handling for empty states
 */
export function useReelsFeed(options: UseReelsFeedOptions = {}): UseReelsFeedReturn {
  const {
    initialContinuedIds = [],
    onError,
    enabled = true,
    focusConceptId: externalFocusConceptId = null,
    onFocusChange
  } = options

  // ============ CORE STATE ============

  // Internal focus state - initialized from external prop
  const [focusedConceptId, setFocusedConceptId] = useState<string | null>(externalFocusConceptId)

  // Segments: either a batch of reels or a load-more sentinel
  const [segments, setSegments] = useState<FeedSegment[]>(() => [
    { id: createSegmentId(), type: "sentinel", cursor: null, status: "idle" }
  ])

  const [continuedReelIds, setContinuedReelIds] = useState<Set<string>>(
    () => new Set(initialContinuedIds)
  )

  // ============ REFS FOR SYNCHRONOUS GUARDS ============

  // Generation counter - incremented on each feed reset (focus change)
  // Used to invalidate in-flight requests when topic changes
  const generationRef = useRef(0)

  // Current AbortController - allows cancelling in-flight stream
  const abortControllerRef = useRef<AbortController | null>(null)

  // Currently streaming segment ID
  const streamingSegmentIdRef = useRef<string | null>(null)

  // Set of segment IDs currently being loaded (synchronous guard)
  const loadingSegmentsRef = useRef<Set<string>>(new Set())

  // Has initial load been triggered? (prevents double-load on StrictMode)
  const initialLoadTriggeredRef = useRef(false)

  // Track previous external focus to detect changes
  const prevExternalFocusRef = useRef<string | null>(externalFocusConceptId)

  // Current focus ref for use in callbacks without stale closures
  const focusedConceptIdRef = useRef<string | null>(externalFocusConceptId)

  // Stable reference to onError to avoid dependency churn
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  // Stable reference to onFocusChange
  const onFocusChangeRef = useRef(onFocusChange)
  onFocusChangeRef.current = onFocusChange

  // Keep focus ref in sync with state
  useEffect(() => {
    focusedConceptIdRef.current = focusedConceptId
  }, [focusedConceptId])

  // ============ DERIVED STATE ============

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

  // ============ ABORT HELPER ============

  /**
   * Cancel any in-flight stream request.
   * Safe to call multiple times.
   */
  const cancelCurrentStream = useCallback(() => {
    if (abortControllerRef.current) {
      console.log(`[useReelsFeed] Aborting in-flight stream`)
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    streamingSegmentIdRef.current = null
    loadingSegmentsRef.current.clear()
  }, [])

  // ============ LOAD SEGMENT ============

  /**
   * Load a specific sentinel segment.
   * 
   * Guards:
   * - Synchronous deduplication via loadingSegmentsRef
   * - Generation check to ignore stale loads
   * - Status check to avoid reloading done/loading segments
   * 
   * Uses AbortController for cancellation.
   */
  const loadSegment = useCallback(
    async (segmentId: string) => {
      // Capture generation at call time - if it changes during load, we abort
      const loadGeneration = generationRef.current

      // SYNCHRONOUS guard - prevents race condition from React StrictMode / rapid calls
      if (loadingSegmentsRef.current.has(segmentId)) {
        console.log(`[useReelsFeed] Skipping load for ${segmentId} - already loading (sync guard)`)
        return
      }

      // Find the segment to load
      let foundSegment: FeedSegment | null = null
      setSegments((prev) => {
        const seg = prev.find((s) => s.id === segmentId)
        if (seg) foundSegment = seg
        return prev // Return unchanged, just reading
      })

      // Wait a tick for the functional pattern to execute
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Validate segment exists and is loadable
      if (!foundSegment) {
        console.log(`[useReelsFeed] Segment ${segmentId} not found`)
        return
      }

      const segment = foundSegment as FeedSegment

      if (segment.type !== "sentinel") {
        console.log(`[useReelsFeed] Segment ${segmentId} is not a sentinel`)
        return
      }

      if (segment.status === "loading" || segment.status === "done") {
        console.log(`[useReelsFeed] Segment ${segmentId} status is ${segment.status}, skipping`)
        return
      }

      // Check generation again - might have changed during await
      if (loadGeneration !== generationRef.current) {
        console.log(`[useReelsFeed] Generation changed, aborting load for ${segmentId}`)
        return
      }

      const segmentCursor = segment.cursor

      // Mark as loading SYNCHRONOUSLY (ref)
      loadingSegmentsRef.current.add(segmentId)
      console.log(`[useReelsFeed] Loading segment ${segmentId}, cursor=${segmentCursor}, focus=${focusedConceptIdRef.current}, gen=${loadGeneration}`)

      // Create AbortController for this request
      // Cancel any previous request first
      cancelCurrentStream()
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Create new reels segment to replace sentinel
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
            cursor: segmentCursor,
            status: "loading" as const
          },
          ...prev.slice(idx + 1)
        ]
      })

      // Build URL with optional focus query param
      const currentFocus = focusedConceptIdRef.current
      const baseUrl = segmentCursor
        ? `${STREAM_URL}?cursor=${encodeURIComponent(segmentCursor)}`
        : STREAM_URL
      const url = currentFocus
        ? baseUrl + (segmentCursor ? "&" : "?") + `focus=${encodeURIComponent(currentFocus)}`
        : baseUrl

      let hasError = false
      let reelCount = 0
      let wasAborted = false

      try {
        await consumeReelsStream(
          url,
          (reel) => {
            // Check if aborted or generation changed
            if (abortController.signal.aborted || loadGeneration !== generationRef.current) {
              wasAborted = true
              return
            }

            reelCount++
            // Update state immediately for each reel - render as you fetch
            setSegments((prev) => prev.map((seg) =>
              seg.id === newReelsSegmentId
                ? { ...seg, reels: [...(seg.reels ?? []), reel], cursor: reel.id }
                : seg
            ))
          },
          (err) => {
            if (abortController.signal.aborted) {
              wasAborted = true
              return
            }
            hasError = true
            onErrorRef.current?.(err)
          },
          abortController.signal // Pass signal to consumeReelsStream
        )
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError' || abortController.signal.aborted) {
          wasAborted = true
        } else {
          hasError = true
          onErrorRef.current?.(`Stream error: ${err}`)
        }
      }

      // Clear the loading refs
      loadingSegmentsRef.current.delete(segmentId)
      if (streamingSegmentIdRef.current === newReelsSegmentId) {
        streamingSegmentIdRef.current = null
      }
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }

      // If aborted or generation changed, don't update state - it's stale
      if (wasAborted || loadGeneration !== generationRef.current) {
        console.log(`[useReelsFeed] Stream for ${segmentId} was aborted/stale, ignoring results`)
        return
      }

      console.log(`[useReelsFeed] Stream complete for ${segmentId}, reelCount=${reelCount}, hasError=${hasError}`)

      if (hasError) {
        // On error: handle partially loaded state
        setSegments((prev) => {
          const idx = prev.findIndex((s) => s.id === newReelsSegmentId)
          if (idx === -1) return prev

          const streamingSeg = prev[idx]
          const loadedReels = streamingSeg.reels ?? []

          if (loadedReels.length === 0) {
            // No reels loaded - convert back to sentinel with error status
            return [
              ...prev.slice(0, idx),
              {
                id: createSegmentId(),
                type: "sentinel" as const,
                cursor: segmentCursor,
                status: "error" as const
              },
              ...prev.slice(idx + 1)
            ]
          }

          // Some reels loaded - keep them and add error sentinel for retry
          const lastLoadedCursor = loadedReels[loadedReels.length - 1].id
          return [
            ...prev.slice(0, idx),
            { ...streamingSeg, status: "idle" as const },
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

      // Stream complete successfully - finalize segment
      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.id === newReelsSegmentId)
        if (idx === -1) return prev

        const streamingSeg = prev[idx]
        const finalCursor = streamingSeg.reels?.length
          ? streamingSeg.reels[streamingSeg.reels.length - 1].id
          : null

        if (reelCount === 0) {
          // No more reels - mark as done (no new sentinel)
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
    [cancelCurrentStream] // Stable dependencies only
  )

  // ============ FOCUS CHANGE HANDLER ============

  /**
   * Reset feed for a new focus.
   * 
   * - Cancels any in-flight stream
   * - Increments generation counter to invalidate stale loads
   * - Resets all state to fresh
   * - Triggers a new load
   */
  const resetFeedForFocus = useCallback((conceptId: string | null, triggerLoad: boolean = true) => {
    console.log(`[useReelsFeed] Resetting feed for focus: ${conceptId}, triggerLoad: ${triggerLoad}`)

    // Cancel any in-flight stream
    cancelCurrentStream()

    // Increment generation to invalidate any pending loads
    generationRef.current++

    // Reset load tracking
    initialLoadTriggeredRef.current = false

    // Update state
    setFocusedConceptId(conceptId)
    focusedConceptIdRef.current = conceptId
    setContinuedReelIds(new Set())

    // Create fresh sentinel
    const newSegmentId = createSegmentId()
    setSegments([
      { id: newSegmentId, type: "sentinel", cursor: null, status: "idle" }
    ])

    // Notify external (URL sync)
    onFocusChangeRef.current?.(conceptId)

    if (triggerLoad) {
      // Mark initial load as triggered
      initialLoadTriggeredRef.current = true

      // Load after state commits
      // Use Promise.resolve().then for microtask timing (faster than RAF)
      Promise.resolve().then(() => {
        loadSegment(newSegmentId)
      })
    }
  }, [cancelCurrentStream, loadSegment])

  // ============ PUBLIC FOCUS METHODS ============

  const switchFocus = useCallback((conceptId: string) => {
    if (conceptId === focusedConceptIdRef.current) {
      console.log(`[useReelsFeed] switchFocus: already on ${conceptId}, skipping`)
      return
    }
    resetFeedForFocus(conceptId)
  }, [resetFeedForFocus])

  const clearFocus = useCallback(() => {
    if (focusedConceptIdRef.current === null) {
      console.log(`[useReelsFeed] clearFocus: already cleared, skipping`)
      return
    }
    resetFeedForFocus(null)
  }, [resetFeedForFocus])

  // ============ INITIAL LOAD & EXTERNAL FOCUS SYNC ============

  /**
   * Single unified effect for:
   * 1. Initial load on mount
   * 2. Reacting to external focus prop changes
   * 
   * Uses refs to ensure single execution.
   */
  useEffect(() => {
    if (!enabled) return

    // Check if external focus changed
    const externalChanged = externalFocusConceptId !== prevExternalFocusRef.current
    prevExternalFocusRef.current = externalFocusConceptId

    if (externalChanged) {
      // External focus changed - reset feed if different from internal state
      if (externalFocusConceptId !== focusedConceptIdRef.current) {
        console.log(`[useReelsFeed] External focus changed: ${focusedConceptIdRef.current} -> ${externalFocusConceptId}`)
        resetFeedForFocus(externalFocusConceptId)
      }
      return // Don't also do initial load
    }

    // Initial load - only if not already triggered
    if (initialLoadTriggeredRef.current) return

    // Find first idle sentinel
    const firstIdleSentinel = segments.find((s) => s.type === "sentinel" && s.status === "idle")
    if (firstIdleSentinel) {
      console.log(`[useReelsFeed] Initial load triggered for ${firstIdleSentinel.id}`)
      initialLoadTriggeredRef.current = true
      loadSegment(firstIdleSentinel.id)
    }
  }, [enabled, externalFocusConceptId, segments, loadSegment, resetFeedForFocus])

  // ============ CLEANUP ============

  useEffect(() => {
    return () => {
      // Cancel any in-flight stream on unmount
      cancelCurrentStream()
    }
  }, [cancelCurrentStream])

  // ============ MARK CONTINUED ============

  const markContinued = useCallback((reelId: string) => {
    setContinuedReelIds((prev) => new Set(prev).add(reelId))
  }, [])

  return {
    segments,
    allReels,
    reelsToShow,
    loadSegment,
    markContinued,
    switchFocus,
    clearFocus,
    focusedConceptId,
  }
}
