import { DurableObject } from "cloudflare:workers";
import { toServerSentEventsStream } from "@tanstack/ai";
import type { Reel, TopicStateRow, ProgressResponse, ProgressItem, Mastery, MasteryLevel } from "../system-shots/types";
import type { AnswerSubmittedPayload, ReelGeneratedPayload, ReelShownPayload } from "../system-shots/types";
import type { ConceptV2 } from "../system-shots/types";
import { getConceptSeedRows, CONCEPT_V2 } from "../system-shots/concepts";
import { getMicroSignal, deriveMasteryLevel } from "../system-shots/intent-engine";

/** Number of recent problem IDs to track to avoid repetition. */
const RECENT_PROBLEMS_LIMIT = 15;

/** Cooldown period before skipped reels reappear in feed (3 days). */
const SKIP_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const ACCURACY_EMA_ALPHA = 0.2;
const LOG_PREFIX = "[LearningMemoryDO]";

export class LearningMemoryDO extends DurableObject<Env> {
  state: DurableObjectState;
  sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.state = ctx;
    this.sql = ctx.storage.sql;
    this.initializeTables();
    this.seedConcepts();
  }

  private initializeTables(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS concepts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        difficulty_tier INTEGER
      );
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS topic_state (
        concept_id TEXT PRIMARY KEY,
        exposure_count INTEGER NOT NULL DEFAULT 0,
        accuracy_ema REAL NOT NULL DEFAULT 0.5,
        failure_streak INTEGER NOT NULL DEFAULT 0,
        last_at INTEGER NOT NULL DEFAULT 0,
        stability_score REAL NOT NULL DEFAULT 0
      );
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS reels (
        id TEXT PRIMARY KEY,
        concept_id TEXT NOT NULL,
        type TEXT NOT NULL,
        prompt TEXT NOT NULL,
        options TEXT,
        correct_index INTEGER,
        explanation TEXT NOT NULL,
        difficulty INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        consumed_at INTEGER,
        skipped_at INTEGER,
        intent TEXT,
        skip_count INTEGER NOT NULL DEFAULT 0
      );
    `);
    this.ensureReelsSkippedAtColumn();
    this.ensureNewColumns();
  }

  /** Add skipped_at to reels if missing (migration for existing DOs). */
  private ensureReelsSkippedAtColumn(): void {
    const info = this.sql.exec("PRAGMA table_info(reels)").toArray() as { name: string }[];
    if (info.some((r) => r.name === "skipped_at")) return;
    this.sql.exec("ALTER TABLE reels ADD COLUMN skipped_at INTEGER");
  }

  /** Add new columns for Feed Intent system (migration for existing DOs). */
  private ensureNewColumns(): void {
    // Check and add stability_score to topic_state
    const topicStateInfo = this.sql.exec("PRAGMA table_info(topic_state)").toArray() as { name: string }[];
    if (!topicStateInfo.some((r) => r.name === "stability_score")) {
      this.sql.exec("ALTER TABLE topic_state ADD COLUMN stability_score REAL NOT NULL DEFAULT 0");
      // Backfill stability scores for existing rows
      this.backfillStabilityScores();
    }

    // Check and add intent, skip_count, and problem_id to reels
    const reelsInfo = this.sql.exec("PRAGMA table_info(reels)").toArray() as { name: string }[];
    if (!reelsInfo.some((r) => r.name === "intent")) {
      this.sql.exec("ALTER TABLE reels ADD COLUMN intent TEXT");
    }
    if (!reelsInfo.some((r) => r.name === "skip_count")) {
      this.sql.exec("ALTER TABLE reels ADD COLUMN skip_count INTEGER NOT NULL DEFAULT 0");
    }
    // V4: Add problem_id for practice problems
    if (!reelsInfo.some((r) => r.name === "problem_id")) {
      this.sql.exec("ALTER TABLE reels ADD COLUMN problem_id TEXT");
    }
  }

  /** Backfill stability scores for existing topic_state rows. */
  private backfillStabilityScores(): void {
    const rows = this.sql
      .exec("SELECT concept_id, exposure_count, accuracy_ema, failure_streak FROM topic_state")
      .toArray() as { concept_id: string; exposure_count: number; accuracy_ema: number; failure_streak: number }[];

    for (const row of rows) {
      const stability = this.computeStabilityScore(
        row.exposure_count,
        row.accuracy_ema,
        row.failure_streak,
        1 // default difficulty
      );
      this.sql.exec(
        "UPDATE topic_state SET stability_score = ? WHERE concept_id = ?",
        stability,
        row.concept_id
      );
    }
    console.log(`${LOG_PREFIX} backfilled stability_score for ${rows.length} concepts`);
  }

  /** Compute stability score: measures how well a concept is learned.
   * Formula: clamp(accuracyEma * log(exposureCount + 1) / (difficulty + failureStreak + 1), 0, 1)
   */
  private computeStabilityScore(
    exposureCount: number,
    accuracyEma: number,
    failureStreak: number,
    difficulty: number
  ): number {
    const raw = (accuracyEma * Math.log(exposureCount + 1)) / (difficulty + failureStreak + 1);
    return Math.max(0, Math.min(1, raw));
  }

  private seedConcepts(): void {
    const count = this.sql.exec("SELECT COUNT(*) as c FROM concepts").one() as { c: number };
    if (count.c > 0) return;
    const rows = getConceptSeedRows();
    for (const c of rows) {
      this.sql.exec(
        "INSERT INTO concepts (id, name, difficulty_tier) VALUES (?, ?, ?)",
        c.id,
        c.name,
        c.difficultyTier
      );
    }
  }

  private rowToReel(row: Record<string, unknown>): Reel {
    return {
      id: row.id as string,
      conceptId: row.concept_id as string,
      type: row.type as Reel["type"],
      prompt: row.prompt as string,
      options: row.options != null ? (JSON.parse(row.options as string) as string[]) : null,
      correctIndex: row.correct_index != null ? (row.correct_index as number) : null,
      explanation: row.explanation as string,
      difficulty: row.difficulty as number,
      createdAt: row.created_at as number,
      consumedAt: (row.consumed_at as number) ?? null,
      intent: (row.intent as Reel["intent"]) ?? null,
      skipCount: (row.skip_count as number) ?? 0,
      problemId: (row.problem_id as string) ?? null,
    };
  }

  /** Enrich a reel with computed micro signal based on topic state. */
  private enrichReelWithMicroSignal(reel: Reel, topicStateMap: Map<string, TopicStateRow>): Reel {
    const state = topicStateMap.get(reel.conceptId);
    const exposureCount = state?.exposureCount ?? 0;
    const microSignal = getMicroSignal(
      reel.intent ?? "reinforce",
      reel.skipCount ?? 0,
      exposureCount
    );
    return { ...reel, microSignal };
  }

  /** Append answer_submitted event, set consumed_at, update topic_state. */
  async submitAnswer(
    reelId: string,
    selectedIndex: number | null,
    correct: boolean,
    skipped?: boolean
  ): Promise<void> {
    console.log(`${LOG_PREFIX} submitAnswer reelId=${reelId} selectedIndex=${selectedIndex} correct=${correct} skipped=${skipped ?? false}`);

    const rows = this.sql
      .exec("SELECT concept_id, consumed_at FROM reels WHERE id = ?", reelId)
      .toArray() as { concept_id: string; consumed_at: number | null }[];
    const reelRow = rows[0];
    if (!reelRow) {
      console.log(`${LOG_PREFIX} submitAnswer reel not found (mock id), no-op`);
      return;
    }
    if (reelRow.consumed_at != null) {
      console.log(`${LOG_PREFIX} submitAnswer reel already consumed, idempotent no-op`);
      return; // already answered; avoid duplicate events and topic_state updates
    }

    const conceptId = reelRow.concept_id;
    const timestamp = Date.now();

    this.recordEvent<AnswerSubmittedPayload>("answer_submitted", {
      reelId,
      conceptId,
      selectedIndex,
      correct,
      skipped,
      timestamp,
    });

    if (skipped) {
      // Replay skipped reels: record skip but do not consume; they stay in the feed and are prioritized.
      // Increment skip_count to factor into scoring (higher skip = higher priority to resurface).
      this.sql.exec(
        "UPDATE reels SET skipped_at = ?, skip_count = skip_count + 1 WHERE id = ?",
        timestamp,
        reelId
      );
    } else {
      // Answer: consume reel, clear skipped_at, and reset skip_count so scroll-back-and-answer removes skip state.
      this.sql.exec(
        "UPDATE reels SET consumed_at = ?, skipped_at = NULL, skip_count = 0 WHERE id = ?",
        timestamp,
        reelId
      );
      this.updateTopicState(conceptId, correct, timestamp);
    }
    console.log(`${LOG_PREFIX} submitAnswer done reelId=${reelId} conceptId=${conceptId} skipped=${skipped ?? false}`);
  }

  private updateTopicState(conceptId: string, correct: boolean, timestamp: number): void {
    const rows = this.sql
      .exec("SELECT * FROM topic_state WHERE concept_id = ?", conceptId)
      .toArray() as { exposure_count: number; accuracy_ema: number; failure_streak: number }[];
    const row = rows[0];

    const exposureCount = (row?.exposure_count ?? 0) + 1;
    const prevEma = row?.accuracy_ema ?? 0.5;
    const accuracyEma =
      ACCURACY_EMA_ALPHA * (correct ? 1 : 0) + (1 - ACCURACY_EMA_ALPHA) * prevEma;
    const failureStreak = correct ? 0 : (row?.failure_streak ?? 0) + 1;

    // Get concept difficulty from ConceptV2 canon
    const concept = CONCEPT_V2.find((c) => c.id === conceptId);
    const difficulty = this.difficultyHintToNumber(concept?.difficulty_hint);

    // Compute stability score
    const stabilityScore = this.computeStabilityScore(exposureCount, accuracyEma, failureStreak, difficulty);

    this.sql.exec(
      `INSERT INTO topic_state (concept_id, exposure_count, accuracy_ema, failure_streak, last_at, stability_score)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(concept_id) DO UPDATE SET
         exposure_count = excluded.exposure_count,
         accuracy_ema = excluded.accuracy_ema,
         failure_streak = excluded.failure_streak,
         last_at = excluded.last_at,
         stability_score = excluded.stability_score`,
      conceptId,
      exposureCount,
      accuracyEma,
      failureStreak,
      timestamp,
      stabilityScore
    );
  }

  /** Generic event recorder. */
  private recordEvent<T>(eventType: string, payload: T): void {
    const eventId = crypto.randomUUID();
    this.sql.exec(
      "INSERT INTO events (id, event_type, payload, created_at) VALUES (?, ?, ?, ?)",
      eventId,
      eventType,
      JSON.stringify(payload),
      Date.now()
    );
  }

  /** Record a reel_shown event (called from client via tRPC). */
  recordReelShown(reelId: string): void {
    const rows = this.sql
      .exec("SELECT concept_id FROM reels WHERE id = ?", reelId)
      .toArray() as { concept_id: string }[];
    const row = rows[0];
    if (!row) return;

    this.recordEvent<ReelShownPayload>("reel_shown", {
      reelId,
      conceptId: row.concept_id,
      shownAt: Date.now(),
    });
  }

  /** Convert difficulty_hint to numeric value for stability calculation. */
  private difficultyHintToNumber(hint?: "intro" | "core" | "advanced"): number {
    switch (hint) {
      case "intro": return 1;
      case "core": return 2;
      case "advanced": return 3;
      default: return 2; // default to core
    }
  }

  /**
   * Find existing reel with same content (concept_id, prompt, options, correct_index).
   * Used to avoid storing duplicate reels from LLM generation.
   * Returns { reel, skippedAt } so caller can avoid yielding recently skipped reels.
   */
  private findExistingReelByContent(
    conceptId: string,
    prompt: string,
    options: string[] | null,
    correctIndex: number | null
  ): { reel: Reel; skippedAt: number | null } | null {
    const optionsJson = options != null ? JSON.stringify(options) : null;
    const rows = this.sql
      .exec(
        `SELECT * FROM reels WHERE concept_id = ? AND prompt = ?
         AND (options = ? OR (options IS NULL AND ? IS NULL))
         AND (correct_index = ? OR (correct_index IS NULL AND ? IS NULL))
         AND consumed_at IS NULL LIMIT 1`,
        conceptId,
        prompt,
        optionsJson,
        optionsJson,
        correctIndex,
        correctIndex
      )
      .toArray() as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return null;
    const reel = this.rowToReel(row);
    const skippedAt = row.skipped_at as number | null;
    return { reel, skippedAt };
  }

  /**
   * Persist a reel or return existing if duplicate content.
   * Prevents storing identical reels (same prompt, options, correct_index) from LLM.
   * Returns { reel, shouldYield } - shouldYield is false if existing reel was skipped in last 3 days.
   */
  private persistOrGetReel(
    r: Omit<Reel, "createdAt" | "consumedAt">,
    reappearanceThreshold: number
  ): { reel: Reel; shouldYield: boolean } {
    const existing = this.findExistingReelByContent(
      r.conceptId,
      r.prompt,
      r.options,
      r.correctIndex
    );
    if (existing) {
      const { reel, skippedAt } = existing;
      const skippedRecently = skippedAt != null && skippedAt > reappearanceThreshold;
      console.log(`${LOG_PREFIX} persistOrGetReel duplicate, using existing id=${reel.id} skippedRecently=${skippedRecently}`);
      return {
        reel: { ...reel, createdAt: reel.createdAt ?? Date.now(), consumedAt: null },
        shouldYield: !skippedRecently,
      };
    }
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO reels (id, concept_id, type, prompt, options, correct_index, explanation, difficulty, created_at, consumed_at, intent, skip_count, problem_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      r.id,
      r.conceptId,
      r.type,
      r.prompt,
      r.options != null ? JSON.stringify(r.options) : null,
      r.correctIndex ?? null,
      r.explanation,
      r.difficulty,
      now,
      r.intent ?? null,
      r.skipCount ?? 0,
      r.problemId ?? null
    );
    return { reel: { ...r, createdAt: now, consumedAt: null }, shouldYield: true };
  }

  /**
   * Async generator: yield reels for SSE. No cursor = initial stream (ensure buffer, stream up to 10).
   * With cursor = next page (reels after cursor, up to 10). Yields StreamChunk-like objects for toServerSentEventsStream.
   * Does not cancel generation if client disconnects.
   * @param cursor - Optional cursor for pagination
   * @param options - Optional streaming options including Focus Mode
   */
  /**
   * Async generator: yield fresh reels for SSE.
   * STRICTLY generates fresh content via LLM on every call.
   * Completely bypasses DB for retrieval (DB is write-only for history).
   * @param cursor - Ignored for logic (fresh generation always), but maintained for API compatibility.
   * @param options - Optional streaming options including Focus Mode
   */
  async *streamReels(
    cursor: string | undefined, // Ignored, always fresh
    options: { focusConceptId?: string; excludeIds?: string[] } = {}
  ): AsyncGenerator<{ type: string; delta?: string; content?: string; finishReason?: string | null }> {
    const { focusConceptId, excludeIds = [] } = options;
    const reappearanceThreshold = Date.now() - SKIP_COOLDOWN_MS;
    const excludeSet = new Set(excludeIds);

    console.log(`${LOG_PREFIX} streamReels FRESH GENERATION START focus=${focusConceptId ?? "none"}`);

    // Helper to chunk reel for SSE
    const toChunk = (reel: Reel) => {
      // Re-enrich to be safe, though generation enriches them too
      const topicStateMap = new Map(
        this.getTopicStateForGeneration().map((t) => [t.conceptId, t])
      );
      const enrichedReel = this.enrichReelWithMicroSignal(reel, topicStateMap);
      return {
        type: "content" as const,
        delta: JSON.stringify(enrichedReel),
        content: JSON.stringify(enrichedReel),
      };
    };

    // Gather context for mostly-fresh generation
    const topicState = this.getTopicStateForGeneration();
    const concepts = this.getConceptsList();
    const skipCounts = this.getSkipCountsPerConcept();
    const recentProblemIds = this.getRecentProblemIds();
    const masteryLevels = this.getMasteryLevelsMap();
    const recentPrompts = this.getRecentPrompts(10); // Negative prompting context

    // Always import generator
    const { generateReelsStream } = await import("../system-shots/generate");

    // We aim for 10 fresh reels
    const TARGET_COUNT = 10;
    let yielded = 0;
    let attempts = 0;

    // Retry loop to ensure we get enough reels even if duplicates are generated
    while (yielded < TARGET_COUNT && attempts < 3) {
      attempts++;
      const remaining = TARGET_COUNT - yielded;
      console.log(`${LOG_PREFIX} streamReels generation attempt ${attempts} needed=${remaining}`);

      // Bypass cache on retries to ensure we don't get stuck with the same cached response
      const bypassCache = attempts > 1;

      try {
        for await (const reel of generateReelsStream(this.env, topicState, concepts, remaining, {
          skipCounts,
          recentProblemIds,
          masteryLevels,
          recentPrompts,
          focusConceptId,
          bypassCache
        })) {
          // Persist to DB for history (and to catch duplicates via existing check)
          // We don't care about 'shouldYield' based on skip history anymore per requirements
          // BUT we still want to deduplicate against exact same content to avoid showing users precise duplicates
          const { reel: persisted, shouldYield } = this.persistOrGetReel(reel, reappearanceThreshold);

          if (excludeSet.has(persisted.id)) {
            console.log(`${LOG_PREFIX} skipping excluded/seen reel ${persisted.id}`);
            continue;
          }

          this.recordEvent<ReelGeneratedPayload>("reel_generated", {
            reelId: persisted.id,
            conceptId: persisted.conceptId,
            type: persisted.type,
            createdAt: persisted.createdAt ?? Date.now(),
          });

          yield toChunk(persisted);
          yielded++;

          if (yielded >= TARGET_COUNT) break;
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} streamReels generation error`, err);
      }
    }

    console.log(`${LOG_PREFIX} streamReels DONE yielded=${yielded}`);
    yield { type: "done", finishReason: "stop" };
  }

  private getTopicStateForGeneration(): TopicStateRow[] {
    const rows = this.sql
      .exec("SELECT concept_id, exposure_count, accuracy_ema, failure_streak, last_at, stability_score FROM topic_state")
      .toArray() as { concept_id: string; exposure_count: number; accuracy_ema: number; failure_streak: number; last_at: number; stability_score: number }[];
    return rows.map((r) => ({
      conceptId: r.concept_id,
      exposureCount: r.exposure_count,
      accuracyEma: r.accuracy_ema,
      failureStreak: r.failure_streak,
      lastAt: r.last_at,
      stabilityScore: r.stability_score,
    }));
  }

  /** Get aggregate skip counts per concept from reels. */
  private getSkipCountsPerConcept(): Record<string, number> {
    const rows = this.sql
      .exec("SELECT concept_id, SUM(skip_count) as total_skips FROM reels WHERE skip_count > 0 GROUP BY concept_id")
      .toArray() as { concept_id: string; total_skips: number }[];
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.concept_id] = row.total_skips;
    }
    return result;
  }

  /** Get recently used prompts to avoid repetition. */
  getRecentPrompts(limit: number = 10): string[] {
    const rows = this.sql
      .exec(
        "SELECT prompt FROM reels ORDER BY created_at DESC LIMIT ?",
        limit
      )
      .toArray() as { prompt: string }[];
    return rows.map((r) => r.prompt);
  }

  /** Get recently used problem IDs to avoid repetition. */
  getRecentProblemIds(limit: number = RECENT_PROBLEMS_LIMIT): string[] {
    const rows = this.sql
      .exec(
        "SELECT DISTINCT problem_id FROM reels WHERE problem_id IS NOT NULL ORDER BY created_at DESC LIMIT ?",
        limit
      )
      .toArray() as { problem_id: string }[];
    return rows.map((r) => r.problem_id);
  }

  /** Get mastery levels for all concepts (for targeted LLM generation). */
  getMasteryLevelsMap(): Map<string, MasteryLevel> {
    const rows = this.sql
      .exec(
        "SELECT concept_id, exposure_count, accuracy_ema, failure_streak, stability_score FROM topic_state"
      )
      .toArray() as {
        concept_id: string;
        exposure_count: number;
        accuracy_ema: number;
        failure_streak: number;
        stability_score: number;
      }[];

    const map = new Map<string, MasteryLevel>();
    for (const r of rows) {
      const level = deriveMasteryLevel(r.exposure_count, r.accuracy_ema, r.failure_streak, r.stability_score);
      map.set(r.concept_id, level);
    }
    return map;
  }

  /** Concepts for generation: full ConceptV2 from canon, filtered by IDs present in DB. */
  private getConceptsList(): ConceptV2[] {
    const rows = this.sql.exec("SELECT id FROM concepts").toArray() as { id: string }[];
    const ids = new Set(rows.map((r) => r.id));
    return CONCEPT_V2.filter((c) => ids.has(c.id));
  }

  /** Derive mastery from topic state. */
  private deriveMastery(
    exposureCount: number,
    accuracyEma: number,
    failureStreak: number
  ): Mastery {
    if (exposureCount === 0) return "unknown";
    const weak = accuracyEma < 0.5 || failureStreak >= 2;
    const solid = exposureCount >= 3 && accuracyEma >= 0.7 && failureStreak < 2;
    if (solid) return "solid";
    if (weak) return "weak";
    return "learning";
  }

  /** Progress for UI: all concepts with topic state (left-joined), derived mastery, and v2 metadata from canon. */
  async getProgress(): Promise<ProgressResponse> {
    const rows = this.sql
      .exec(
        `SELECT c.id AS concept_id, c.name, c.difficulty_tier,
         COALESCE(t.exposure_count, 0) AS exposure_count,
         COALESCE(t.accuracy_ema, 0.5) AS accuracy_ema,
         COALESCE(t.failure_streak, 0) AS failure_streak,
         COALESCE(t.last_at, 0) AS last_at,
         COALESCE(t.stability_score, 0) AS stability_score
         FROM concepts c
         LEFT JOIN topic_state t ON c.id = t.concept_id
         ORDER BY c.id`
      )
      .toArray() as {
        concept_id: string;
        name: string;
        difficulty_tier: number | null;
        exposure_count: number;
        accuracy_ema: number;
        failure_streak: number;
        last_at: number;
        stability_score: number;
      }[];
    const items: ProgressItem[] = rows.map((r) => {
      const meta = CONCEPT_V2.find((c) => c.id === r.concept_id);
      const masteryLevel = deriveMasteryLevel(r.exposure_count, r.accuracy_ema, r.failure_streak, r.stability_score);
      return {
        conceptId: r.concept_id,
        name: r.name,
        difficultyTier: r.difficulty_tier ?? undefined,
        difficulty_hint: meta?.difficulty_hint,
        type: meta?.type,
        track: meta?.track,
        exposureCount: r.exposure_count,
        accuracyEma: r.accuracy_ema,
        failureStreak: r.failure_streak,
        lastAt: r.last_at,
        stabilityScore: r.stability_score,
        mastery: this.deriveMastery(r.exposure_count, r.accuracy_ema, r.failure_streak),
        masteryLevel,
        masterySpec: meta?.masterySpec,
      };
    });
    return { items };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/stream")) {
      const cursor = url.searchParams.get("cursor") ?? undefined;
      const focusConceptId = url.searchParams.get("focus") ?? undefined;
      const excludeIdsParam = url.searchParams.get("excludeIds") ?? "";
      const excludeIds = excludeIdsParam
        ? excludeIdsParam.split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id.trim())).slice(0, 50)
        : [];
      const stream = this.streamReels(cursor, { focusConceptId, excludeIds });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Response(toServerSentEventsStream(stream as any), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
    return new Response("LearningMemoryDO Active");
  }
}
