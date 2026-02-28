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
  /** When status === "error", optional message for UI (e.g. "timeout", "network", "server"). */
  errorMessage?: string
}

const LOAD_THROTTLE_MS = 400
const EMPTY_RETRY_MAX = 3
/** Max automatic retries for stream errors (0 reels) before showing error sentinel. */
const STREAM_AUTO_RETRY_MAX = 2
/** Delay in ms before each stream auto-retry. */
const STREAM_AUTO_RETRY_DELAY_MS = 1500
/** Max reel IDs to send in excludeIds query param (avoids payload bloat). */
const EXCLUDE_IDS_CAP = 20

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}

/** Segment transition helpers: given current segments and load outcome, return next segments. */

function finishSegmentAsSentinelError(
  prev: FeedSegment[],
  idx: number,
  cursor: string | null,
  errorMessage?: string
): FeedSegment[] {
  return [
    ...prev.slice(0, idx),
    {
      id: createSegmentId(),
      type: "sentinel" as const,
      cursor,
      status: "error" as const,
      errorMessage: errorMessage || undefined
    },
    ...prev.slice(idx + 1)
  ]
}

function finishSegmentAsPartialReelsThenError(
  prev: FeedSegment[],
  idx: number,
  streamingSeg: FeedSegment,
  errorMessage?: string
): FeedSegment[] {
  const loadedReels = streamingSeg.reels ?? []
  const lastLoadedCursor = loadedReels[loadedReels.length - 1].id
  return [
    ...prev.slice(0, idx),
    { ...streamingSeg, status: "idle" as const },
    {
      id: createSegmentId(),
      type: "sentinel" as const,
      cursor: lastLoadedCursor,
      status: "error" as const,
      errorMessage: errorMessage || undefined
    },
    ...prev.slice(idx + 1)
  ]
}

function finishSegmentAsSentinelIdle(prev: FeedSegment[], idx: number, cursor: string | null): FeedSegment[] {
  return [
    ...prev.slice(0, idx),
    {
      id: createSegmentId(),
      type: "sentinel" as const,
      cursor,
      status: "idle" as const
    },
    ...prev.slice(idx + 1)
  ]
}

