/**
 * System Shots – LLM reel generation (MCQ only in V1).
 * Supports batch (non-streaming) and NDJSON streaming generation.
 * V2: Uses BatchComposer for intent-based generation with 4/3/2/1 distribution.
 * V3: Practice problems integration.
 * V4: Per-concept mastery level targeting with custom level expectations.
 */
import { chat } from "@tanstack/ai";
import { z } from "zod";
import { LivaAIModel } from "../ai/liva-ai-model";
import type { Reel, TopicStateRow, FeedIntent, MasteryLevel, LevelExpectation } from "./types";
import type { ConceptV2 } from "./types";
import { MASTERY_LEVELS } from "./types";
import { composeBatch, getIntentPromptInstructions, type ConceptSkipCounts, type PracticeItem } from "./batch-composer";
import { getMicroSignal } from "./intent-engine";
import { getTargetLevelExpectation } from "./concepts";
import { buildFocusModePromptExtension } from "./focus-prompt";

/** Generation options. */
export interface GenerationOptions {
  skipCounts?: ConceptSkipCounts;
  /** Recently used problem IDs to avoid repetition. */
  recentProblemIds?: string[];
  /** Mastery levels per concept for targeted generation (cost-efficient: only target level sent to LLM). */
  masteryLevels?: Map<string, MasteryLevel>;
  /** When set, generates content only for this concept (Focus Mode). */
  focusConceptId?: string;
  /** List of recently generated prompt texts to avoid repetition. */
  /** List of recently generated prompt texts to avoid repetition. */
  recentPrompts?: string[];
  /** Force bypass of KV cache (useful for retry loops). */
  bypassCache?: boolean;
}

import { CACHE_TTL_SECONDS, GENERATION_LOG_PREFIX } from "./constants";

const LOG_PREFIX = GENERATION_LOG_PREFIX;



/**
 * Build a cache key from the LLM prompt using SHA-256 hash.
 * Prefix with "llm:reels:" for namespace isolation.
 */
async function buildCacheKey(prompt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `llm:reels:${hashHex}`;
}

const reelSchema = z.object({
  conceptId: z.string(),
  type: z.string().optional(),
  prompt: z.string(),
  options: z.array(z.string()).min(1).max(6),
  correctIndex: z.number().min(-1).max(5),
  explanation: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  intent: z.string().optional(),
  problemId: z.string().optional(),
  orderingItems: z.array(z.string()).optional(),
});

const VALID_INTENTS = new Set(["reinforce", "recall", "build", "mix", "practice"]);
const VALID_TYPES = new Set([
  "mcq", "flash", "binary", "ordering", "free_text", "voice",
  "fill_blank", "spot_error", "this_or_that", "component_picker",
  "hot_take", "estimation", "interview_moment", "what_breaks",
  "incident", "label_diagram", "spot_spof", "progressive",
]);

/** Normalize LLM-provided intent (case-insensitive, fallback to undefined). */
function normalizeIntent(raw?: string): FeedIntent | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  return VALID_INTENTS.has(lower) ? (lower as FeedIntent) : undefined;
}

/** Normalize LLM-provided type (case-insensitive, fallback to undefined). */
function normalizeType(raw?: string): Reel["type"] | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  return VALID_TYPES.has(lower) ? (lower as Reel["type"]) : undefined;
}

const batchSchema = z.object({
  reels: z.array(reelSchema),
});

/** Reel shape for persisting (id set by generator). */
export type GenerateReelInput = Omit<Reel, "createdAt" | "consumedAt"> & {
  /** Micro-signal for UI display. */
  microSignal?: string | null;
};

