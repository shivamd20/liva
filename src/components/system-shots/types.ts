export const REEL_THEMES = ["accent", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const
export type ReelTheme = (typeof REEL_THEMES)[number]

/** Feed intent for spaced repetition system. */
export type FeedIntent = "reinforce" | "recall" | "build" | "mix"

/** All supported reel types. */
export type ReelType =
  | "mcq"
  | "flash"
  | "binary"
  | "ordering"
  | "free_text"
  | "voice"
  | "fill_blank"
  | "spot_error"
  | "this_or_that"
  | "component_picker"
  | "hot_take"
  | "estimation"
  | "interview_moment"
  | "what_breaks"
  | "incident"
  | "label_diagram"
  | "spot_spof"
  | "progressive"

/** API reel shape – compatible with ReelCard display types */
export type ApiReel = {
  id: string
  conceptId: string
  type: ReelType
  prompt: string
  options: string[] | null
  correctIndex: number | null
  explanation: string
  difficulty: number
  /** Feed intent for this reel (null for legacy reels). */
  intent?: FeedIntent | null
  /** Micro-signal hint for UI (e.g., "Seen before. Answer faster.") */
  microSignal?: string | null
  /** Type-specific metadata. */
  metadata?: ReelMetadata | null
  /** Chain ID for progressive sequences. */
  chainId?: string | null
  /** Position in chain. */
  chainOrder?: number | null
}

/** Type-specific metadata. */
export type ReelMetadata =
  | { kind: "ordering"; items: string[] }
  | { kind: "diagram"; mermaid: string; blankIndices?: number[]; correctComponentId?: string }
  | { kind: "free_text"; rubric?: string[] }

// ---------------------------------------------------------------------------
// Option-based types (share MCQ data shape with varying option counts / UX)
// ---------------------------------------------------------------------------

/** MCQ: 4 options, one correct. */
export type DisplayMCQ = ApiReel & { type: "mcq"; options: string[]; correctIndex: number }
/** Flash: concept card, tap Continue. */
export type DisplayFlash = ApiReel & { type: "flash" }
/** Binary: 2 options (True/False or Yes/No), one correct. */
export type DisplayBinary = ApiReel & { type: "binary"; options: [string, string]; correctIndex: number }
/** Fill-in-the-Blank: prompt with ___, 3-4 word-bank options, one correct. */
export type DisplayFillBlank = ApiReel & { type: "fill_blank"; options: string[]; correctIndex: number }
/** Spot-the-Error: statement with error, 3-4 options identifying what's wrong. */
export type DisplaySpotError = ApiReel & { type: "spot_error"; options: string[]; correctIndex: number }
/** This-or-That: 2 tradeoff options, no correct answer — trains tradeoff reasoning. */
export type DisplayThisOrThat = ApiReel & { type: "this_or_that"; options: [string, string]; correctIndex: null }
/** Component Picker: 4 tech choices given requirements, one correct. */
export type DisplayComponentPicker = ApiReel & { type: "component_picker"; options: string[]; correctIndex: number }
/** Hot Take: controversial statement, 3 options (Agree/Disagree/It depends). */
export type DisplayHotTake = ApiReel & { type: "hot_take"; options: [string, string, string]; correctIndex: number }
/** Estimation: back-of-envelope, 3-4 magnitude options, one correct. */
export type DisplayEstimation = ApiReel & { type: "estimation"; options: string[]; correctIndex: number }
/** Interview Moment: simulated interviewer question, 4 approach options. */
export type DisplayInterviewMoment = ApiReel & { type: "interview_moment"; options: string[]; correctIndex: number }
/** What Breaks: architecture + failure scenario, 4 consequence options. */
export type DisplayWhatBreaks = ApiReel & { type: "what_breaks"; options: string[]; correctIndex: number }
/** Incident Response: production alert, 4 diagnosis options. */
export type DisplayIncident = ApiReel & { type: "incident"; options: string[]; correctIndex: number }

// ---------------------------------------------------------------------------
// Ordering type
// ---------------------------------------------------------------------------

/** Ordering: drag-to-reorder items. */
export type DisplayOrdering = ApiReel & {
  type: "ordering"
  metadata: { kind: "ordering"; items: string[] }
}

// ---------------------------------------------------------------------------
// Free-form types
// ---------------------------------------------------------------------------

/** Free Text: user types answer, AI grades. */
export type DisplayFreeText = ApiReel & { type: "free_text" }
/** Voice: user speaks answer, AI grades. */
export type DisplayVoice = ApiReel & { type: "voice" }

// ---------------------------------------------------------------------------
// Diagram types
// ---------------------------------------------------------------------------

/** Label the Architecture: mermaid diagram with blanked labels. */
export type DisplayLabelDiagram = ApiReel & {
  type: "label_diagram"
  options: string[]
  metadata: { kind: "diagram"; mermaid: string; blankIndices?: number[] }
}
/** Spot the SPOF: tap the single point of failure in a diagram. */
export type DisplaySpotSpof = ApiReel & {
  type: "spot_spof"
  options: string[]
  correctIndex: number
  metadata: { kind: "diagram"; mermaid: string; correctComponentId?: string }
}

// ---------------------------------------------------------------------------
// Progressive chain
// ---------------------------------------------------------------------------

/** Progressive Design: one reel in a multi-reel chain. */
export type DisplayProgressive = ApiReel & {
  type: "progressive"
  options: string[]
  correctIndex: number
  chainId: string
  chainOrder: number
}

/** All display reel variants. */
export type DisplayReel =
  | DisplayMCQ
  | DisplayFlash
  | DisplayBinary
  | DisplayFillBlank
  | DisplaySpotError
  | DisplayThisOrThat
  | DisplayComponentPicker
  | DisplayHotTake
  | DisplayEstimation
  | DisplayInterviewMoment
  | DisplayWhatBreaks
  | DisplayIncident
  | DisplayOrdering
  | DisplayFreeText
  | DisplayVoice
  | DisplayLabelDiagram
  | DisplaySpotSpof
  | DisplayProgressive

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

