/**
 * Intent Engine - Determines feed intent for spaced repetition system.
 * 
 * Intents:
 * - reinforce: strengthen weak memory (stability < 0.4, skipped, failing)
 * - recall: test retrieval after dynamic interval (stability 0.4-0.7)
 * - build: introduce harder angles (stability > 0.6, recent recalls correct)
 * - mix: prevent boredom (random adjacent concept, same difficulty)
 */

import type { FeedIntent, TopicStateRow, ConceptV2 } from "./types";

/** Intent weights for scoring. */
export const INTENT_WEIGHTS: Record<FeedIntent, number> = {
  reinforce: 1.4,
  recall: 1.2,
  build: 1.0,
  mix: 0.6,
};

/** Thresholds for intent determination. */
export const THRESHOLDS = {
  /** Below this stability, concept needs reinforcement. */
  REINFORCE_MAX: 0.4,
  /** Above this stability, concept is ready for building. */
  BUILD_MIN: 0.6,
  /** Recall applies in this stability range. */
  RECALL_MIN: 0.4,
  RECALL_MAX: 0.7,
  /** Failure streak that triggers reinforcement. */
  FAILURE_STREAK_THRESHOLD: 2,
  /** Base multiplier for dynamic recall interval (hours). */
  RECALL_BASE_HOURS: 6,
};

/** State needed for intent computation per concept. */
export interface ConceptIntentInput {
  conceptId: string;
  stabilityScore: number;
  exposureCount: number;
  accuracyEma: number;
  failureStreak: number;
  lastAt: number;
  difficulty: number;
  skipCount: number;
  /** Whether last 2 recall attempts were correct (for Build eligibility). */
  lastTwoRecallsCorrect: boolean;
}

/** Result of intent assignment with score. */
export interface ConceptWithIntent {
  conceptId: string;
  intent: FeedIntent;
  score: number;
  /** Why this intent was assigned (for debugging). */
  reason: string;
}

/**
 * Compute the dynamic recall interval in hours.
 * Formula: baseDifficulty * 6 * (1 + stability^2)
 */
export function computeRecallIntervalHours(difficulty: number, stability: number): number {
  return difficulty * THRESHOLDS.RECALL_BASE_HOURS * (1 + stability ** 2);
}

/**
 * Time decay factor based on last seen time.
 * Returns higher value for concepts seen longer ago.
 */
export function computeTimeDecay(lastAt: number, now: number = Date.now()): number {
  if (lastAt === 0) return 1.0; // never seen
  const hoursSince = (now - lastAt) / (1000 * 60 * 60);
  // Logarithmic decay: more time = higher urgency
  return Math.min(2.0, 1 + Math.log10(hoursSince + 1) * 0.3);
}

/**
 * Determine the primary intent for a concept based on its state.
 */
export function determineIntent(input: ConceptIntentInput): { intent: FeedIntent; reason: string } {
  const { stabilityScore, failureStreak, skipCount, lastAt, difficulty, lastTwoRecallsCorrect } = input;
  const now = Date.now();

  // Reinforce: weak memory, skipped, or failing
  if (stabilityScore < THRESHOLDS.REINFORCE_MAX) {
    return { intent: "reinforce", reason: `stability ${stabilityScore.toFixed(2)} < ${THRESHOLDS.REINFORCE_MAX}` };
  }
  if (skipCount > 0) {
    return { intent: "reinforce", reason: `skipCount ${skipCount} > 0` };
  }
  if (failureStreak >= THRESHOLDS.FAILURE_STREAK_THRESHOLD) {
    return { intent: "reinforce", reason: `failureStreak ${failureStreak} >= ${THRESHOLDS.FAILURE_STREAK_THRESHOLD}` };
  }

  // Build: high stability AND last 2 recalls correct
  if (stabilityScore > THRESHOLDS.BUILD_MIN && lastTwoRecallsCorrect) {
    return { intent: "build", reason: `stability ${stabilityScore.toFixed(2)} > ${THRESHOLDS.BUILD_MIN} and recent recalls correct` };
  }

  // Recall: medium stability AND enough time has passed
  if (stabilityScore >= THRESHOLDS.RECALL_MIN && stabilityScore <= THRESHOLDS.RECALL_MAX) {
    const intervalHours = computeRecallIntervalHours(difficulty, stabilityScore);
    const hoursSinceLast = (now - lastAt) / (1000 * 60 * 60);
    if (hoursSinceLast >= intervalHours || lastAt === 0) {
      return { intent: "recall", reason: `stability in recall range, ${hoursSinceLast.toFixed(1)}h >= ${intervalHours.toFixed(1)}h interval` };
    }
  }

  // Default to reinforce if no other intent applies
  return { intent: "reinforce", reason: "default fallback" };
}

/**
 * Compute the overall score for a concept with its assigned intent.
 * Higher score = higher priority in the feed.
 * 
 * Formula: intentWeight * (1 - stability) * timeDecay * (1 + 0.3 * skipCount)
 */
export function computeScore(input: ConceptIntentInput, intent: FeedIntent): number {
  const { stabilityScore, skipCount, lastAt } = input;
  
  const intentWeight = INTENT_WEIGHTS[intent];
  const instabilityFactor = 1 - stabilityScore;
  const timeDecay = computeTimeDecay(lastAt);
  const skipPenalty = 1 + 0.3 * skipCount;

  return intentWeight * instabilityFactor * timeDecay * skipPenalty;
}

/**
 * Assign intent and compute score for a concept.
 */
export function assignIntentAndScore(input: ConceptIntentInput): ConceptWithIntent {
  const { intent, reason } = determineIntent(input);
  const score = computeScore(input, intent);

  return {
    conceptId: input.conceptId,
    intent,
    score,
    reason,
  };
}

/**
 * Build ConceptIntentInput from TopicStateRow and concept metadata.
 */
export function buildConceptIntentInput(
  topicState: TopicStateRow | undefined,
  concept: ConceptV2,
  skipCount: number = 0,
  lastTwoRecallsCorrect: boolean = true
): ConceptIntentInput {
  const difficulty = difficultyHintToNumber(concept.difficulty_hint);
  
  if (!topicState) {
    // New concept: no prior state
    return {
      conceptId: concept.id,
      stabilityScore: 0,
      exposureCount: 0,
      accuracyEma: 0.5,
      failureStreak: 0,
      lastAt: 0,
      difficulty,
      skipCount,
      lastTwoRecallsCorrect,
    };
  }

  return {
    conceptId: concept.id,
    stabilityScore: topicState.stabilityScore,
    exposureCount: topicState.exposureCount,
    accuracyEma: topicState.accuracyEma,
    failureStreak: topicState.failureStreak,
    lastAt: topicState.lastAt,
    difficulty,
    skipCount,
    lastTwoRecallsCorrect,
  };
}

/** Convert difficulty_hint to numeric value. */
function difficultyHintToNumber(hint?: "intro" | "core" | "advanced"): number {
  switch (hint) {
    case "intro": return 1;
    case "core": return 2;
    case "advanced": return 3;
    default: return 2;
  }
}

/**
 * Get micro-signal text for UI based on intent and state.
 */
export function getMicroSignal(
  intent: FeedIntent,
  skipCount: number,
  exposureCount: number
): string | null {
  if (skipCount > 0) return "You skipped this before.";
  if (intent === "reinforce" && exposureCount > 2) return "Seen before. Answer faster.";
  if (intent === "build") return "Same idea. New angle.";
  if (intent === "recall") return "Quick check.";
  return null;
}
