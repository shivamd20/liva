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
import { getMicroSignal, getMasteryLevelPromptModifier } from "./intent-engine";
import { getTargetLevelExpectation } from "./concepts";

/** Generation options. */
export interface GenerationOptions {
  skipCounts?: ConceptSkipCounts;
  /** Recently used problem IDs to avoid repetition. */
  recentProblemIds?: string[];
  /** Recently generated prompts to avoid repetition (exact text or close semantic match). */
  recentPrompts?: string[];
  /** Mastery levels per concept for targeted generation (cost-efficient: only target level sent to LLM). */
  masteryLevels?: Map<string, MasteryLevel>;
}

const LOG_PREFIX = "[generateReels]";

/** Cache TTL: 7 days in seconds. */
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 604800

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

const mcqReelSchema = z.object({
  conceptId: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
  // Force model to output reasoning before answer to improve accuracy (Chain of Thought)
  reasoning: z.string().optional(),
  explanation: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  intent: z.enum(["reinforce", "recall", "build", "mix", "practice"]).optional(),
  problemId: z.string().optional(),
});

const batchSchema = z.object({
  reels: z.array(mcqReelSchema),
});

/** Reel shape for persisting (id set by generator). */
export type GenerateReelInput = Omit<Reel, "createdAt" | "consumedAt"> & {
  /** Micro-signal for UI display. */
  microSignal?: string | null;
};

/** Strip markdown code fence and trim; return raw if no fence. */
function extractJsonString(raw: string): string {
  const trimmed = raw.trim();
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
  const styleGuide = getMasteryLevelPromptModifier(currentLevel);

  let context = `\nTARGET: L${targetLevel} ${levelName}`;
  context += `\nStyle: ${styleGuide}`;
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
}

/** NDJSON-only prompt: one JSON object per line, no markdown, no outer array. */
function buildNDJSONPrompt(
  conceptsWithIntents: ConceptWithIntentForPrompt[],
  stateSummary: string,
  count: number
): string {
  const conceptInstructions = conceptsWithIntents
    .map((c, i) => {
      const problemContext = c.intent === "practice" && c.problemId && c.problemName
        ? { problemId: c.problemId, problemName: c.problemName }
        : undefined;
      const intentInstructions = getIntentPromptInstructions(c.intent, problemContext);

      // Add level context if mastery level is known (cost-efficient: only target level)
      const levelContext = c.masteryLevel !== undefined
        ? buildLevelContext(c.conceptId, c.masteryLevel)
        : "";

      if (c.intent === "practice" && c.problemName) {
        return `${i + 1}. Practice Problem: ${c.problemName} (Problem ID: ${c.problemId})
   Focus Concept: ${c.conceptName} (ID: ${c.conceptId})
${intentInstructions}${levelContext}`;
      }

      return `${i + 1}. Concept: ${c.conceptName} (ID: ${c.conceptId})
${intentInstructions}${levelContext}`;
    })
    .join("\n\n");

  const hasPractice = conceptsWithIntents.some(c => c.intent === "practice");
  const practiceNote = hasPractice
    ? "\n- For PRACTICE problems, also include 'problemId' with the exact problem ID specified"
    : "";

  return `You are a senior system design interviewer at a top-tier tech company (L6+).
Your goal is to probe for deep understanding, not surface-level definitions.

Your task is to generate UNIQUE, HIGH-NOVELTY, interview-grade MCQ questions.
REPETITION IS A FAILURE. Do not use the same scenarios or phrasing as recent questions.

OUTPUT FORMAT – CRITICAL: You MUST output only NDJSON (newline-delimited JSON).
- Exactly one valid JSON object per line.
- No markdown, no code fences, no outer array, no extra text before or after.
- Each line must be a complete, valid JSON object with these exact keys: conceptId, prompt, options, correctIndex, reasoning, explanation, difficulty, intent${hasPractice ? ", problemId (for practice)" : ""}.

Example of exactly two lines (you will output ${count} lines):
{"conceptId":"cap-theorem","prompt":"Why might a CP system choose to allow stale reads?","options":["A","B","C","D"],"correctIndex":0,"reasoning":"Reasoning steps...","explanation":"...","difficulty":1,"intent":"reinforce"}
{"conceptId":"sharding","prompt":"When designing Twitter, which shard key minimizes hot partitions for tweets?","options":["A","B","C","D"],"correctIndex":1,"reasoning":"Reasoning steps...","explanation":"...","difficulty":2,"intent":"practice","problemId":"twitter"}

–––––––––––––––––
INPUT CONTEXT

User topic mastery state:
${stateSummary}

–––––––––––––––––
CONCEPTS TO GENERATE (with intents)

Generate exactly one question for each concept below, following the specified intent:

${conceptInstructions}

–––––––––––––––––
RULES

1. NOVELTY: Vary your scenarios. Use "war stories", specific failure modes (e.g. "thundering herd", "split brain"), or subtle bugs. Avoid dry textbook definitions.
2. ACCURACY: Think before you generate options. Use the 'reasoning' field to derive the correct answer first.
3. DIFFICULTY:
   - Level 1: Foundational (What is X?)
   - Level 2: Tradeoff (When to use X over Y?)
   - Level 3: Failure/Debug (X broke, why? How to fix?)

Generate exactly ${count} MCQ questions. One JSON object per line. No other output.
- conceptId: use EXACTLY the concept ID specified for each question
- prompt: question text (follow the intent instructions above)
- options: exactly 4 strings
- correctIndex: 0-3
- reasoning: internal thought process to ensure accuracy (required)
- explanation: brief explanation for the user
- difficulty: 1, 2, or 3
- intent: the intent specified for this concept${practiceNote}

Output ${count} lines now, one JSON object per line, in the same order as the concepts above:`;
}

