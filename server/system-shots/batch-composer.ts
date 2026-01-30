/**
 * Batch Composer - Enforces 4/3/2/1 intent distribution for feed batches.
 * 
 * For every 10-reel batch:
 * - 4 Reinforce (strengthen weak memory)
 * - 3 Recall (spaced retrieval testing)
 * - 2 Build (new angles on mastered concepts)
 * - 1 Mix (adjacent concept for variety)
 */

import type { FeedIntent, TopicStateRow, ConceptV2 } from "./types";
import {
  buildConceptIntentInput,
  assignIntentAndScore,
  type ConceptWithIntent,
  type ConceptIntentInput,
} from "./intent-engine";

/** Target distribution for a 10-reel batch. */
export const BATCH_SLOTS = {
  reinforce: 4,
  recall: 3,
  build: 2,
  mix: 1,
} as const;

/** Total batch size (sum of all slots). */
export const BATCH_SIZE = 10;

/** Median stability threshold below which new concepts are blocked. */
export const MEDIAN_STABILITY_THRESHOLD = 0.55;

/** Result of batch composition. */
export interface ComposedBatch {
  /** Concepts with assigned intents, ordered by priority. */
  items: ConceptWithIntent[];
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
 * Enforces 4/3/2/1 distribution and respects median stability threshold.
 */
export function composeBatch(
  topicStates: TopicStateRow[],
  concepts: ConceptV2[],
  skipCounts: ConceptSkipCounts = {},
  batchSize: number = BATCH_SIZE
): ComposedBatch {
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
    return assignIntentAndScore(input);
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

  // Calculate scaled slot counts for the requested batch size
  const scale = batchSize / BATCH_SIZE;
  const targetSlots: Record<FeedIntent, number> = {
    reinforce: Math.round(BATCH_SLOTS.reinforce * scale),
    recall: Math.round(BATCH_SLOTS.recall * scale),
    build: buildBlocked ? 0 : Math.round(BATCH_SLOTS.build * scale),
    mix: Math.round(BATCH_SLOTS.mix * scale),
  };

  // If build is blocked, redistribute slots to reinforce and recall
  if (buildBlocked) {
    const buildSlots = Math.round(BATCH_SLOTS.build * scale);
    targetSlots.reinforce += Math.ceil(buildSlots / 2);
    targetSlots.recall += Math.floor(buildSlots / 2);
  }

  // Ensure total matches batch size
  const totalSlots = Object.values(targetSlots).reduce((a, b) => a + b, 0);
  if (totalSlots < batchSize) {
    targetSlots.reinforce += batchSize - totalSlots;
  }

  // Sort concepts by score (descending) within each intent bucket
  const buckets: Record<FeedIntent, ConceptWithIntent[]> = {
    reinforce: [],
    recall: [],
    build: [],
    mix: [],
  };

  for (const item of scoredConcepts) {
    buckets[item.intent].push(item);
  }

  for (const intent of Object.keys(buckets) as FeedIntent[]) {
    buckets[intent].sort((a, b) => b.score - a.score);
  }

  // Fill slots from each bucket
  const result: ConceptWithIntent[] = [];
  const usedConceptIds = new Set<string>();
  const slotFillInfo: Record<FeedIntent, number> = { reinforce: 0, recall: 0, build: 0, mix: 0 };

  // Fill in order: reinforce, recall, build, mix
  const fillOrder: FeedIntent[] = ["reinforce", "recall", "build", "mix"];
  
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

  // If we still need more items, fill from any remaining concepts
  if (result.length < batchSize) {
    const remaining = scoredConcepts
      .filter((item) => !usedConceptIds.has(item.conceptId))
      .sort((a, b) => b.score - a.score);
    
    for (const item of remaining) {
      if (result.length >= batchSize) break;
      result.push(item);
      usedConceptIds.add(item.conceptId);
    }
  }

  // Final sort by score for the entire batch
  result.sort((a, b) => b.score - a.score);

  return {
    items: result.slice(0, batchSize),
    buildBlocked,
    medianStability,
    slotFillInfo,
  };
}

/**
 * Get LLM prompt instructions for a specific intent.
 */
export function getIntentPromptInstructions(intent: FeedIntent): string {
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
  }
}

/**
 * Format a batch for LLM generation.
 * Returns a list of concepts with their intents and prompt instructions.
 */
export function formatBatchForLLM(batch: ComposedBatch, conceptMap: Map<string, ConceptV2>): string {
  return batch.items
    .map((item, index) => {
      const concept = conceptMap.get(item.conceptId);
      const conceptName = concept?.name ?? item.conceptId;
      return `${index + 1}. Concept: ${conceptName} (ID: ${item.conceptId})
${getIntentPromptInstructions(item.intent)}`;
    })
    .join("\n\n");
}
