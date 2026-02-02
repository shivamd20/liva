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
export type FeedIntent = "reinforce" | "recall" | "build" | "mix" | "practice";

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
  /** Practice problem ID (only for practice intent reels). */
  problemId?: string | null;
  /** Internal reasoning for the correct answer (Chain of Thought). */
  reasoning?: string | null;
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

/** v2 frozen concept schema – extended with mastery specs. */
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
  /** Custom mastery level definitions for this concept. */
  masterySpec?: LevelExpectation[];
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

/** Legacy mastery bucket (deprecated, use MasteryLevel). */
export type Mastery = "solid" | "learning" | "weak" | "unknown";

/** 7-level mastery system (0-7). */
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Canonical mastery level definitions. */
export const MASTERY_LEVELS = {
  0: { name: "Unseen", short: "New", description: "Concept has not entered working memory" },
  1: { name: "Recognizer", short: "Recognizer", description: "Can identify where concept applies" },
  2: { name: "Explainer", short: "Explainer", description: "Can explain to another engineer" },
  3: { name: "Applier", short: "Applier", description: "Can apply in isolation" },
  4: { name: "Integrator", short: "Integrator", description: "Can compose with other concepts" },
  5: { name: "Tradeoff Driver", short: "Tradeoff", description: "Uses concept to drive decisions" },
  6: { name: "Failure-Aware Expert", short: "Expert", description: "Understands failure modes" },
  7: { name: "Interview-Grade", short: "Mastered", description: "Usable under interview pressure" },
} as const;

/** Per-level expectations for a concept - what user must demonstrate at each level. */
export interface LevelExpectation {
  level: MasteryLevel;
  /** What user must demonstrate to be at this level. */
  mustDemonstrate: string[];
  /** Common mistakes that indicate user is NOT at this level. */
  commonMistakes: string[];
  /** Optional: things that immediately disqualify user from this level. */
  disqualifiers?: string[];
}

/** Full mastery specification for a concept. */
export interface ConceptMasterySpec {
  conceptId: string;
  levelExpectations: LevelExpectation[];
}

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
  stabilityScore: number;
  /** Legacy 4-tier mastery (deprecated). */
  mastery: Mastery;
  /** New 7-level mastery system. */
  masteryLevel: MasteryLevel;
  /** Custom mastery level definitions for this concept. */
  masterySpec?: LevelExpectation[];
}

/** Response shape for getProgress. */
export interface ProgressResponse {
  items: ProgressItem[];
}
