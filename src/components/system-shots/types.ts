export const REEL_THEMES = ["accent", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const
export type ReelTheme = (typeof REEL_THEMES)[number]

/** Feed intent for spaced repetition system. */
export type FeedIntent = "reinforce" | "recall" | "build" | "mix"

/** API reel shape – compatible with ReelCard display type */
export type ApiReel = {
  id: string
  conceptId: string
  type: "mcq" | "flash"
  prompt: string
  options: string[] | null
  correctIndex: number | null
  explanation: string
  difficulty: number
  /** Feed intent for this reel (null for legacy reels). */
  intent?: FeedIntent | null
  /** Micro-signal hint for UI (e.g., "Seen before. Answer faster.") */
  microSignal?: string | null
}

/** Display shape for MCQ (options and correctIndex required). */
export type DisplayMCQ = ApiReel & { type: "mcq"; options: string[]; correctIndex: number }
/** Display shape for flash card. */
export type DisplayFlash = ApiReel & { type: "flash" }
/** Reel shape passed to ReelCard (ApiReel with non-null options/correctIndex for MCQ). */
export type DisplayReel = DisplayMCQ | DisplayFlash

// ============================================================================
// Focus Mode Types
// ============================================================================

/** Concept info for topic switcher display. */
export interface ConceptInfo {
  id: string
  name: string
  track?: string
  difficulty?: "intro" | "core" | "advanced"
}

