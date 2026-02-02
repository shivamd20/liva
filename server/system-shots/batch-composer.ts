/**
 * Batch Composer - Enforces intent distribution for feed batches.
 * 
 * V3: Updated distribution with practice problems (50% of batch):
 * - 2 Reinforce (strengthen weak memory)
 * - 2 Recall (spaced retrieval testing)
 * - 1 Build (new angles on mastered concepts)
 * - 0 Mix (removed in favor of practice)
 * - 5 Practice (real interview problems)
 */

import type { FeedIntent, TopicStateRow, ConceptV2, PracticeProblem } from "./types";
import {
  buildConceptIntentInput,
  assignIntentAndScore,
  type ConceptWithIntent,
} from "./intent-engine";
import { PRACTICE_PROBLEMS_V1 } from "./concepts";

/** Target distribution for a 20-reel batch. */
export const BATCH_SLOTS = {
  reinforce: 4,
  recall: 4, 
  build: 2,
  mix: 2, // Added mix back for novelty
  practice: 8, // 40% of batch - real interview problems
} as const;

/** Total batch size (sum of all slots). */
export const BATCH_SIZE = 20;

/** Median stability threshold below which new concepts are blocked. */
export const MEDIAN_STABILITY_THRESHOLD = 0.55;

/** Practice item with problem context. */
export interface PracticeItem extends ConceptWithIntent {
  /** Practice problem ID. */
  problemId: string;
  /** Practice problem name. */
  problemName: string;
}

/** Result of batch composition. */
export interface ComposedBatch {
  /** Concepts with assigned intents, ordered by priority. */
  items: ConceptWithIntent[];
  /** Practice problem items. */
  practiceItems: PracticeItem[];
  /** Whether Build intent is blocked due to low median stability. */
  buildBlocked: boolean;
  /** Median stability of all seen concepts. */
  medianStability: number;
  /** Debug info about slot filling. */
  slotFillInfo: Record<FeedIntent, number>;
}

/** Aggregate skip counts per concept from reels. */
export interface ConceptSkipCounts {
  [conceptId: string]: number;
}

/** Options for batch composition. */
export interface ComposeBatchOptions {
  skipCounts?: ConceptSkipCounts;
  /** Recently used problem IDs to avoid repetition. */
  recentProblemIds?: string[];
}

/**
 * Compute median of an array of numbers.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Check if a concept is "seen" (has any exposure).
 */
function isSeen(conceptId: string, topicStateMap: Map<string, TopicStateRow>): boolean {
  const state = topicStateMap.get(conceptId);
  return state !== undefined && state.exposureCount > 0;
}

/**
 * Get concepts related to a given concept (for Mix intent).
 * Uses related_tags from ConceptV2.
 */
function getRelatedConcepts(
  concept: ConceptV2,
  allConcepts: ConceptV2[],
  topicStateMap: Map<string, TopicStateRow>
): ConceptV2[] {
  // Find concepts with overlapping related_tags or same track
  const related = allConcepts.filter((c) => {
    if (c.id === concept.id) return false;
    // Same track
    if (c.track === concept.track) return true;
    // Overlapping related tags
    const overlap = c.related_tags.some((t) => concept.related_tags.includes(t));
    return overlap;
  });
  
  // Prefer seen concepts for mix
  const seenRelated = related.filter((c) => isSeen(c.id, topicStateMap));
  return seenRelated.length > 0 ? seenRelated : related;
}

/**
 * Compose a batch of concepts with assigned intents.
 * V3: Includes practice problems.
 */
