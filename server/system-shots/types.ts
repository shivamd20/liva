/**
 * System Shots – shared types for reels, concepts, and event payloads.
 * v2: locked ontology (ConceptType, Track, Signal, ConceptV2).
 */

export type ReelType =
  | "mcq"
  | "flash"
  | "binary"
  | "ordering"
  | "free_text"
  | "voice";

/** Feed intent for spaced repetition system. */
export type FeedIntent = "reinforce" | "recall" | "build" | "mix";

/** API/DB reel shape. V1: only MCQ generated and scored. */
export interface Reel {
  id: string;
  conceptId: string;
  type: ReelType;
  prompt: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  difficulty: number;
  createdAt?: number;
  consumedAt?: number | null;
  /** Feed intent for this reel (null for legacy reels). */
  intent?: FeedIntent | null;
  /** Number of times this reel was skipped. */
  skipCount?: number;
  /** Micro-signal hint for UI (computed on demand). */
  microSignal?: string | null;
}

/** v2 locked concept type. */
export type ConceptType =
  | "principle"
  | "primitive"
  | "pattern"
  | "system";

/** v2 locked track. */
export type Track =
  | "foundations"
  | "distributed-systems"
  | "storage"
  | "messaging-streaming"
  | "scalability"
  | "reliability"
  | "latency-performance"
  | "data-modeling"
  | "system-archetypes"
  | "deployment-environments"
  | "operability"
  | "security";

/** v2 signal (for feed / mastery). */
export type Signal =
  | "tradeoff_reasoning"
  | "failure_mode_awareness"
  | "scalability_instinct"
  | "latency_reasoning"
  | "consistency_reasoning"
  | "cost_reasoning"
  | "operability_awareness"
  | "interview_structuring"
  | "security_awareness";

/** v2 frozen concept schema – no further fields. */
export interface ConceptV2 {
  id: string;
  name: string;
  type: ConceptType;
  track: Track;
  difficulty_hint: "intro" | "core" | "advanced";
  requires_tags: string[];
  related_tags: string[];
  signals: Signal[];
  typical_questions: string[];
}

/** Legacy concept shape (for DB seed rows only). */
export interface Concept {
  id: string;
  name: string;
  difficultyTier?: number;
}

/** Topic state row (derived from events). */
export interface TopicStateRow {
  conceptId: string;
  exposureCount: number;
  accuracyEma: number;
  failureStreak: number;
  lastAt: number;
  /** Stability score for spaced repetition (0-1). */
  stabilityScore: number;
}

/** Event: reel_generated */
export interface ReelGeneratedPayload {
  reelId: string;
  conceptId: string;
  type: ReelType;
  createdAt: number;
}

/** Event: reel_shown */
export interface ReelShownPayload {
  reelId: string;
  conceptId: string;
  shownAt: number;
}

/** Event: answer_submitted */
export interface AnswerSubmittedPayload {
  reelId: string;
  conceptId: string;
  selectedIndex: number | null;
  correct: boolean;
  skipped?: boolean;
  timestamp: number;
}

export type EventType = "reel_generated" | "reel_shown" | "answer_submitted";

export type EventPayload =
  | ReelGeneratedPayload
  | ReelShownPayload
  | AnswerSubmittedPayload;

/** Mastery bucket derived from topic state (not stored). */
export type Mastery = "solid" | "learning" | "weak" | "unknown";

/** Canonical practice problem: system design question with required concepts. */
export interface PracticeProblem {
  id: string;
  name: string;
  requiredConceptIds: string[];
  /** Optional category for grouping (e.g. "core", "storage", "advanced"). */
  category?: string;
}

/** Concept id → signals (for adaptive sequencing). */
export type ConceptToSignalsMap = Record<string, Signal[]>;

/** Progress item for getProgress API: concept + topic state + derived mastery. */
export interface ProgressItem {
  conceptId: string;
  name: string;
  difficultyTier?: number;
  /** v2: intro | core | advanced */
  difficulty_hint?: "intro" | "core" | "advanced";
  /** v2: for tag/track filters */
  type?: ConceptType;
  track?: Track;
  exposureCount: number;
  accuracyEma: number;
  failureStreak: number;
  lastAt: number;
  mastery: Mastery;
}

/** Response shape for getProgress. */
export interface ProgressResponse {
  items: ProgressItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// User Learning Preferences
// ─────────────────────────────────────────────────────────────────────────────

/** Difficulty override: -1 = Easier, 0 = Auto (canonical), +1 = Harder */
export type DifficultyOverride = -1 | 0 | 1;

/** Priority bias: -1 = Less focus, 0 = Normal, +1 = More focus */
export type PriorityBias = -1 | 0 | 1;

/**
 * User concept preferences – signals that bias the feed without changing canonical structure.
 * Users may bias the path; they may not define the path.
 */
export interface UserConceptPrefs {
  conceptId: string;
  /** Whether this concept is enabled in the feed. Disabled = excluded from generation. */
  enabled: boolean;
  /** Adjusts question difficulty tier: effective = clamp(canonical + override, 1, 3) */
  difficultyOverride: DifficultyOverride;
  /** Biases selection probability: score *= (1 + bias * 0.3) */
  priorityBias: PriorityBias;
}

/**
 * User-added topic overlay – NOT a canonical concept.
 * These only affect LLM prompt context, never become prerequisites or unlock systems.
 */
export interface UserTopicOverlay {
  id: string;
  /** Short title for the topic (e.g., "Cloudflare Durable Objects") */
  title: string;
  /** 1-2 line description fed to LLM for context */
  description: string;
  /** Optional mapping to canonical concept IDs for relevance scoring */
  mappedConceptIds: string[];
  createdAt: number;
}

/** Response shape for getPreferences API. */
export interface PreferencesResponse {
  /** Concept preferences (only non-default values stored) */
  conceptPrefs: UserConceptPrefs[];
  /** User-added topic overlays */
  topicOverlays: UserTopicOverlay[];
}