/** Legacy prompt builder for backwards compatibility. */
function buildLegacyNDJSONPrompt(
  conceptIds: string[],
  conceptNames: string,
  stateSummary: string,
  count: number
): string {
  return `You are a senior system design interviewer at a top-tier tech company.

Your task is to generate interview-grade MCQ questions, not trivia. You must obey all constraints strictly.

OUTPUT FORMAT – CRITICAL: You MUST output only NDJSON (newline-delimited JSON).
- Exactly one valid JSON object per line.
- No markdown, no code fences, no outer array, no extra text before or after.
- Each line must be a complete, valid JSON object with these exact keys: conceptId, prompt, options, correctIndex, explanation, difficulty.

Example of exactly two lines (you will output ${count} lines):
{"conceptId":"cap-theorem","prompt":"Why might a CP system choose to allow stale reads?","options":["A","B","C","D"],"correctIndex":0,"explanation":"...","difficulty":1}
{"conceptId":"sharding","prompt":"How do you pick a shard key?","options":["A","B","C","D"],"correctIndex":1,"explanation":"...","difficulty":2}

–––––––––––––––––
INPUT CONTEXT

Concepts (use only these conceptId values):
${conceptNames}

Concept IDs (use exactly as given):
${conceptIds.join(", ")}

User topic mastery state:
${stateSummary}

–––––––––––––––––
RULES

Generate exactly ${count} MCQ questions. One JSON object per line. No other output.
- conceptId: one of the IDs above
- prompt: question text
- options: exactly 4 strings
- correctIndex: 0-3
- explanation: brief explanation
- difficulty: 1, 2, or 3 (1=foundational, 2=applied tradeoff, 3=deep/failure)

Output ${count} lines now, one JSON object per line:`;
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
  const { skipCounts = {}, recentProblemIds = [], recentPrompts = [], masteryLevels = new Map() } = options;

  if (concepts.length === 0) {
    console.warn(`${LOG_PREFIX} stream concepts.length=0`);
    return;
  }

  // Use batch composer to determine intents
  const batch = composeBatch(topicState, concepts, skipCounts, count, {
    recentProblemIds,
  });
  console.log(`${LOG_PREFIX} batch composed: medianStability=${batch.medianStability.toFixed(2)}, buildBlocked=${batch.buildBlocked}, slots=${JSON.stringify(batch.slotFillInfo)}, practiceItems=${batch.practiceItems.length}`);

  // Build concept map for name lookup
  const conceptMap = new Map(concepts.map((c) => [c.id, c]));

  // Build concepts with intents for prompt (including practice items and mastery levels)
  const conceptsWithIntents: ConceptWithIntentForPrompt[] = [
    ...batch.items.map((item) => ({
      conceptId: item.conceptId,
      conceptName: conceptMap.get(item.conceptId)?.name ?? item.conceptId,
      intent: item.intent,
      masteryLevel: masteryLevels.get(item.conceptId),
    })),
    ...batch.practiceItems.map((item) => ({
      conceptId: item.conceptId,
      conceptName: conceptMap.get(item.conceptId)?.name ?? item.conceptId,
      intent: item.intent as FeedIntent,
      problemId: item.problemId,
      problemName: item.problemName,
      masteryLevel: masteryLevels.get(item.conceptId),
    })),
  ];

  // Build intent map and problem map for later lookup
  const intentMap = new Map<string, FeedIntent>();
  const problemMap = new Map<string, { problemId: string; problemName: string }>();

  for (const item of batch.items) {
    intentMap.set(item.conceptId, item.intent);
  }
  for (const item of batch.practiceItems) {
    intentMap.set(`${item.conceptId}:${item.problemId}`, item.intent);
    problemMap.set(item.conceptId, { problemId: item.problemId, problemName: item.problemName });
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
  const userPrompt = buildNDJSONPrompt(conceptsWithIntents, stateSummary, totalCount);

  // Check KV cache first
  const cacheKey = await buildCacheKey(userPrompt);
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
  console.log(`${LOG_PREFIX} cache MISS key=${cacheKey.slice(0, 30)}...`);

  // Accumulator for caching successful results
  const accumulatedReels: GenerateReelInput[] = [];

  let stream: AsyncIterable<{ type: string; delta?: string; content?: string }>;
  try {
    const adapter = await new LivaAIModel(env).getAdapter();
    console.log(`${LOG_PREFIX} stream start concepts=${concepts.length} count=${count}`);
    const result = chat({
      adapter,
      messages: [{ role: "user", content: userPrompt }],
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
      buffer += text;

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          console.warn(`${LOG_PREFIX} stream skip invalid JSON line: ${trimmed.slice(0, 80)}...`);
          continue;
        }
        const parsedReel = mcqReelSchema.safeParse(parsed);
        if (!parsedReel.success) {
          console.warn(`${LOG_PREFIX} stream schema validation failed for line`, parsedReel.error.flatten());
          continue;
        }
        const r = parsedReel.data;
        // Use intent from batch composer (fallback to LLM-provided or reinforce)
        const lookupKey = r.problemId ? `${r.conceptId}:${r.problemId}` : r.conceptId;
        const intent = intentMap.get(lookupKey) ?? intentMap.get(r.conceptId) ?? r.intent ?? "reinforce";
        const state = topicState.find((t) => t.conceptId === r.conceptId);
        const skipCount = skipCounts[r.conceptId] ?? 0;
        const problem = problemMap.get(r.conceptId);
        const microSignal = getMicroSignal(intent, skipCount, state?.exposureCount ?? 0, problem?.problemName);

        const reel: GenerateReelInput = {
          id: crypto.randomUUID(),
          conceptId: r.conceptId,
          type: "mcq",
          prompt: r.prompt,
          options: r.options,
          correctIndex: r.correctIndex,
          explanation: r.explanation,
          difficulty: r.difficulty,
          intent,
          skipCount: 0,
          microSignal,
          problemId: r.problemId ?? problem?.problemId ?? null,
          reasoning: r.reasoning,
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
        const parsed = JSON.parse(buffer.trim());
        const parsedReel = mcqReelSchema.safeParse(parsed);
        if (parsedReel.success && yielded < totalCount) {
          const r = parsedReel.data;
          const lookupKey = r.problemId ? `${r.conceptId}:${r.problemId}` : r.conceptId;
          const intent = intentMap.get(lookupKey) ?? intentMap.get(r.conceptId) ?? r.intent ?? "reinforce";
          const state = topicState.find((t) => t.conceptId === r.conceptId);
          const skipCount = skipCounts[r.conceptId] ?? 0;
          const problem = problemMap.get(r.conceptId);
          const microSignal = getMicroSignal(intent, skipCount, state?.exposureCount ?? 0, problem?.problemName);

          const lastReel: GenerateReelInput = {
            id: crypto.randomUUID(),
            conceptId: r.conceptId,
            type: "mcq",
            prompt: r.prompt,
            options: r.options,
            correctIndex: r.correctIndex,
            explanation: r.explanation,
            difficulty: r.difficulty,
            intent,
            skipCount: 0,
            microSignal,
            problemId: r.problemId ?? problem?.problemId ?? null,
            reasoning: r.reasoning,
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
  const { skipCounts = {}, recentProblemIds = [], recentPrompts = [], masteryLevels = new Map() } = options;

  if (concepts.length === 0) {
    console.warn(`${LOG_PREFIX} concepts.length=0, returning []`);
    return [];
  }

  // Use batch composer to determine intents
  const batch = composeBatch(topicState, concepts, skipCounts, count, {
    recentProblemIds,
  });
  console.log(`${LOG_PREFIX} batch composed: medianStability=${batch.medianStability.toFixed(2)}, buildBlocked=${batch.buildBlocked}, slots=${JSON.stringify(batch.slotFillInfo)}, practiceItems=${batch.practiceItems.length}`);

  // Build concept map for name lookup
  const conceptMap = new Map(concepts.map((c) => [c.id, c]));

  // Build concepts with intents for prompt (including practice items and mastery levels)
  const conceptsWithIntents: ConceptWithIntentForPrompt[] = [
    ...batch.items.map((item) => ({
      conceptId: item.conceptId,
      conceptName: conceptMap.get(item.conceptId)?.name ?? item.conceptId,
      intent: item.intent,
      masteryLevel: masteryLevels.get(item.conceptId),
    })),
    ...batch.practiceItems.map((item) => ({
      conceptId: item.conceptId,
      conceptName: conceptMap.get(item.conceptId)?.name ?? item.conceptId,
      intent: item.intent as FeedIntent,
      problemId: item.problemId,
      problemName: item.problemName,
      masteryLevel: masteryLevels.get(item.conceptId),
    })),
  ];

  // Build intent map and problem map for later lookup
  const intentMap = new Map<string, FeedIntent>();
  const problemMap = new Map<string, { problemId: string; problemName: string }>();

  for (const item of batch.items) {
    intentMap.set(item.conceptId, item.intent);
  }
  for (const item of batch.practiceItems) {
    intentMap.set(`${item.conceptId}:${item.problemId}`, item.intent);
    problemMap.set(item.conceptId, { problemId: item.problemId, problemName: item.problemName });
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

  // Build prompt with intent instructions (including practice problems and level context)
  const conceptInstructions = conceptsWithIntents
    .map((c, i) => {
      const problemContext = c.intent === "practice" && c.problemId && c.problemName
        ? { problemId: c.problemId, problemName: c.problemName }
        : undefined;
      const intentInstructions = getIntentPromptInstructions(c.intent, problemContext);

      // Add level context if mastery level is known (cost-efficient: only target level)
      const levelContext = c.masteryLevel !== undefined
        ? buildLevelContext(c.conceptId, c.masteryLevel)
        : "";

      if (c.intent === "practice" && c.problemName) {
        return `${i + 1}. Practice Problem: ${c.problemName} (Problem ID: ${c.problemId})
   Focus Concept: ${c.conceptName} (ID: ${c.conceptId})
${intentInstructions}${levelContext}`;
      }

      return `${i + 1}. Concept: ${c.conceptName} (ID: ${c.conceptId})
${intentInstructions}${levelContext}`;
    })
    .join("\n\n");

  const hasPractice = conceptsWithIntents.some(c => c.intent === "practice");
  const practiceNote = hasPractice
    ? ',\n      "problemId": "<problem ID for practice questions>"'
    : "";

  const recentContext = recentPrompts.length > 0
    ? `\nRECENTLY GENERATED (DO NOT REPEAT):\n${recentPrompts.slice(0, 50).map(p => `- ${p.slice(0, 100)}...`).join("\n")}\n`
    : "";

  const userPrompt = `You are a senior system design interviewer at a top-tier tech company (L6+).
Your goal is to probe for deep understanding, not surface-level definitions.

Your task is to generate UNIQUE, HIGH-NOVELTY, interview-grade MCQ questions.
REPETITION IS A FAILURE. Do not use the same scenarios or phrasing as recent questions.

You must obey all constraints strictly.

–––––––––––––––––
INPUT CONTEXT

User topic mastery state:
${stateSummary}
${recentContext}
–––––––––––––––––
CONCEPTS TO GENERATE (with intents)

Generate exactly one question for each concept below, following the specified intent:

${conceptInstructions}

–––––––––––––––––
QUESTION QUALITY BAR

Every question must:
- Reflect a real system design interview decision point
- Follow the intent instructions for each concept
- Avoid definition-based or memorization questions
- Be answerable without external facts
- Have exactly ONE clearly correct answer

Wrong options must be plausible and represent common interview mistakes.

Difficulty meanings:
1 = foundational reasoning
2 = applied design tradeoff
3 = deep system behavior or failure analysis

Create novel scenarios. Do not reuse generic examples.

–––––––––––––––––
OUTPUT FORMAT

Respond with ONLY valid JSON, no markdown and no other text. Exact shape:

{
  "reels": [
    {
      "conceptId": "<one of the concept IDs above>",
      "prompt": "question text",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "reasoning": "Reasoning steps...",
      "explanation": "brief explanation",
      "difficulty": 1,
      "intent": "reinforce"${practiceNote}
    }
  ]
}`;

  let rawText: string;
  try {
    const adapter = await new LivaAIModel(env).getAdapter();
    console.log(`${LOG_PREFIX} single request start concepts=${concepts.length} count=${count}`);
    rawText = (await chat({
      adapter,
      messages: [{ role: "user", content: userPrompt }],
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

  const jsonStr = extractJsonString(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error(
      `${LOG_PREFIX} JSON parse failed`,
      parseErr instanceof Error ? parseErr.message : parseErr,
      "sample:",
      jsonStr.slice(0, 300)
    );
    return [];
  }

  const parsedBatch = batchSchema.safeParse(parsed);
  if (!parsedBatch.success) {
    console.error(
      `${LOG_PREFIX} schema validation failed`,
      parsedBatch.error.flatten(),
      "raw keys:",
      typeof parsed === "object" && parsed !== null ? Object.keys(parsed as object) : []
    );
    return [];
  }

  const reels = parsedBatch.data.reels;
  if (!reels || reels.length === 0) {
    console.warn(`${LOG_PREFIX} reels array empty after parse`);
    return [];
  }

  console.log(`${LOG_PREFIX} success reels=${reels.length}`);
  return reels.map((r) => {
    // Use intent from batch composer (fallback to LLM-provided or reinforce)
    const lookupKey = r.problemId ? `${r.conceptId}:${r.problemId}` : r.conceptId;
    const intent = intentMap.get(lookupKey) ?? intentMap.get(r.conceptId) ?? r.intent ?? "reinforce";
    const state = topicState.find((t) => t.conceptId === r.conceptId);
    const skipCount = skipCounts[r.conceptId] ?? 0;
    const problem = problemMap.get(r.conceptId);
    const microSignal = getMicroSignal(intent, skipCount, state?.exposureCount ?? 0, problem?.problemName);

    return {
      id: crypto.randomUUID(),
      conceptId: r.conceptId,
      type: "mcq" as const,
      prompt: r.prompt,
      options: r.options,
      correctIndex: r.correctIndex,
      explanation: r.explanation,
      difficulty: r.difficulty,
      intent,
      skipCount: 0,
      microSignal,
      problemId: r.problemId ?? problem?.problemId ?? null,
      reasoning: r.reasoning,
    };
  });
}
