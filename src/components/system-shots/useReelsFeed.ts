import { useCallback, useState, useEffect, useMemo, useRef } from "react"
import type { ApiReel } from "./types"
import { consumeReelsStream } from "./reelsStream"
import { mixpanelService, MixpanelEvents } from "@/lib/mixpanel"

export type FeedStatus = "idle" | "loading" | "done" | "error"

export interface FeedSegment {
  id: string
  type: "reels" | "sentinel"
  reels?: ApiReel[]
  cursor: string | null
  status: FeedStatus
}

const LOAD_THROTTLE_MS = 400
const EMPTY_RETRY_MAX = 3

export interface UseReelsFeedOptions {
  initialContinuedIds?: string[]
  /** Reel IDs to exclude from feed (e.g. from seen cache). */
  excludedReelIds?: Set<string> | string[]
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
  /** Manually refresh the feed (reset and reload). */
  refresh: () => void
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
    excludedReelIds,
    onError,
    enabled = true,
    focusConceptId: externalFocusConceptId = null,
    onFocusChange
  } = options

  const excludedSet = useMemo(
    () => (excludedReelIds instanceof Set ? excludedReelIds : new Set(excludedReelIds ?? [])),
    [excludedReelIds]
  )

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

  // Throttle: last time a segment load completed
  const lastLoadCompleteRef = useRef(0)

  // Empty retry count for initial load (cursor=null) when stream returns 0 reels
  const emptyRetryCountRef = useRef(0)

  // Track previous external focus to detect changes
  const prevExternalFocusRef = useRef<string | null>(externalFocusConceptId)

  // Current focus ref for use in callbacks without stale closures
  const focusedConceptIdRef = useRef<string | null>(externalFocusConceptId)

  // Exclude IDs: recently viewed + recently received reels (for server to never resend)
  const excludeIdsRef = useRef<string[]>([])

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

  // Update excludeIds: all reel IDs from segments + seen cache, cap at 50
  useEffect(() => {
    const ids: string[] = []
    const seen = new Set<string>()
    for (const seg of segments) {
      if (seg.type === "reels" && seg.reels) {
        for (const r of seg.reels) {
          if (r.id && !seen.has(r.id)) {
            seen.add(r.id)
            ids.push(r.id)
          }
        }
      }
    }
    for (const id of excludedSet) {
      if (id && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
    // Limit to just the last 5 IDs to prevent payload bloat, trusting server logic for older history
    excludeIdsRef.current = ids.slice(-5)
  }, [segments, excludedSet])

  // ============ DERIVED STATE ============

  // Flatten all reels from segments, deduplicating by content (handles legacy DB duplicates)
  const allReels = useMemo(() => {
    const reels: ApiReel[] = []
    const contentKeys = new Set<string>()
    for (const seg of segments) {
      if (seg.type === "reels" && seg.reels) {
        for (const r of seg.reels) {
          // Robust dedupe: sort options to handle shuffled variances, trim prompt
          const sortedOptions = [...(r.options ?? [])].sort().join("|")
          const key = `${r.conceptId}|${r.prompt.trim()}|${sortedOptions}`

          if (contentKeys.has(key)) {
            console.log(`[useReelsFeed] Optimistically hiding duplicate reel: ${r.id} (content match)`)
            continue
          }
          contentKeys.add(key)
          reels.push(r)
        }
      }
    }
    return reels
  }, [segments])

  // Debug log for current reels
  useEffect(() => {
    if (allReels.length > 0) {
      console.log(`[useReelsFeed] Current Reels List (${allReels.length}):`, allReels.map(r => `${r.id} (${r.conceptId})`))
    }
  }, [allReels])

  // Filter out continued reels and excluded (seen) reels
  const reelsToShow = useMemo(
    () =>
      allReels.filter(
        (r) => !continuedReelIds.has(r.id) && !excludedSet.has(r.id)
      ),
    [allReels, continuedReelIds, excludedSet]
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

      // Add to loading set BEFORE any async work - prevents second concurrent call from proceeding
      loadingSegmentsRef.current.add(segmentId)

      // Throttle: wait if we recently completed a load (smooth gradual fetching)
      const elapsed = Date.now() - lastLoadCompleteRef.current
      if (elapsed < LOAD_THROTTLE_MS) {
        await new Promise((r) => setTimeout(r, LOAD_THROTTLE_MS - elapsed))
      }

      // Find the segment to load (after throttle - state may have changed)
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
        loadingSegmentsRef.current.delete(segmentId)
        return
      }

      const segment = foundSegment as FeedSegment

      if (segment.type !== "sentinel") {
        console.log(`[useReelsFeed] Segment ${segmentId} is not a sentinel`)
        loadingSegmentsRef.current.delete(segmentId)
        return
      }

      if (segment.status === "loading" || segment.status === "done") {
        console.log(`[useReelsFeed] Segment ${segmentId} status is ${segment.status}, skipping`)
        loadingSegmentsRef.current.delete(segmentId)
        return
      }

      // Check generation again - might have changed during await
      if (loadGeneration !== generationRef.current) {
        console.log(`[useReelsFeed] Generation changed, aborting load for ${segmentId}`)
        loadingSegmentsRef.current.delete(segmentId)
        return
      }

      const segmentCursor = segment.cursor
      console.log(`[useReelsFeed] Loading segment ${segmentId}, cursor=${segmentCursor}, focus=${focusedConceptIdRef.current}, gen=${loadGeneration}`)

      mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_FEED_LOAD_START, {
        segmentId,
        isInitial: segmentCursor === null,
        focusConceptId: focusedConceptIdRef.current,
      })

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

      // Build URL with cursor, focus, and excludeIds (server filters these out)
      const currentFocus = focusedConceptIdRef.current
      const excludeIds = excludeIdsRef.current
      const params = new URLSearchParams()
      if (segmentCursor) params.set("cursor", segmentCursor)
      if (currentFocus) params.set("focus", currentFocus)
      if (excludeIds.length > 0) params.set("excludeIds", excludeIds.join(","))
      const url = `${STREAM_URL}${params.toString() ? `?${params.toString()}` : ""}`

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

      // Clear the loading refs and record load complete time (for throttle)
      loadingSegmentsRef.current.delete(segmentId)
      lastLoadCompleteRef.current = Date.now()
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

      if (!hasError && !wasAborted) {
        mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_FEED_LOAD_SUCCESS, {
          segmentId,
          reelCount,
          isInitial: segmentCursor === null,
          focusConceptId: focusedConceptIdRef.current,
        })
      } else if (hasError) {
        mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_FEED_LOAD_ERROR, {
          segmentId,
          isInitial: segmentCursor === null,
          focusConceptId: focusedConceptIdRef.current,
        })
      }

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
          const wasInitial = segmentCursor === null
          const retries = wasInitial ? emptyRetryCountRef.current + 1 : 0
          if (wasInitial) emptyRetryCountRef.current = retries

          // Initial load with 0 reels: retry as idle sentinel up to EMPTY_RETRY_MAX times
          if (wasInitial && retries < EMPTY_RETRY_MAX) {
            return [
              ...prev.slice(0, idx),
              {
                id: createSegmentId(),
                type: "sentinel" as const,
                cursor: null,
                status: "idle" as const
              },
              ...prev.slice(idx + 1)
            ]
          }

          // Pagination or max retries exceeded - mark as done
          mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_FEED_END, {
            focusConceptId: focusedConceptIdRef.current,
            wasInitialEmpty: wasInitial && retries >= EMPTY_RETRY_MAX,
          })
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

        // Success with reels - reset empty retry count
        emptyRetryCountRef.current = 0

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
    emptyRetryCountRef.current = 0

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

  const refresh = useCallback(() => {
    resetFeedForFocus(focusedConceptIdRef.current, true)
  }, [resetFeedForFocus])

  return {
    segments,
    allReels,
    reelsToShow,
    loadSegment,
    markContinued,
    switchFocus,
    clearFocus,
    focusedConceptId,
    refresh,
  }
}