function finishSegmentAsSentinelDone(prev: FeedSegment[], idx: number, streamingSeg: FeedSegment): FeedSegment[] {
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

function finishSegmentAsReelsWithMore(prev: FeedSegment[], idx: number, streamingSeg: FeedSegment): FeedSegment[] {
  const finalCursor = streamingSeg.reels?.length
    ? streamingSeg.reels[streamingSeg.reels.length - 1].id
    : null
  const newSentinel: FeedSegment = {
    id: createSegmentId(),
    type: "sentinel",
    cursor: finalCursor,
    status: "idle"
  }
  return [
    ...prev.slice(0, idx),
    { ...streamingSeg, status: "idle" as const },
    newSentinel,
    ...prev.slice(idx + 1)
  ]
}

export interface UseReelsFeedOptions {
  /** Reel IDs to exclude from feed (done/seen reels from the unified store). */
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

  // ============ REFS (grouped for clarity; required for sync guards and async callbacks) ============

  /** Load state: generation (invalidate on focus change), abort, streaming segment id, loading set, throttle and empty-retry. */
  const loadStateRef = useRef({
    generation: 0,
    abortController: null as AbortController | null,
    streamingSegmentId: null as string | null,
    loadingSegments: new Set<string>(),
    lastLoadComplete: 0,
    emptyRetryCount: 0,
  })

  /** Options/callbacks used inside async loadSegment without stale closures. */
  const optsRef = useRef({
    focusedConceptId: externalFocusConceptId as string | null,
    onError: onError as ((err: string) => void) | undefined,
    onFocusChange: onFocusChange as ((id: string | null) => void) | undefined,
    excludeIds: [] as string[],
  })
  optsRef.current.onError = onError
  optsRef.current.onFocusChange = onFocusChange
  optsRef.current.focusedConceptId = focusedConceptId

  /** Prevents double initial load (e.g. StrictMode). */
  const initialLoadTriggeredRef = useRef(false)

  /** Previous external focus prop; used to detect URL/focus changes. */
  const prevExternalFocusRef = useRef<string | null>(externalFocusConceptId)

  useEffect(() => {
    optsRef.current.focusedConceptId = focusedConceptId
  }, [focusedConceptId])

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
    optsRef.current.excludeIds = ids.slice(-EXCLUDE_IDS_CAP)
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
            devLog(`[useReelsFeed] Optimistically hiding duplicate reel: ${r.id} (content match)`)
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
      // console.log(`[useReelsFeed] Current Reels List (${allReels.length}):`, allReels.map(r => `${r.id} (${r.conceptId})`))
    }
  }, [allReels])

  // Filter out done/excluded reels
  const reelsToShow = useMemo(
    () => allReels.filter((r) => !excludedSet.has(r.id)),
    [allReels, excludedSet]
  )

  // ============ ABORT HELPER ============

  /**
   * Cancel any in-flight stream request.
   * Safe to call multiple times.
   */
  const cancelCurrentStream = useCallback(() => {
    const load = loadStateRef.current
    if (load.abortController) {
      devLog(`[useReelsFeed] Aborting in-flight stream`)
      load.abortController.abort()
      load.abortController = null
    }
    load.streamingSegmentId = null
    load.loadingSegments.clear()
  }, [])

  // ============ LOAD SEGMENT ============

  /**
   * Load a specific sentinel segment.
   * 
   * Guards:
   * - Synchronous deduplication via loadStateRef.loadingSegments
   * - Generation check to ignore stale loads
   * - Status check to avoid reloading done/loading segments
   * 
   * Uses AbortController for cancellation.
   */
  const loadSegment = useCallback(
    async (segmentId: string) => {
      // Capture generation at call time - if it changes during load, we abort
      const loadState = loadStateRef.current
      const loadGeneration = loadState.generation

      // SYNCHRONOUS guard - prevents race condition from React StrictMode / rapid calls
      if (loadState.loadingSegments.has(segmentId)) {
        devLog(`[useReelsFeed] Skipping load for ${segmentId} - already loading (sync guard)`)
        return
      }

      loadState.loadingSegments.add(segmentId)

      const elapsed = Date.now() - loadState.lastLoadComplete
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
        devLog(`[useReelsFeed] Segment ${segmentId} not found`)
        loadState.loadingSegments.delete(segmentId)
        return
      }

      const segment = foundSegment as FeedSegment

      if (segment.type !== "sentinel") {
        devLog(`[useReelsFeed] Segment ${segmentId} is not a sentinel`)
        loadState.loadingSegments.delete(segmentId)
        return
      }

      // Only skip loading/done. Error sentinels are intentionally reloadable so Retry = loadSegment(segmentId) works (single recovery path).
      if (segment.status === "loading" || segment.status === "done") {
        devLog(`[useReelsFeed] Segment ${segmentId} status is ${segment.status}, skipping`)
        loadState.loadingSegments.delete(segmentId)
        return
      }

      if (loadGeneration !== loadStateRef.current.generation) {
        devLog(`[useReelsFeed] Generation changed, aborting load for ${segmentId}`)
        loadState.loadingSegments.delete(segmentId)
        return
      }

      const segmentCursor = segment.cursor
      const opts = optsRef.current
      devLog(`[useReelsFeed] Loading segment ${segmentId}, cursor=${segmentCursor}, focus=${opts.focusedConceptId}, gen=${loadGeneration}`)

      mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_FEED_LOAD_START, {
        segmentId,
        isInitial: segmentCursor === null,
        focusConceptId: opts.focusedConceptId,
      })

      // Create new reels segment to replace sentinel
      const newReelsSegmentId = createSegmentId()
      loadStateRef.current.streamingSegmentId = newReelsSegmentId

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
      const currentFocus = optsRef.current.focusedConceptId
      const excludeIds = optsRef.current.excludeIds
      const params = new URLSearchParams()
      if (segmentCursor) params.set("cursor", segmentCursor)
      if (currentFocus) params.set("focus", currentFocus)
      if (excludeIds.length > 0) params.set("excludeIds", excludeIds.join(","))
      const url = `${STREAM_URL}${params.toString() ? `?${params.toString()}` : ""}`

      const maxAttempts = 1 + STREAM_AUTO_RETRY_MAX
      let attempt = 0
      let hasError = false
      let reelCount = 0
      let wasAborted = false
      let lastErrorMessage = ""
      let abortController: AbortController | null = null

      while (attempt < maxAttempts) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, STREAM_AUTO_RETRY_DELAY_MS))
          setSegments((prev) =>
            prev.map((seg) =>
              seg.id === newReelsSegmentId ? { ...seg, reels: [], status: "loading" as const } : seg
            )
          )
        }
        attempt++
        hasError = false
        reelCount = 0
        wasAborted = false

        cancelCurrentStream()
        abortController = new AbortController()
        loadStateRef.current.abortController = abortController

        try {
          await consumeReelsStream(
            url,
            (reel) => {
              if (abortController!.signal.aborted || loadGeneration !== loadStateRef.current.generation) {
                wasAborted = true
                return
              }
              reelCount++
              setSegments((prev) =>
                prev.map((seg) =>
                  seg.id === newReelsSegmentId
                    ? { ...seg, reels: [...(seg.reels ?? []), reel], cursor: reel.id }
                    : seg
                )
              )
            },
            (err) => {
              if (abortController!.signal.aborted) {
                wasAborted = true
                return
              }
              hasError = true
              lastErrorMessage = err
              optsRef.current.onError?.(err)
            },
            abortController!.signal
          )
        } catch (err: unknown) {
          if ((err as Error)?.name === "AbortError" || abortController!.signal.aborted) {
            wasAborted = true
          } else {
            hasError = true
            lastErrorMessage = `Stream error: ${err}`
            optsRef.current.onError?.(lastErrorMessage)
          }
        }

        loadStateRef.current.lastLoadComplete = Date.now()
        if (loadStateRef.current.streamingSegmentId === newReelsSegmentId) {
          loadStateRef.current.streamingSegmentId = null
        }
        if (loadStateRef.current.abortController === abortController) {
          loadStateRef.current.abortController = null
        }

        if (wasAborted || loadGeneration !== loadStateRef.current.generation) {
          devLog(`[useReelsFeed] Stream for ${segmentId} was aborted/stale, ignoring results`)
          return
        }

        if (hasError && reelCount === 0 && attempt < maxAttempts) {
          devLog(`[useReelsFeed] Stream error with 0 reels, auto-retry ${attempt}/${maxAttempts}`)
          continue
        }
        break
      }

      loadStateRef.current.loadingSegments.delete(segmentId)
      devLog(`[useReelsFeed] Stream complete for ${segmentId}, reelCount=${reelCount}, hasError=${hasError}, attempts=${attempt}`)

      if (!hasError && !wasAborted) {
        mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_FEED_LOAD_SUCCESS, {
          segmentId,
          reelCount,
          isInitial: segmentCursor === null,
          focusConceptId: optsRef.current.focusedConceptId,
        })
      } else if (hasError) {
        mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_FEED_LOAD_ERROR, {
          segmentId,
          isInitial: segmentCursor === null,
          focusConceptId: optsRef.current.focusedConceptId,
        })
      }

      if (hasError) {
        setSegments((prev) => {
          const idx = prev.findIndex((s) => s.id === newReelsSegmentId)
          if (idx === -1) return prev
          const streamingSeg = prev[idx]
          const loadedReels = streamingSeg.reels ?? []
          if (loadedReels.length === 0) {
            return finishSegmentAsSentinelError(prev, idx, segmentCursor, lastErrorMessage || undefined)
          }
          return finishSegmentAsPartialReelsThenError(prev, idx, streamingSeg, lastErrorMessage || undefined)
        })
        return
      }

      // Stream complete successfully - finalize segment
      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.id === newReelsSegmentId)
        if (idx === -1) return prev
        const streamingSeg = prev[idx]

        if (reelCount === 0) {
          const wasInitial = segmentCursor === null
          const retries = wasInitial ? loadStateRef.current.emptyRetryCount + 1 : 0
          if (wasInitial) loadStateRef.current.emptyRetryCount = retries

          if (wasInitial && retries < EMPTY_RETRY_MAX) {
            return finishSegmentAsSentinelIdle(prev, idx, null)
          }
          mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_FEED_END, {
            focusConceptId: optsRef.current.focusedConceptId,
            wasInitialEmpty: wasInitial && retries >= EMPTY_RETRY_MAX,
          })
          return finishSegmentAsSentinelDone(prev, idx, streamingSeg)
        }

        loadStateRef.current.emptyRetryCount = 0
        return finishSegmentAsReelsWithMore(prev, idx, streamingSeg)
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
    devLog(`[useReelsFeed] Resetting feed for focus: ${conceptId}, triggerLoad: ${triggerLoad}`)

    // Cancel any in-flight stream
    cancelCurrentStream()

    // Increment generation to invalidate any pending loads
    loadStateRef.current.generation++

    // Reset load tracking
    initialLoadTriggeredRef.current = false
    loadStateRef.current.emptyRetryCount = 0

    setFocusedConceptId(conceptId)
    optsRef.current.focusedConceptId = conceptId

    // Create fresh sentinel
    const newSegmentId = createSegmentId()
    setSegments([
      { id: newSegmentId, type: "sentinel", cursor: null, status: "idle" }
    ])

    // Notify external (URL sync)
    optsRef.current.onFocusChange?.(conceptId)

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
    if (conceptId === optsRef.current.focusedConceptId) {
      devLog(`[useReelsFeed] switchFocus: already on ${conceptId}, skipping`)
      return
    }
    resetFeedForFocus(conceptId)
  }, [resetFeedForFocus])

  const clearFocus = useCallback(() => {
    if (optsRef.current.focusedConceptId === null) {
      devLog(`[useReelsFeed] clearFocus: already cleared, skipping`)
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
      if (externalFocusConceptId !== optsRef.current.focusedConceptId) {
        devLog(`[useReelsFeed] External focus changed: ${optsRef.current.focusedConceptId} -> ${externalFocusConceptId}`)
        resetFeedForFocus(externalFocusConceptId)
      }
      return // Don't also do initial load
    }

    // Initial load - only if not already triggered
    if (initialLoadTriggeredRef.current) return

    // Find first idle sentinel
    const firstIdleSentinel = segments.find((s) => s.type === "sentinel" && s.status === "idle")
    if (firstIdleSentinel) {
      devLog(`[useReelsFeed] Initial load triggered for ${firstIdleSentinel.id}`)
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

  const refresh = useCallback(() => {
    resetFeedForFocus(optsRef.current.focusedConceptId, true)
  }, [resetFeedForFocus])

  return {
    segments,
    allReels,
    reelsToShow,
    loadSegment,
    switchFocus,
    clearFocus,
    focusedConceptId,
    refresh,
  }
}