export function composeBatch(
  topicStates: TopicStateRow[],
  concepts: ConceptV2[],
  skipCounts: ConceptSkipCounts = {},
  batchSize: number = BATCH_SIZE,
  options: ComposeBatchOptions = {}
): ComposedBatch {
  const { recentProblemIds = [] } = options;
  const recentProblemSet = new Set(recentProblemIds);

  // Build lookup maps
  const topicStateMap = new Map(topicStates.map((t) => [t.conceptId, t]));
  const conceptMap = new Map(concepts.map((c) => [c.id, c]));

  // Compute median stability of seen concepts
  const seenStabilities = topicStates
    .filter((t) => t.exposureCount > 0)
    .map((t) => t.stabilityScore);
  const medianStability = median(seenStabilities);
  
  // Determine if Build is blocked
  const buildBlocked = medianStability < MEDIAN_STABILITY_THRESHOLD;

  // Assign intent and score to all concepts
  const scoredConcepts: ConceptWithIntent[] = concepts.map((concept) => {
    const state = topicStateMap.get(concept.id);
    const skipCount = skipCounts[concept.id] ?? 0;
    const input = buildConceptIntentInput(state, concept, skipCount, true);
    const result = assignIntentAndScore(input);
    
    return result;
  });

  // If Build is blocked, convert Build intents to Reinforce
  if (buildBlocked) {
    for (const item of scoredConcepts) {
      if (item.intent === "build") {
        item.intent = "reinforce";
        item.reason += " (build blocked, converted to reinforce)";
      }
    }
  }

  // Also block Build for unseen concepts (hard cap on new concepts)
  for (const item of scoredConcepts) {
    if (item.intent === "build" && !isSeen(item.conceptId, topicStateMap)) {
      item.intent = "reinforce";
      item.reason += " (unseen concept, converted to reinforce)";
    }
  }

  // Calculate scaled slot counts for the requested batch size (concept slots only)
  const scale = batchSize / BATCH_SIZE;
  const practiceSlots = Math.round(BATCH_SLOTS.practice * scale);
  const conceptSlots = batchSize - practiceSlots;
  
  const targetSlots: Record<FeedIntent, number> = {
    reinforce: Math.round(BATCH_SLOTS.reinforce * scale),
    recall: Math.round(BATCH_SLOTS.recall * scale),
    build: buildBlocked ? 0 : Math.round(BATCH_SLOTS.build * scale),
    mix: Math.round(BATCH_SLOTS.mix * scale),
    practice: practiceSlots,
  };

  // If build is blocked, redistribute slots to reinforce and recall
  if (buildBlocked) {
    const buildSlots = Math.round(BATCH_SLOTS.build * scale);
    targetSlots.reinforce += Math.ceil(buildSlots / 2);
    targetSlots.recall += Math.floor(buildSlots / 2);
  }

  // Ensure concept slots match expected count
  const conceptSlotsTotal = targetSlots.reinforce + targetSlots.recall + targetSlots.build + targetSlots.mix;
  if (conceptSlotsTotal < conceptSlots) {
    targetSlots.reinforce += conceptSlots - conceptSlotsTotal;
  }

  // Sort concepts by score (descending) within each intent bucket
  const buckets: Record<Exclude<FeedIntent, "practice">, ConceptWithIntent[]> = {
    reinforce: [],
    recall: [],
    build: [],
    mix: [],
  };

  for (const item of scoredConcepts) {
    if (item.intent !== "practice") {
      buckets[item.intent as Exclude<FeedIntent, "practice">].push(item);
    }
  }

  for (const intent of Object.keys(buckets) as Exclude<FeedIntent, "practice">[]) {
    buckets[intent].sort((a, b) => b.score - a.score);
  }

  // Fill concept slots from each bucket
  const result: ConceptWithIntent[] = [];
  const usedConceptIds = new Set<string>();
  const slotFillInfo: Record<FeedIntent, number> = { reinforce: 0, recall: 0, build: 0, mix: 0, practice: 0 };

  // Fill in order: reinforce, recall, build, mix
  const fillOrder: Exclude<FeedIntent, "practice">[] = ["reinforce", "recall", "build", "mix"];
  
  for (const intent of fillOrder) {
    const target = targetSlots[intent];
    const bucket = buckets[intent];
    let filled = 0;
    
    for (const item of bucket) {
      if (filled >= target) break;
      if (usedConceptIds.has(item.conceptId)) continue;
      
      result.push(item);
      usedConceptIds.add(item.conceptId);
      filled++;
    }
    
    slotFillInfo[intent] = filled;
  }

  // If we still need more concept items, fill from any remaining concepts
  if (result.length < conceptSlots) {
    const remaining = scoredConcepts
      .filter((item) => !usedConceptIds.has(item.conceptId))
      .sort((a, b) => b.score - a.score);
    
    for (const item of remaining) {
      if (result.length >= conceptSlots) break;
      result.push(item);
      usedConceptIds.add(item.conceptId);
    }
  }

  // Compose practice problems
  const practiceItems = composePracticeItems(
    topicStates,
    topicStateMap,
    conceptMap,
    practiceSlots,
    recentProblemSet,
    usedConceptIds
  );
  slotFillInfo.practice = practiceItems.length;

  // Final sort by score for concept items
  result.sort((a, b) => b.score - a.score);

  return {
    items: result.slice(0, conceptSlots),
    practiceItems,
    buildBlocked,
    medianStability,
    slotFillInfo,
  };
}

/**
 * Compose practice problem items based on user's concept mastery.
 * Prioritizes problems that exercise concepts the user knows but could strengthen.
 */
