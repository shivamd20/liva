/**
 * Client-side cache of seen reel IDs with TTL.
 * Prevents repetitive feed - once a reel is seen (scrolled past, continued, or skipped),
 * it's hidden from the feed for the TTL period.
 */

const STORAGE_KEY = "liva-seen-reels"
const TTL_MS = 72 * 60 * 60 * 1000 // 72 hours
const MAX_IDS = 500

interface CachedData {
  reelIds: string[]
  expiresAt: number
}

function load(): CachedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { reelIds: [], expiresAt: Date.now() + TTL_MS }
    const parsed = JSON.parse(raw) as CachedData
    return {
      reelIds: Array.isArray(parsed.reelIds) ? parsed.reelIds : [],
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : Date.now() + TTL_MS,
    }
  } catch {
    return { reelIds: [], expiresAt: Date.now() + TTL_MS }
  }
}

function save(data: CachedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable - ignore
  }
}

function prune(data: CachedData): CachedData {
  const now = Date.now()
  if (data.expiresAt <= now) {
    return { reelIds: [], expiresAt: now + TTL_MS }
  }
  if (data.reelIds.length <= MAX_IDS) {
    return data
  }
  return {
    reelIds: data.reelIds.slice(-MAX_IDS),
    expiresAt: data.expiresAt,
  }
}

/**
 * Add a reel ID to the seen cache.
 * Call when user scrolls past, continues, or skips a reel.
 */
export function addSeen(reelId: string): void {
  const data = prune(load())
  if (data.reelIds.includes(reelId)) return
  const next: CachedData = {
    reelIds: [...data.reelIds, reelId].slice(-MAX_IDS),
    expiresAt: data.expiresAt,
  }
  save(next)
}

/**
 * Check if a reel ID is in the seen cache (and not expired).
 */
export function isSeen(reelId: string): boolean {
  const data = load()
  if (data.expiresAt <= Date.now()) return false
  return data.reelIds.includes(reelId)
}

/**
 * Get the current set of seen reel IDs for filtering.
 * Returns a new Set each call - caller should memoize if needed.
 */
export function getSeenSet(): Set<string> {
  const data = prune(load())
  if (data.expiresAt <= Date.now()) return new Set()
  return new Set(data.reelIds)
}

/**
 * Prune expired entries and trim to MAX_IDS.
 * Call periodically or on app focus to keep storage lean.
 */
export function pruneExpired(): void {
  const data = prune(load())
  save(data)
}
