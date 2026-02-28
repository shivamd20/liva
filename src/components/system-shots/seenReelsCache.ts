/**
 * Unified done-reels store (localStorage, 72h TTL).
 *
 * Single source of truth for "user is done with this reel" on the client.
 * Replaces the old separate continuedReelIds, submittedAnswerReelIds,
 * submittedReelIds, and seenReelsCache signals.
 *
 * - doneReelIds: reels the user has finished (continued, skipped, scrolled past).
 * - answers: MCQ selected-index map so feedback survives refresh.
 */

const STORAGE_KEY = "liva-done-reels"
const TTL_MS = 72 * 60 * 60 * 1000 // 72 hours
const MAX_IDS = 500

interface CachedData {
  reelIds: string[]
  /** MCQ selected-index by reel ID (sparse, only for answered MCQs). */
  answers: Record<string, number>
  expiresAt: number
}

function empty(): CachedData {
  return { reelIds: [], answers: {}, expiresAt: Date.now() + TTL_MS }
}

function load(): CachedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      // Migrate from old key if present
      const legacy = localStorage.getItem("liva-seen-reels")
      if (legacy) {
        const parsed = JSON.parse(legacy) as { reelIds?: string[]; expiresAt?: number }
        localStorage.removeItem("liva-seen-reels")
        const migrated: CachedData = {
          reelIds: Array.isArray(parsed.reelIds) ? parsed.reelIds : [],
          answers: {},
          expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : Date.now() + TTL_MS,
        }
        save(migrated)
        return migrated
      }
      return empty()
    }
    const parsed = JSON.parse(raw) as Partial<CachedData>
    return {
      reelIds: Array.isArray(parsed.reelIds) ? parsed.reelIds : [],
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : Date.now() + TTL_MS,
    }
  } catch {
    return empty()
  }
}

function save(data: CachedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable
  }
}

function prune(data: CachedData): CachedData {
  const now = Date.now()
  if (data.expiresAt <= now) return empty()
  if (data.reelIds.length <= MAX_IDS) return data
  const trimmed = data.reelIds.slice(-MAX_IDS)
  const trimmedSet = new Set(trimmed)
  const answers: Record<string, number> = {}
  for (const [id, idx] of Object.entries(data.answers)) {
    if (trimmedSet.has(id)) answers[id] = idx
  }
  return { reelIds: trimmed, answers, expiresAt: data.expiresAt }
}

/**
 * Mark a reel as done (continued, skipped, scrolled past).
 * Once done, it's excluded from feed rendering and future loads.
 */
export function addDone(reelId: string): void {
  const data = prune(load())
  if (data.reelIds.includes(reelId)) return
  save({
    reelIds: [...data.reelIds, reelId].slice(-MAX_IDS),
    answers: data.answers,
    expiresAt: data.expiresAt,
  })
}

/**
 * Record an MCQ answer (selected index) for a reel.
 * Does NOT mark the reel as done -- the user still needs to click Continue.
 */
export function addAnswered(reelId: string, selectedIndex: number): void {
  const data = prune(load())
  save({ ...data, answers: { ...data.answers, [reelId]: selectedIndex } })
}

/**
 * Remove a reel from the done set (e.g. on mutation-error rollback).
 */
export function removeDone(reelId: string): void {
  const data = prune(load())
  if (!data.reelIds.includes(reelId)) return
  const { [reelId]: _, ...rest } = data.answers
  save({
    reelIds: data.reelIds.filter((id) => id !== reelId),
    answers: rest,
    expiresAt: data.expiresAt,
  })
}

/** Remove an answer entry (e.g. on mutation-error rollback). */
export function removeAnswered(reelId: string): void {
  const data = prune(load())
  if (!(reelId in data.answers)) return
  const { [reelId]: _, ...rest } = data.answers
  save({ ...data, answers: rest })
}

/** Get the set of done reel IDs. */
export function getDoneSet(): Set<string> {
  const data = prune(load())
  if (data.expiresAt <= Date.now()) return new Set()
  return new Set(data.reelIds)
}

/** Check if a reel is done. */
export function isDone(reelId: string): boolean {
  return getDoneSet().has(reelId)
}

/** Get the MCQ answer map (reelId → selectedIndex). */
export function getAnswers(): Record<string, number> {
  const data = prune(load())
  if (data.expiresAt <= Date.now()) return {}
  return { ...data.answers }
}

// Legacy re-exports for any remaining callers during migration
export const addSeen = addDone
export const getSeenSet = getDoneSet