function composePracticeItems(
  topicStates: TopicStateRow[],
  topicStateMap: Map<string, TopicStateRow>,
  conceptMap: Map<string, ConceptV2>,
  count: number,
  recentProblemSet: Set<string>,
  usedConceptIds: Set<string>
): PracticeItem[] {
  const practiceItems: PracticeItem[] = [];
  const usedProblemIds = new Set<string>();

  // Score problems based on how well user knows the required concepts
  const scoredProblems: { problem: PracticeProblem; score: number; bestConceptId: string }[] = [];
  
  for (const problem of PRACTICE_PROBLEMS_V1) {
    // Skip recently used problems
    if (recentProblemSet.has(problem.id)) continue;

    // Calculate average mastery of required concepts
    let totalStability = 0;
    let knownConcepts = 0;
    let bestConceptId = problem.requiredConceptIds[0];
    let bestStability = 0;

    for (const conceptId of problem.requiredConceptIds) {
      const state = topicStateMap.get(conceptId);
      if (state && state.exposureCount > 0) {
        totalStability += state.stabilityScore;
        knownConcepts++;
        // Track the concept with lowest stability for reinforcement
        if (state.stabilityScore < bestStability || bestStability === 0) {
          bestStability = state.stabilityScore;
          bestConceptId = conceptId;
        }
      }
    }

    // Score: prefer problems where user knows some concepts but not all
    // Ideal: 40-70% concepts known with medium stability
    const knownRatio = knownConcepts / problem.requiredConceptIds.length;
    const avgStability = knownConcepts > 0 ? totalStability / knownConcepts : 0;
    
    // Scoring formula: favor problems with partial mastery
    let score = 0;
    if (knownRatio >= 0.3 && knownRatio <= 0.8) {
      // Sweet spot: some knowledge, room to grow
      score = 1.0 + (avgStability * 0.5);
    } else if (knownRatio > 0.8) {
      // High mastery: still valuable for interview practice
      score = 0.8 + (avgStability * 0.3);
    } else if (knownRatio > 0) {
      // Low mastery: deprioritize but don't exclude
      score = 0.4 + (avgStability * 0.2);
    } else {
      // No exposure: very low priority
      score = 0.1;
    }

    scoredProblems.push({ problem, score, bestConceptId });
  }

  // Sort by score descending
  scoredProblems.sort((a, b) => b.score - a.score);

  // Fill practice slots
  for (const { problem, score, bestConceptId } of scoredProblems) {
    if (practiceItems.length >= count) break;
    if (usedProblemIds.has(problem.id)) continue;

    const concept = conceptMap.get(bestConceptId);
    const state = topicStateMap.get(bestConceptId);
    
    const practiceItem: PracticeItem = {
      conceptId: bestConceptId,
      intent: "practice",
      score,
      reason: `practice problem: ${problem.name}`,
      problemId: problem.id,
      problemName: problem.name,
    };

    practiceItems.push(practiceItem);
    usedProblemIds.add(problem.id);
    usedConceptIds.add(bestConceptId);
  }

  return practiceItems;
}

/**
 * Get LLM prompt instructions for a specific intent.
 */
export function getIntentPromptInstructions(intent: FeedIntent, problemContext?: { problemId: string; problemName: string }): string {
  switch (intent) {
    case "reinforce":
      return `Intent: REINFORCE
- This concept has low stability. Generate a simpler question to strengthen memory.
- Avoid complex tradeoffs. Focus on core principle recognition.
- Make the question approachable but not trivial.`;

    case "recall":
      return `Intent: RECALL
- Test retrieval. No hints. Medium difficulty.
- Focus on whether the user remembers the key insight.
- Answers should be clear-cut, not ambiguous.`;

    case "build":
      return `Intent: BUILD
- User has mastered basics. Introduce a harder angle or system design implication.
- Can involve tradeoffs, edge cases, or real-world scenarios.
- Challenge the user to apply their knowledge.`;

    case "mix":
      return `Intent: MIX
- This is for variety. Generate an interesting question.
- Can be slightly unusual or cross-cutting.
- Keep it engaging but not too challenging.`;

    case "practice":
      return `Intent: PRACTICE PROBLEM
- This is a real staff-level interview problem: "${problemContext?.problemName ?? "System Design Problem"}"
- Generate an MCQ that tests a key design decision for this problem.
- The question should feel like it comes from a real system design interview.
- Focus on practical tradeoffs, not textbook definitions.
- Wrong options should represent common interview mistakes or misconceptions.
- Include realistic scenarios that a senior engineer would face.`;
  }
}

/**
 * Format a batch for LLM generation.
 * Returns a list of concepts with their intents and prompt instructions.
 */
export function formatBatchForLLM(batch: ComposedBatch, conceptMap: Map<string, ConceptV2>): string {
  // Format concept items
  const conceptInstructions = batch.items.map((item, index) => {
    const concept = conceptMap.get(item.conceptId);
    const conceptName = concept?.name ?? item.conceptId;
    return `${index + 1}. Concept: ${conceptName} (ID: ${item.conceptId})
${getIntentPromptInstructions(item.intent)}`;
  });

  // Format practice items
  const practiceInstructions = batch.practiceItems.map((item, index) => {
    const concept = conceptMap.get(item.conceptId);
    const conceptName = concept?.name ?? item.conceptId;
    const problemContext = { problemId: item.problemId, problemName: item.problemName };
    return `${batch.items.length + index + 1}. Practice Problem: ${item.problemName} (Problem ID: ${item.problemId})
   Focus Concept: ${conceptName} (ID: ${item.conceptId})
${getIntentPromptInstructions("practice", problemContext)}`;
  });

  return [...conceptInstructions, ...practiceInstructions].join("\n\n");
}
