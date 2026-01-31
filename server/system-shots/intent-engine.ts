/**
 * Intent Engine - Determines feed intent for spaced repetition system.
 * 
 * V3: 7-level mastery system integration.
 * 
 * Intents:
 * - reinforce: strengthen weak memory (stability < 0.4, skipped, failing)
 * - recall: test retrieval after dynamic interval (stability 0.4-0.7)
 * - build: introduce harder angles (stability > 0.6, recent recalls correct)
 * - mix: prevent boredom (random adjacent concept, same difficulty)
 * - practice: real interview problems for higher mastery levels
 */

import type { FeedIntent, TopicStateRow, ConceptV2, MasteryLevel } from "./types";

/** Intent weights for scoring. */
export const INTENT_WEIGHTS: Record<FeedIntent, number> = {
  reinforce: 1.4,
  recall: 1.2,
  build: 1.0,
  mix: 0.6,
  practice: 1.3, // High priority for practice problems
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

/** Mastery level thresholds for the 7-level system. */
export const MASTERY_THRESHOLDS = {
  /** Level 0: Unseen - exposureCount === 0 */
  RECOGNIZER_MIN_EXPOSURE: 1,
  /** Level 1: Recognizer - exposureCount >= 1 */
  EXPLAINER_MIN_EXPOSURE: 2,
  /** Level 2: Explainer - exposureCount >= 2, but low accuracy */
  APPLIER_MIN_STABILITY: 0.3,
  /** Level 3: Applier - stability >= 0.3 */
  INTEGRATOR_MIN_STABILITY: 0.5,
  /** Level 4: Integrator - stability >= 0.5 */
  TRADEOFF_MIN_STABILITY: 0.65,
  /** Level 5: Tradeoff Driver - stability >= 0.65 */
  EXPERT_MIN_STABILITY: 0.8,
  /** Level 6: Failure-Aware Expert - stability >= 0.8 */
  INTERVIEW_GRADE_MIN_STABILITY: 0.9,
  /** Level 7: Interview-Grade - stability >= 0.9, high exposure, no recent failures */
};

/**
 * Derive mastery level (0-7) from topic state.
 * This is the new 7-level mastery system from concept_mastery.md.
 */
export function deriveMasteryLevel(
  exposureCount: number,
  accuracyEma: number,
  failureStreak: number,
  stabilityScore: number
): MasteryLevel {
  // Level 0: Unseen
  if (exposureCount === 0) return 0;

  // Level 1: Recognizer - has seen concept but minimal exposure
  if (exposureCount < MASTERY_THRESHOLDS.EXPLAINER_MIN_EXPOSURE) return 1;

  // Level 2: Explainer - struggling (low accuracy or failing)
  if (accuracyEma < 0.5 || failureStreak >= 2) return 2;

  // Level 3: Applier - basic competence
  if (stabilityScore < MASTERY_THRESHOLDS.APPLIER_MIN_STABILITY) return 3;

  // Level 4: Integrator - can compose with other concepts
  if (stabilityScore < MASTERY_THRESHOLDS.INTEGRATOR_MIN_STABILITY) return 4;

  // Level 5: Tradeoff Driver - uses concept to drive decisions
  if (stabilityScore < MASTERY_THRESHOLDS.TRADEOFF_MIN_STABILITY) return 5;

  // Level 6: Failure-Aware Expert - understands failure modes
  if (stabilityScore < MASTERY_THRESHOLDS.EXPERT_MIN_STABILITY) return 6;

  // Level 7: Interview-Grade - usable under interview pressure
  // Requires high stability, good accuracy, no recent failures
  if (stabilityScore >= MASTERY_THRESHOLDS.INTERVIEW_GRADE_MIN_STABILITY && 
      accuracyEma >= 0.8 && 
      failureStreak === 0) {
    return 7;
  }

  // Default to level 6 if almost there
  return 6;
}

/**
 * Get the recommended intent based on mastery level.
 * - Levels 0-2: primarily reinforce
 * - Levels 3-4: primarily recall and build
 * - Levels 5-7: primarily practice problems
 */
export function getIntentForMasteryLevel(masteryLevel: MasteryLevel): FeedIntent {
  switch (masteryLevel) {
    case 0:
    case 1:
    case 2:
      return "reinforce";
    case 3:
      return "recall";
    case 4:
      return "build";
    case 5:
    case 6:
    case 7:
      return "practice";
    default:
      return "reinforce";
  }
}

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
  exposureCount: number,
  problemName?: string
): string | null {
  if (skipCount > 0) return "You skipped this before.";
  if (intent === "reinforce" && exposureCount > 2) return "Seen before. Answer faster.";
  if (intent === "build") return "Same idea. New angle.";
  if (intent === "recall") return "Quick check.";
  if (intent === "practice") return problemName ? `Interview: ${problemName}` : "Real interview problem.";
  return null;
}

/**
 * Get prompt modifier based on mastery level for LLM generation.
 * This tells the LLM what type of content to generate based on the user's level.
 */
export function getMasteryLevelPromptModifier(masteryLevel: MasteryLevel): string {
  switch (masteryLevel) {
    case 0:
      return "User is NEW to this concept. Generate ultra-short intuition with one concrete real-world analogy.";
    case 1:
      return "User is a RECOGNIZER. Generate crisp definition with 'this is NOT X' contrasts. Focus on basic recognition.";
    case 2:
      return "User is an EXPLAINER (struggling). Generate structured explanation with component breakdown. Keep it approachable.";
    case 3:
      return "User is an APPLIER. Generate constrained design prompts or 'where would you use this?' exercises.";
    case 4:
      return "User is an INTEGRATOR. Generate multi-concept scenarios with failure-mode prompts and tradeoff matrices.";
    case 5:
      return "User is a TRADEOFF DRIVER. Generate ambiguous design problems with 'what would you sacrifice?' prompts.";
    case 6:
      return "User is a FAILURE-AWARE EXPERT. Generate incident-style prompts, postmortem analysis, and misconfiguration scenarios.";
    case 7:
      return "User has INTERVIEW-GRADE mastery. Generate adversarial interviewer questions with follow-up chains under time pressure.";
    default:
      return "";
  }
}