/** Strip markdown code fence and trim; return raw if no fence. */
function extractJsonString(raw: string): string {
  const trimmed = raw.trim();
  // Skip pure fence lines (opening or closing) - including lines that start with ``` but have no JSON
  if (/^```(?:json)?\s*$/.test(trimmed) || trimmed === "```") return "";
  if (trimmed.startsWith("```") && !trimmed.includes("{")) return "";
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return match ? match[1].trim() : trimmed;
}

/**
 * Build level context for LLM prompt (cost-efficient: only target level sent).
 * Returns empty string if no mastery spec exists for the concept.
 */
function buildLevelContext(
  conceptId: string,
  currentLevel: MasteryLevel
): string {
  const targetSpec = getTargetLevelExpectation(conceptId, currentLevel);
  if (!targetSpec || targetSpec.mustDemonstrate.length === 0) return "";

  const targetLevel = Math.min(currentLevel + 1, 7) as MasteryLevel;
  const levelName = MASTERY_LEVELS[targetLevel].name;

  // Build concise context (cost-efficient)
  const mustDemo = targetSpec.mustDemonstrate.slice(0, 3).join("; ");
  const mistakes = targetSpec.commonMistakes.slice(0, 2).join("; ");

  let context = `\nTARGET: L${targetLevel} ${levelName}`;
  context += `\nTest: ${mustDemo}`;
  if (mistakes) {
    context += `\nExpose mistakes: ${mistakes}`;
  }

  return context;
}

/** Intent-specific generation instructions. */
interface ConceptWithIntentForPrompt {
  conceptId: string;
  conceptName: string;
  intent: FeedIntent;
  /** For practice intent, the problem context. */
  problemId?: string;
  problemName?: string;
  /** User's current mastery level for targeted generation. */
  masteryLevel?: MasteryLevel;
  /** Reel type to generate for this slot. */
  reelType?: Reel["type"];
}

/** Prompt instructions per reel type. */
function getReelTypeInstructions(reelType: Reel["type"]): string {
  switch (reelType) {
    case "binary":
      return `FORMAT: BINARY (True/False)
- Generate a statement that is either true or false.
- options: exactly 2 items ["True", "False"]
- correctIndex: 0 if True, 1 if False
- The statement must be non-obvious (not trivially answerable from definition).`;

    case "fill_blank":
      return `FORMAT: FILL-IN-THE-BLANK
- Write a sentence with one critical term replaced by "___".
- options: 3-4 plausible terms (word bank), one correct.
- correctIndex: index of the correct fill.
- The blank should test recall of a key concept, not a random word.`;

    case "spot_error":
      return `FORMAT: SPOT THE ERROR
- Write a 2-3 sentence system design statement with ONE subtle technical error.
- options: 3-4 descriptions of what could be wrong, one correct.
- correctIndex: index of the actual error.
- The error should be a common misconception, not a typo.`;

    case "this_or_that":
      return `FORMAT: THIS-OR-THAT (Tradeoff)
- Present a design scenario requiring a tradeoff between two approaches.
- options: exactly 2 items (the two approaches).
- correctIndex: -1 (no single correct answer — both are valid depending on context).
- explanation: discuss BOTH sides of the tradeoff, when each is preferred.`;

    case "component_picker":
      return `FORMAT: COMPONENT PICKER
- Describe specific requirements (throughput, consistency, latency, etc.).
- options: 4 real technologies or components.
- correctIndex: the best fit for the stated requirements.
- Wrong options must be plausible but suboptimal for the specific requirements.`;

    case "hot_take":
      return `FORMAT: HOT TAKE
- Present a provocative engineering opinion (e.g., "Microservices are always overkill for startups").
- options: exactly 3 items ["Agree", "Disagree", "It depends"]
- correctIndex: typically 2 ("It depends"), but can be 0 or 1 if the statement is clearly true/false.
- explanation: give the nuanced take regardless of correct answer.`;

    case "estimation":
      return `FORMAT: BACK-OF-ENVELOPE ESTIMATION
- Present a concrete scenario with numbers (DAU, payload size, etc.).
- Ask to estimate QPS, storage, bandwidth, or similar.
- options: 3-4 order-of-magnitude choices (e.g., "~100", "~10K", "~1M").
- correctIndex: the reasonable estimate.
- explanation: show the math.`;

    case "interview_moment":
      return `FORMAT: INTERVIEW MOMENT
- Frame as: "The interviewer asks: '...'"
- Present a situation that could arise in a real system design interview.
- options: 4 different approaches or responses.
- correctIndex: the best approach.
- Wrong options represent common interview mistakes.`;

    case "what_breaks":
      return `FORMAT: WHAT BREAKS? (Failure Injection)
- Describe a simple architecture (3-4 components).
- Specify a failure: "The [component] goes down."
- options: 4 possible consequences.
- correctIndex: the most accurate consequence.
- Tests failure-mode awareness.`;

    case "incident":
      return `FORMAT: INCIDENT RESPONSE
- Present a production alert with metrics (latency spike, error rate, etc.).
- Include relevant dashboard data.
- options: 4 possible root causes or next debugging steps.
- correctIndex: the most likely cause given the data.
- Tests operational thinking.`;

    case "ordering":
      return `FORMAT: ORDERING
- Instead of "options" + "correctIndex", provide an "orderingItems" array.
- The items should be steps of a process/protocol IN THE CORRECT ORDER.
- options: set to the same items in correct order.
- correctIndex: 0 (unused, client shuffles).
- The client will shuffle these and ask the user to reorder them.`;

    case "label_diagram":
      return `FORMAT: LABEL THE ARCHITECTURE
- In the prompt, describe a system architecture with 3-5 components. Name each component clearly.
- Blank out ONE component name in the description (replace with "???").
- options: 4 possible names for the blanked component.
- correctIndex: index of the correct component name.
- Tests whether user knows what each component does in context.`;

    case "spot_spof":
      return `FORMAT: SPOT THE SINGLE POINT OF FAILURE
- In the prompt, describe a system architecture with 4-5 components and their connections.
- One component is a single point of failure (not replicated, no failover).
- options: the 4-5 component names.
- correctIndex: index of the SPOF component.
- Tests failure-mode awareness.`;

    case "progressive":
      return `FORMAT: PROGRESSIVE DESIGN
- Frame as building a system step-by-step.
- The question should be one step in a larger design process.
- options: 4 design choices for this step.
- correctIndex: 0-3.
- Make the question work standalone even without prior steps.`;

    case "free_text":
      return `FORMAT: FREE TEXT EXPLANATION
- Ask an open-ended question requiring a 2-3 sentence explanation.
- Do NOT provide options or correctIndex.
- options: ["placeholder"] (single item array)
- correctIndex: -1
- The explanation field should contain the model answer.`;

    case "voice":
      return `FORMAT: VOICE EXPLANATION
- Ask a question that requires verbal explanation (like in a real interview).
- Frame it conversationally: "Explain...", "Walk me through...", "How would you describe..."
- options: ["placeholder"] (single item array)
- correctIndex: -1
- The explanation field should contain the model answer.`;

    default:
      return `FORMAT: MCQ (4 options, one correct)
- Standard multiple-choice question.
- options: exactly 4 items.
- correctIndex: 0-3.`;
  }
}

/** NDJSON-only prompt: one JSON object per line, no markdown, no outer array. */
function buildNDJSONPrompt(
  conceptsWithIntents: ConceptWithIntentForPrompt[],
  stateSummary: string,
  count: number,
  focusExtension?: string,
  recentPrompts?: string[]
): string {
  const conceptInstructions = conceptsWithIntents
    .map((c, i) => {
      const problemContext = c.intent === "practice" && c.problemId && c.problemName
        ? { problemId: c.problemId, problemName: c.problemName }
        : undefined;
      const intentInstructions = getIntentPromptInstructions(c.intent, problemContext);
      const typeInstructions = getReelTypeInstructions(c.reelType ?? "mcq");

      const levelContext = c.masteryLevel !== undefined
        ? buildLevelContext(c.conceptId, c.masteryLevel)
        : "";

      if (c.intent === "practice" && c.problemName) {
        return `${i + 1}. Practice Problem: ${c.problemName} (Problem ID: ${c.problemId})
   Focus Concept: ${c.conceptName} (ID: ${c.conceptId})
   Type: ${c.reelType ?? "mcq"}
${intentInstructions}
${typeInstructions}${levelContext}`;
      }

      return `${i + 1}. Concept: ${c.conceptName} (ID: ${c.conceptId})
   Type: ${c.reelType ?? "mcq"}
${intentInstructions}
${typeInstructions}${levelContext}`;
    })
    .join("\n\n");

  const hasPractice = conceptsWithIntents.some(c => c.intent === "practice");
  const practiceNote = hasPractice
    ? "\n- For PRACTICE problems, also include 'problemId' with the exact problem ID specified"
    : "";
  const hasOrdering = conceptsWithIntents.some(c => c.reelType === "ordering");
  const orderingNote = hasOrdering
    ? '\n- For ORDERING type, include "orderingItems" (array of steps in correct order) and set options to the same array, correctIndex to 0'
    : "";

  let diversityContext = "";
  if (recentPrompts && recentPrompts.length > 0) {
    const recent = recentPrompts.slice(-10).map((p) => `- "${p.slice(0, 100)}..."`).join("\n");
    diversityContext = `
––––––––––––––––
DIVERSITY CONSTRAINTS – CRITICAL
The user has recently seen the following questions.
You MUST NOT generate similar questions.
You MUST choose a DIFFERENT sub-topic or angle.
RECENTLY SEEN:
${recent}`;
  }

  return `You are a senior system design interviewer at a top-tier tech company.

Your task is to generate interview-grade questions in VARIED formats. Each question specifies its TYPE — follow the format instructions exactly. You must obey all constraints strictly.

OUTPUT FORMAT – CRITICAL: You MUST output only NDJSON (newline-delimited JSON).
- Exactly one valid JSON object per line.
- No markdown, no code fences, no outer array, no extra text before or after.
- Each line must be a complete, valid JSON object with these keys: conceptId, type, prompt, options, correctIndex, explanation, difficulty, intent${hasPractice ? ", problemId (for practice)" : ""}${hasOrdering ? ", orderingItems (for ordering)" : ""}.

TYPE-SPECIFIC RULES:
- MCQ: options has exactly 4 items, correctIndex 0-3
- BINARY: options has exactly 2 items, correctIndex 0 or 1
- FILL_BLANK: prompt contains "___", options has 3-4 word-bank items
- SPOT_ERROR: prompt is a statement with an error, options describe possible errors
- THIS_OR_THAT: options has exactly 2 items, correctIndex is -1 (no correct answer)
- COMPONENT_PICKER: options has 4 real technologies, correctIndex 0-3
- HOT_TAKE: options is ["Agree","Disagree","It depends"], correctIndex 0-2
- ESTIMATION: options has 3-4 magnitude choices, correctIndex points to reasonable one
- INTERVIEW_MOMENT: prompt starts with "The interviewer asks:", options has 4 approaches
- WHAT_BREAKS: prompt describes architecture + failure, options has 4 consequences
- INCIDENT: prompt describes production alert with metrics, options has 4 diagnoses
- ORDERING: include orderingItems (steps in correct order), options same as orderingItems
- LABEL_DIAGRAM: prompt describes architecture with "???" for blanked component, options has 4 names
- SPOT_SPOF: prompt describes architecture, options has component names, correctIndex points to SPOF
- PROGRESSIVE: progressive design step, options has 4 design choices
- FREE_TEXT: open-ended explanation, options is ["placeholder"], correctIndex is -1
- VOICE: verbal explanation prompt, options is ["placeholder"], correctIndex is -1

Example (you will output ${count} lines):
{"conceptId":"cap-theorem","type":"binary","prompt":"In a distributed system, partition tolerance is optional if all nodes are in the same data center.","options":["True","False"],"correctIndex":1,"explanation":"Partition tolerance is never optional in distributed systems...","difficulty":1,"intent":"reinforce"}
{"conceptId":"sharding","type":"interview_moment","prompt":"The interviewer asks: 'Your database is hitting 50K writes/sec and latency is climbing. What's your first move?'","options":["Add read replicas","Shard by user ID","Add a write-through cache","Vertical scale the DB"],"correctIndex":1,"explanation":"...","difficulty":2,"intent":"practice","problemId":"twitter"}

–––––––––––––––––
INPUT CONTEXT

User topic mastery state:
${stateSummary}

–––––––––––––––––
CONCEPTS TO GENERATE (with types and intents)

Generate exactly one question for each concept below, following the specified type and intent:

${conceptInstructions}
${diversityContext}

–––––––––––––––––
RULES

Generate exactly ${count} questions. One JSON object per line. No other output.
- conceptId: use EXACTLY the concept ID specified
- type: use EXACTLY the type specified for each question
- prompt: question text (follow both the type format and intent instructions)
- options: array of strings (length depends on type — see TYPE-SPECIFIC RULES above)
- correctIndex: index of correct option (or -1 for this_or_that)
- explanation: brief explanation
- difficulty: 1, 2, or 3 (1=foundational, 2=applied tradeoff, 3=deep/failure)
- intent: the intent specified, ALWAYS lowercase (reinforce, recall, build, mix, or practice)
- type: ALWAYS lowercase with underscores (e.g. mcq, binary, what_breaks, interview_moment)${practiceNote}${orderingNote}
${focusExtension ? `\n${focusExtension}` : ""}
Output ${count} lines now, one JSON object per line, in the same order as the concepts above:`;
}

/**
 * Async generator: stream NDJSON from LLM, parse each line, validate, assign UUID, yield reel.
 * Uses chat(stream: true); accumulates by newlines; yields reels as they are parsed.
 * V2: Uses BatchComposer for intent-based generation.
 * V3: Practice problems integration.
 * V4: Per-concept mastery level targeting with custom level expectations.
 */
export async function* generateReelsStream(
  env: Env,
  topicState: TopicStateRow[],
  concepts: ConceptV2[],
  count: number,
  options: GenerationOptions = {}
): AsyncGenerator<GenerateReelInput> {
  const { skipCounts = {}, recentProblemIds = [], masteryLevels = new Map(), focusConceptId, recentPrompts = [], bypassCache = false } = options;

  let filteredConcepts = concepts;
  if (focusConceptId) {
    filteredConcepts = concepts.filter(c => c.id === focusConceptId);
    console.log(`${LOG_PREFIX} Focus Mode active for concept=${focusConceptId}`);
  }

  if (filteredConcepts.length === 0) {
    console.warn(`${LOG_PREFIX} stream concepts.length=0${focusConceptId ? ` (focus: ${focusConceptId} not found)` : ""}`);
    return;
  }

  // Use batch composer to determine intents
  const batch = composeBatch(topicState, filteredConcepts, skipCounts, count, {
    recentProblemIds,
  });
  console.log(`${LOG_PREFIX} batch composed: medianStability=${batch.medianStability.toFixed(2)}, buildBlocked=${batch.buildBlocked}, slots=${JSON.stringify(batch.slotFillInfo)}, practiceItems=${batch.practiceItems.length}`);

  // Build concept map for name lookup
  const conceptMap = new Map(filteredConcepts.map((c) => [c.id, c]));

  // Build concepts with intents for prompt (including practice items, mastery levels, and reel types)
  const conceptsWithIntents: ConceptWithIntentForPrompt[] = [
    ...batch.items.map((item) => ({
      conceptId: item.conceptId,
      conceptName: conceptMap.get(item.conceptId)?.name ?? item.conceptId,
      intent: item.intent,
      masteryLevel: masteryLevels.get(item.conceptId),
      reelType: item.reelType,
    })),
    ...batch.practiceItems.map((item) => ({
      conceptId: item.conceptId,
      conceptName: conceptMap.get(item.conceptId)?.name ?? item.conceptId,
      intent: item.intent as FeedIntent,
      problemId: item.problemId,
      problemName: item.problemName,
      masteryLevel: masteryLevels.get(item.conceptId),
      reelType: item.reelType,
    })),
  ];

  // Build intent map, type map, and problem map for later lookup
  const intentMap = new Map<string, FeedIntent>();
  const typeMap = new Map<string, Reel["type"]>();
  const problemMap = new Map<string, { problemId: string; problemName: string }>();

  for (const item of batch.items) {
    intentMap.set(item.conceptId, item.intent);
    if (item.reelType) typeMap.set(item.conceptId, item.reelType);
  }
  for (const item of batch.practiceItems) {
    intentMap.set(`${item.conceptId}:${item.problemId}`, item.intent);
    problemMap.set(item.conceptId, { problemId: item.problemId, problemName: item.problemName });
    if (item.reelType) typeMap.set(`${item.conceptId}:${item.problemId}`, item.reelType);
  }

  const stateSummary =
    topicState.length > 0
      ? topicState
        .map(
          (t) =>
            `concept ${t.conceptId}: exposure=${t.exposureCount} accuracy_ema=${t.accuracyEma.toFixed(2)} failure_streak=${t.failureStreak} stability=${t.stabilityScore.toFixed(2)}`
        )
        .join("; ")
      : "No prior activity.";

  const focusExtension = focusConceptId ? buildFocusModePromptExtension(focusConceptId) : undefined;

  const totalCount = batch.items.length + batch.practiceItems.length;
  const userPrompt = buildNDJSONPrompt(conceptsWithIntents, stateSummary, totalCount, focusExtension, recentPrompts);

  // Check KV cache first (unless bypassed)
  const cacheKey = await buildCacheKey(userPrompt);
  if (!bypassCache) {
    try {
      const cached = await env.LLM_CACHE?.get(cacheKey, "json");
      if (cached && Array.isArray(cached) && cached.length > 0) {
        console.log(`${LOG_PREFIX} cache HIT key=${cacheKey.slice(0, 30)}... reels=${cached.length}`);
        for (const reel of cached as GenerateReelInput[]) {
          // Generate new IDs for cached reels to avoid duplicates
          yield { ...reel, id: crypto.randomUUID() };
        }
        return;
      }
    } catch (cacheErr) {
      // Cache read error - treat as miss and proceed with LLM
      console.warn(`${LOG_PREFIX} cache read error, proceeding with LLM`, cacheErr);
    }
  } else {
    console.log(`${LOG_PREFIX} cache BYPASS key=${cacheKey.slice(0, 30)}...`);
  }

  if (!bypassCache) {
    console.log(`${LOG_PREFIX} cache MISS key=${cacheKey.slice(0, 30)}...`);
  }

  // Accumulator for caching successful results

  // Accumulator for caching successful results
  const accumulatedReels: GenerateReelInput[] = [];

  let stream: AsyncIterable<{ type: string; delta?: string; content?: string }>;
  try {
    const adapter = await new LivaAIModel(env).getAdapter();
    console.log(`${LOG_PREFIX} stream start concepts=${concepts.length} count=${count} temperature=0.7`);
    const result = chat({
      adapter,
      messages: [{ role: "user", content: userPrompt }],
      // Higher temperature for variety
      temperature: 0.7,
      stream: true,
    }) as AsyncIterable<{ type: string; delta?: string; content?: string }>;
    stream = result;
  } catch (err) {
    console.error(`${LOG_PREFIX} stream chat failed`, err);
    return;
  }

  let buffer = "";
  let yielded = 0;

  try {
    for await (const chunk of stream) {
      if (chunk.type !== "content") continue;
      const text = (chunk as { delta?: string; content?: string }).delta ?? (chunk as { content?: string }).content ?? "";
      if (!text) continue;

      console.log(`${LOG_PREFIX} raw chunk (${text.length} chars): ${text.slice(0, 50).replace(/\n/g, "\\n")}...`);
      buffer += text;

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Strip markdown code fence (```json ... ```) if LLM wrapped the output
        const jsonStr = extractJsonString(trimmed);
        if (!jsonStr) continue; // skip fence-only lines
        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          // Only warn for lines that look like JSON (start with {) - avoid noise from fence fragments
          if (jsonStr.startsWith("{")) {
            console.warn(`${LOG_PREFIX} stream skip invalid JSON line: ${trimmed.slice(0, 80)}...`);
          }
          continue;
        }
        const parsedReel = reelSchema.safeParse(parsed);
        if (!parsedReel.success) {
          console.warn(`${LOG_PREFIX} stream schema validation failed for line`, parsedReel.error.flatten());
          continue;
        }
        const r = parsedReel.data;
        const lookupKey = r.problemId ? `${r.conceptId}:${r.problemId}` : r.conceptId;
        const resolvedType = normalizeType(r.type) ?? typeMap.get(lookupKey) ?? typeMap.get(r.conceptId) ?? "mcq";
        const normalizedIntent = normalizeIntent(r.intent);
        console.log(`${LOG_PREFIX} valid reel parsed: ${r.conceptId} [${normalizedIntent ?? r.intent}] type=${resolvedType}`);
        const intent = intentMap.get(lookupKey) ?? intentMap.get(r.conceptId) ?? normalizedIntent ?? "reinforce";
        const state = topicState.find((t) => t.conceptId === r.conceptId);
        const skipCount = skipCounts[r.conceptId] ?? 0;
        const problem = problemMap.get(r.conceptId);
        const microSignal = getMicroSignal(intent, skipCount, state?.exposureCount ?? 0, problem?.problemName);

        const reel: GenerateReelInput = {
          id: crypto.randomUUID(),
          conceptId: r.conceptId,
          type: resolvedType,
          prompt: r.prompt,
          options: r.options,
          correctIndex: r.correctIndex,
          explanation: r.explanation,
          difficulty: r.difficulty,
          intent,
          skipCount: 0,
          microSignal,
          problemId: r.problemId ?? problem?.problemId ?? null,
          metadata: r.orderingItems ? { kind: "ordering" as const, items: r.orderingItems } : null,
        };
        accumulatedReels.push(reel);
        yielded++;
        yield reel;
        if (yielded >= totalCount) {
          console.log(`${LOG_PREFIX} stream done yielded=${yielded}`);
          return;
        }
      }
    }

    // last line in buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(extractJsonString(buffer.trim()));
        const parsedReel = reelSchema.safeParse(parsed);
        if (parsedReel.success && yielded < totalCount) {
          const r = parsedReel.data;
          const lookupKey = r.problemId ? `${r.conceptId}:${r.problemId}` : r.conceptId;
          const resolvedType = normalizeType(r.type) ?? typeMap.get(lookupKey) ?? typeMap.get(r.conceptId) ?? "mcq";
          const intent = intentMap.get(lookupKey) ?? intentMap.get(r.conceptId) ?? normalizeIntent(r.intent) ?? "reinforce";
          const state = topicState.find((t) => t.conceptId === r.conceptId);
          const skipCount = skipCounts[r.conceptId] ?? 0;
          const problem = problemMap.get(r.conceptId);
          const microSignal = getMicroSignal(intent, skipCount, state?.exposureCount ?? 0, problem?.problemName);

          const lastReel: GenerateReelInput = {
            id: crypto.randomUUID(),
            conceptId: r.conceptId,
            type: resolvedType,
            prompt: r.prompt,
            options: r.options,
            correctIndex: r.correctIndex,
            explanation: r.explanation,
            difficulty: r.difficulty,
            intent,
            skipCount: 0,
            microSignal,
            problemId: r.problemId ?? problem?.problemId ?? null,
            metadata: r.orderingItems ? { kind: "ordering" as const, items: r.orderingItems } : null,
          };
          accumulatedReels.push(lastReel);
          yield lastReel;
        }
      } catch {
        // ignore
      }
    }
    console.log(`${LOG_PREFIX} stream end yielded=${yielded}`);
  } catch (err) {
    console.error(`${LOG_PREFIX} stream iteration error`, err);
  } finally {
    // Always write to cache when generator exits (normal completion, break, or error)
    // This ensures cache is populated even when consumer breaks early
    if (accumulatedReels.length > 0) {
      console.log(`${LOG_PREFIX} cache write (finally) reels=${accumulatedReels.length}`);
      env.LLM_CACHE?.put(cacheKey, JSON.stringify(accumulatedReels), {
        expirationTtl: CACHE_TTL_SECONDS,
      }).catch((err: unknown) => console.error(`${LOG_PREFIX} cache write failed`, err));
    }
  }
}

