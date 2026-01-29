/**
 * System Shots – LLM reel generation (MCQ only in V1).
 * Single non-streaming request + manual JSON parse so we avoid the slow two-call outputSchema path.
 */
import { chat } from "@tanstack/ai";
import { z } from "zod";
import { LivaAIModel } from "../ai/liva-ai-model";
import type { Reel, TopicStateRow } from "./types";
import type { ConceptV2 } from "./types";

const LOG_PREFIX = "[generateReelsBatch]";

const mcqReelSchema = z.object({
  conceptId: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
  explanation: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

const batchSchema = z.object({
  reels: z.array(mcqReelSchema),
});

/** Reel shape for persisting (id set by generator). */
export type GenerateReelInput = Omit<Reel, "createdAt" | "consumedAt">;

/** Strip markdown code fence and trim; return raw if no fence. */
function extractJsonString(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return match ? match[1].trim() : trimmed;
}

/**
 * Generate reels in one LLM call; returns array of reels with new UUIDs.
 * Uses a single non-streaming request then parses JSON (no outputSchema double-call).
 */
export async function generateReelsBatch(
  env: Env,
  topicState: TopicStateRow[],
  concepts: ConceptV2[],
  count: number
): Promise<GenerateReelInput[]> {
  if (concepts.length === 0) {
    console.warn(`${LOG_PREFIX} concepts.length=0, returning []`);
    return [];
  }

  const conceptIds = concepts.map((c) => c.id);
  const conceptNames = concepts.map((c) => c.name).join(", ");
  const stateSummary =
    topicState.length > 0
      ? topicState
          .map(
            (t) =>
              `concept ${t.conceptId}: exposure=${t.exposureCount} accuracy_ema=${t.accuracyEma.toFixed(2)} failure_streak=${t.failureStreak}`
          )
          .join("; ")
      : "No prior activity.";

  const userPrompt = `You are a senior system design interviewer at a top-tier tech company.

Your task is to generate interview-grade MCQ questions, not trivia.

You must obey all constraints strictly.

–––––––––––––––––
INPUT CONTEXT

Concepts (use only these conceptId values):
${conceptNames}

Concept IDs (use exactly as given):
${conceptIds.join(", ")}

User topic mastery state:
${stateSummary}

–––––––––––––––––
QUESTION QUALITY BAR

Every question must:
- Reflect a real system design interview decision point
- Involve tradeoffs, failure modes, or scaling behavior
- Avoid definition-based or memorization questions
- Be answerable without external facts
- Have exactly ONE clearly correct answer

Wrong options must be plausible and represent common interview mistakes.

Difficulty meanings:
1 = foundational reasoning
2 = applied design tradeoff
3 = deep system behavior or failure analysis

–––––––––––––––––
GENERATION RULES

Generate exactly ${count} MCQ questions.

For each question:
- Select one conceptId from the allowed list
- Focus on realistic system scenarios
- Prefer "why" and "what happens if" over "what is"

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
      "explanation": "brief explanation",
      "difficulty": 1
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
  return reels.map((r) => ({
    id: crypto.randomUUID(),
    conceptId: r.conceptId,
    type: "mcq" as const,
    prompt: r.prompt,
    options: r.options,
    correctIndex: r.correctIndex,
    explanation: r.explanation,
    difficulty: r.difficulty,
  }));
}