/**
 * Generate reels in one LLM call; returns array of reels with new UUIDs.
 * Uses a single non-streaming request then parses JSON (no outputSchema double-call).
 * V2: Uses BatchComposer for intent-based generation.
 * V3: Practice problems integration.
 * V4: Per-concept mastery level targeting with custom level expectations.
 */
export async function generateReelsBatch(
  env: Env,
  topicState: TopicStateRow[],
  concepts: ConceptV2[],
  count: number,
  options: GenerationOptions = {}
): Promise<GenerateReelInput[]> {
  const { skipCounts = {}, recentProblemIds = [], masteryLevels = new Map(), focusConceptId, recentPrompts = [] } = options;

  let filteredConcepts = concepts;
  if (focusConceptId) {
    filteredConcepts = concepts.filter(c => c.id === focusConceptId);
    console.log(`${LOG_PREFIX} Focus Mode (batch) active for concept=${focusConceptId}`);
  }

  if (filteredConcepts.length === 0) {
    console.warn(`${LOG_PREFIX} concepts.length=0${focusConceptId ? ` (focus: ${focusConceptId} not found)` : ""}, returning []`);
    return [];
  }

  // Use batch composer to determine intents
  const batch = composeBatch(topicState, filteredConcepts, skipCounts, count, {
    recentProblemIds,
  });
  console.log(`${LOG_PREFIX} batch composed: medianStability=${batch.medianStability.toFixed(2)}, buildBlocked=${batch.buildBlocked}, slots=${JSON.stringify(batch.slotFillInfo)}, practiceItems=${batch.practiceItems.length}`);

  // Build concept map for name lookup
  const conceptMap = new Map(filteredConcepts.map((c) => [c.id, c]));

  // Build concepts with intents for prompt (including practice items, mastery levels, and reel types)
  const conceptsWithIntents: ConceptWithIntentForPrompt[] = [
    ...batch.items.map((item) => ({
      conceptId: item.conceptId,
      conceptName: conceptMap.get(item.conceptId)?.name ?? item.conceptId,
      intent: item.intent,
      masteryLevel: masteryLevels.get(item.conceptId),
      reelType: item.reelType,
    })),
    ...batch.practiceItems.map((item) => ({
      conceptId: item.conceptId,
      conceptName: conceptMap.get(item.conceptId)?.name ?? item.conceptId,
      intent: item.intent as FeedIntent,
      problemId: item.problemId,
      problemName: item.problemName,
      masteryLevel: masteryLevels.get(item.conceptId),
      reelType: item.reelType,
    })),
  ];

  // Build intent map, type map, and problem map for later lookup
  const intentMap = new Map<string, FeedIntent>();
  const typeMap = new Map<string, Reel["type"]>();
  const problemMap = new Map<string, { problemId: string; problemName: string }>();

  for (const item of batch.items) {
    intentMap.set(item.conceptId, item.intent);
    if (item.reelType) typeMap.set(item.conceptId, item.reelType);
  }
  for (const item of batch.practiceItems) {
    intentMap.set(`${item.conceptId}:${item.problemId}`, item.intent);
    problemMap.set(item.conceptId, { problemId: item.problemId, problemName: item.problemName });
    if (item.reelType) typeMap.set(`${item.conceptId}:${item.problemId}`, item.reelType);
  }

  const stateSummary =
    topicState.length > 0
      ? topicState
        .map(
          (t) =>
            `concept ${t.conceptId}: exposure=${t.exposureCount} accuracy_ema=${t.accuracyEma.toFixed(2)} failure_streak=${t.failureStreak} stability=${t.stabilityScore.toFixed(2)}`
        )
        .join("; ")
      : "No prior activity.";

  const totalCount = batch.items.length + batch.practiceItems.length;
  const focusExtension = focusConceptId ? buildFocusModePromptExtension(focusConceptId) : undefined;
  const userPrompt = buildNDJSONPrompt(conceptsWithIntents, stateSummary, totalCount, focusExtension, recentPrompts);

  let rawText: string;
  try {
    const adapter = await new LivaAIModel(env).getAdapter();
    console.log(`${LOG_PREFIX} single request start concepts=${concepts.length} count=${count}`);
    rawText = (await chat({
      adapter,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.7,
      stream: false,
    })) as string;
  } catch (err) {
    console.error(`${LOG_PREFIX} chat failed`, err);
    return [];
  }

  if (!rawText || typeof rawText !== "string") {
    console.error(`${LOG_PREFIX} empty or non-string response length=${rawText?.length ?? 0}`);
    return [];
  }

  // The batch prompt now uses NDJSON format (same as streaming). Parse each line.
  const results: GenerateReelInput[] = [];
  const lines = rawText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const jsonStr = extractJsonString(trimmed);
    if (!jsonStr) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (jsonStr.startsWith("{")) {
        console.warn(`${LOG_PREFIX} batch skip invalid JSON line: ${trimmed.slice(0, 80)}...`);
      }
      continue;
    }
    const parsedReel = reelSchema.safeParse(parsed);
    if (!parsedReel.success) {
      console.warn(`${LOG_PREFIX} batch schema validation failed`, parsedReel.error.flatten());
      continue;
    }
    const r = parsedReel.data;
    const lookupKey = r.problemId ? `${r.conceptId}:${r.problemId}` : r.conceptId;
    const resolvedType = normalizeType(r.type) ?? typeMap.get(lookupKey) ?? typeMap.get(r.conceptId) ?? "mcq";
    const intent = intentMap.get(lookupKey) ?? intentMap.get(r.conceptId) ?? normalizeIntent(r.intent) ?? "reinforce";
    const state = topicState.find((t) => t.conceptId === r.conceptId);
    const skipCount = skipCounts[r.conceptId] ?? 0;
    const problem = problemMap.get(r.conceptId);
    const microSignal = getMicroSignal(intent, skipCount, state?.exposureCount ?? 0, problem?.problemName);

    results.push({
      id: crypto.randomUUID(),
      conceptId: r.conceptId,
      type: resolvedType,
      prompt: r.prompt,
      options: r.options,
      correctIndex: r.correctIndex,
      explanation: r.explanation,
      difficulty: r.difficulty,
      intent,
      skipCount: 0,
      microSignal,
      problemId: r.problemId ?? problem?.problemId ?? null,
      metadata: r.orderingItems ? { kind: "ordering" as const, items: r.orderingItems } : null,
    });
  }

  if (results.length === 0) {
    console.warn(`${LOG_PREFIX} no reels parsed from batch response`);
  } else {
    console.log(`${LOG_PREFIX} success reels=${results.length}`);
  }
  return results;
}
