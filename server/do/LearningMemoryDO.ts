import { DurableObject } from "cloudflare:workers";
import { toServerSentEventsStream } from "@tanstack/ai";
import type { Reel, TopicStateRow, ProgressResponse, ProgressItem, Mastery, FeedIntent } from "../system-shots/types";
import type { AnswerSubmittedPayload, UserConceptPrefs, UserTopicOverlay, PreferencesResponse, DifficultyOverride, PriorityBias } from "../system-shots/types";
import type { ConceptV2 } from "../system-shots/types";
import { getConceptSeedRows, CONCEPT_V2 } from "../system-shots/concepts";
import { getMicroSignal } from "../system-shots/intent-engine";

/** Generate next batch only when unconsumed reels (including skipped, which are replayed) drop below this. */
const BUFFER_THRESHOLD = 5;
const BUFFER_REFILL_COUNT = 10;
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
    // User learning preferences tables
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS user_concept_prefs (
        concept_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1,
        difficulty_override INTEGER NOT NULL DEFAULT 0,
        priority_bias INTEGER NOT NULL DEFAULT 0
      );
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS user_topic_overlays (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        mapped_concept_ids TEXT NOT NULL,
        created_at INTEGER NOT NULL
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

    // Check and add intent and skip_count to reels
    const reelsInfo = this.sql.exec("PRAGMA table_info(reels)").toArray() as { name: string }[];
    if (!reelsInfo.some((r) => r.name === "intent")) {
      this.sql.exec("ALTER TABLE reels ADD COLUMN intent TEXT");
    }
    if (!reelsInfo.some((r) => r.name === "skip_count")) {
      this.sql.exec("ALTER TABLE reels ADD COLUMN skip_count INTEGER NOT NULL DEFAULT 0");
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

  private countUnconsumedReels(): number {
    const row = this.sql
      .exec("SELECT COUNT(*) as c FROM reels WHERE consumed_at IS NULL")
      .one() as { c: number };
    return row.c;
  }

  /** Count only fresh reels (not yet skipped or consumed) - used for generation decisions */
  private countFreshReels(): number {
    const row = this.sql
      .exec("SELECT COUNT(*) as c FROM reels WHERE consumed_at IS NULL AND skipped_at IS NULL")
      .one() as { c: number };
    return row.c;
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

  /** Get next unconsumed reel (skipped first); trigger ensureBuffer (await) when low. Kept for backward compat. */
  async getNextReel(): Promise<Reel | null> {
    console.log(`${LOG_PREFIX} getNextReel start`);
    const unconsumedCount = this.countUnconsumedReels();
    console.log(`${LOG_PREFIX} getNextReel unconsumedCount=${unconsumedCount}`);

    const orderLimit =
      "ORDER BY (CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END), COALESCE(skipped_at, 0), created_at, id LIMIT 1";
    const rows = this.sql
      .exec(`SELECT * FROM reels WHERE consumed_at IS NULL ${orderLimit}`)
      .toArray() as Record<string, unknown>[];
    const row = rows[0];

    // Get topic state for micro signal computation
    const topicStateMap = new Map(
      this.getTopicStateForGeneration().map((t) => [t.conceptId, t])
    );

    if (!row) {
      console.log(`${LOG_PREFIX} getNextReel no row, calling ensureBuffer`);
      await this.ensureBuffer();
      const retryRows = this.sql
        .exec(`SELECT * FROM reels WHERE consumed_at IS NULL ${orderLimit}`)
        .toArray() as Record<string, unknown>[];
      const retry = retryRows[0];
      if (!retry) {
        console.log(`${LOG_PREFIX} getNextReel still no reel after ensureBuffer, return null`);
        return null;
      }
      const reel = this.enrichReelWithMicroSignal(this.rowToReel(retry), topicStateMap);
      this.appendReelShownEvent(reel.id, reel.conceptId);
      console.log(`${LOG_PREFIX} getNextReel return reelId=${reel.id} (after refill)`);
      return reel;
    }
    const reel = this.enrichReelWithMicroSignal(this.rowToReel(row), topicStateMap);
    await this.ensureBuffer();
    this.appendReelShownEvent(reel.id, reel.conceptId);
    console.log(`${LOG_PREFIX} getNextReel return reelId=${reel.id}`);
    return reel;
  }

  /** Cursor-based page of unconsumed reels. Skipped reels are replayed and ordered first (oldest skip first), then by created_at. */
  async getReels(cursor: string | undefined, limit: number): Promise<{ reels: Reel[]; nextCursor: string | null }> {
    console.log(`${LOG_PREFIX} getReels start cursor=${cursor ?? "none"} limit=${limit}`);
    const beforeCount = this.countUnconsumedReels();
    console.log(`${LOG_PREFIX} getReels unconsumedCount before ensureBuffer=${beforeCount}`);

    await this.ensureBuffer();

    const afterCount = this.countUnconsumedReels();
    console.log(`${LOG_PREFIX} getReels unconsumedCount after ensureBuffer=${afterCount}`);

    const orderBy =
      "ORDER BY (CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END), COALESCE(skipped_at, 0), created_at, id LIMIT ?";

    let rows: Record<string, unknown>[];
    if (cursor) {
      const cursorRows = this.sql
        .exec("SELECT skipped_at, created_at, id FROM reels WHERE id = ?", cursor)
        .toArray() as { skipped_at: number | null; created_at: number; id: string }[];
      const cursorRow = cursorRows[0];
      if (!cursorRow) {
        console.log(`${LOG_PREFIX} getReels cursor reel not found, falling back to first page`);
        rows = this.sql
          .exec(`SELECT * FROM reels WHERE consumed_at IS NULL ${orderBy}`, limit)
          .toArray() as Record<string, unknown>[];
      } else {
        const cOrd0 = cursorRow.skipped_at == null ? 1 : 0;
        const cOrd1 = cursorRow.skipped_at ?? 0;
        const cOrd2 = cursorRow.created_at;
        const cOrd3 = cursorRow.id;
        rows = this.sql
          .exec(
            `SELECT * FROM reels WHERE consumed_at IS NULL AND (
              (CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END) > ? OR
              ((CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END) = ? AND COALESCE(skipped_at, 0) > ?) OR
              ((CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END) = ? AND COALESCE(skipped_at, 0) = ? AND created_at > ?) OR
              ((CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END) = ? AND COALESCE(skipped_at, 0) = ? AND created_at = ? AND id > ?)
            ) ${orderBy}`,
            cOrd0,
            cOrd0,
            cOrd1,
            cOrd0,
            cOrd1,
            cOrd2,
            cOrd0,
            cOrd1,
            cOrd2,
            cOrd3,
            limit
          )
          .toArray() as Record<string, unknown>[];
      }
    } else {
      rows = this.sql
        .exec(`SELECT * FROM reels WHERE consumed_at IS NULL ${orderBy}`, limit)
        .toArray() as Record<string, unknown>[];
    }
    // Enrich reels with micro signals
    const topicStateMap = new Map(
      this.getTopicStateForGeneration().map((t) => [t.conceptId, t])
    );
    const reels = rows.map((r) => {
      const reel = this.rowToReel(r);
      return this.enrichReelWithMicroSignal(reel, topicStateMap);
    });
    const nextCursor = rows.length === limit && reels.length > 0 ? reels[reels.length - 1].id : null;
    console.log(`${LOG_PREFIX} getReels return reels=${reels.length} nextCursor=${nextCursor ?? "null"} reelIds=${reels.map((r) => r.id).join(",")}`);
    return { reels, nextCursor };
  }

  private appendReelShownEvent(reelId: string, conceptId: string): void {
    const id = crypto.randomUUID();
    const payload = JSON.stringify({ reelId, conceptId, shownAt: Date.now() });
    this.sql.exec(
      "INSERT INTO events (id, event_type, payload, created_at) VALUES (?, 'reel_shown', ?, ?)",
      id,
      payload,
      Date.now()
    );
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

    const eventId = crypto.randomUUID();
    const payload: AnswerSubmittedPayload = {
      reelId,
      conceptId,
      selectedIndex,
      correct,
      skipped,
      timestamp,
    };
    this.sql.exec(
      "INSERT INTO events (id, event_type, payload, created_at) VALUES (?, 'answer_submitted', ?, ?)",
      eventId,
      JSON.stringify(payload),
      timestamp
    );

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

  /** Convert difficulty_hint to numeric value for stability calculation. */
  private difficultyHintToNumber(hint?: "intro" | "core" | "advanced"): number {
    switch (hint) {
      case "intro": return 1;
      case "core": return 2;
      case "advanced": return 3;
      default: return 2; // default to core
    }
  }

  /** If fresh reels (not skipped, not consumed) < BUFFER_THRESHOLD, generate BUFFER_REFILL_COUNT via LLM. */
  async ensureBuffer(): Promise<void> {
    const freshCount = this.countFreshReels();
    console.log(`${LOG_PREFIX} ensureBuffer freshCount=${freshCount} threshold=${BUFFER_THRESHOLD}`);
    if (freshCount >= BUFFER_THRESHOLD) {
      console.log(`${LOG_PREFIX} ensureBuffer skip (buffer sufficient)`);
      return;
    }

    const topicState = this.getTopicStateForGeneration();
    const concepts = this.getConceptsList();
    const skipCounts = this.getSkipCountsPerConcept();
    const userPrefs = this.getConceptPrefsMap();
    const topicOverlays = this.getTopicOverlays();
    console.log(`${LOG_PREFIX} ensureBuffer generating topicStateConcepts=${topicState.length} concepts=${concepts.length} targetCount=${BUFFER_REFILL_COUNT} userPrefs=${userPrefs.size} overlays=${topicOverlays.length}`);
    const { generateReelsBatch } = await import("../system-shots/generate");
    const newReels = await generateReelsBatch(
      this.env,
      topicState,
      concepts,
      BUFFER_REFILL_COUNT,
      { skipCounts, userPrefs, topicOverlays }
    );
    console.log(`${LOG_PREFIX} ensureBuffer generated ${newReels.length} reels`);
    this.persistReels(newReels);
    const afterCount = this.countUnconsumedReels();
    console.log(`${LOG_PREFIX} ensureBuffer done unconsumedCount=${afterCount}`);
  }

  /** Persist a single reel (for streaming: persist as we yield). */
  private persistOneReel(r: Omit<Reel, "createdAt" | "consumedAt">): void {
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO reels (id, concept_id, type, prompt, options, correct_index, explanation, difficulty, created_at, consumed_at, intent, skip_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
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
      r.skipCount ?? 0
    );
  }

  /**
   * Async generator: yield reels for SSE. No cursor = initial stream (ensure buffer, stream up to 10).
   * With cursor = next page (reels after cursor, up to 10). Yields StreamChunk-like objects for toServerSentEventsStream.
   * Does not cancel generation if client disconnects.
   */
  async *streamReels(cursor: string | undefined): AsyncGenerator<{ type: string; delta?: string; content?: string; finishReason?: string | null }> {
    const orderBy =
      "ORDER BY (CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END), COALESCE(skipped_at, 0), created_at, id LIMIT ?";
    
    // Get topic state for micro signal computation
    const topicStateMap = new Map(
      this.getTopicStateForGeneration().map((t) => [t.conceptId, t])
    );
    
    const toChunk = (reel: Reel) => {
      const enrichedReel = this.enrichReelWithMicroSignal(reel, topicStateMap);
      return {
        type: "content" as const,
        delta: JSON.stringify(enrichedReel),
        content: JSON.stringify(enrichedReel),
      };
    };

    if (cursor) {
      // Next page: reels after cursor, up to 10
      const cursorRows = this.sql
        .exec("SELECT skipped_at, created_at, id FROM reels WHERE id = ?", cursor)
        .toArray() as { skipped_at: number | null; created_at: number; id: string }[];
      const cursorRow = cursorRows[0];
      let rows: Record<string, unknown>[];
      if (!cursorRow) {
        rows = this.sql
          .exec(`SELECT * FROM reels WHERE consumed_at IS NULL ${orderBy}`, BUFFER_REFILL_COUNT)
          .toArray() as Record<string, unknown>[];
      } else {
        const cOrd0 = cursorRow.skipped_at == null ? 1 : 0;
        const cOrd1 = cursorRow.skipped_at ?? 0;
        const cOrd2 = cursorRow.created_at;
        const cOrd3 = cursorRow.id;
        rows = this.sql
          .exec(
            `SELECT * FROM reels WHERE consumed_at IS NULL AND (
              (CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END) > ? OR
              ((CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END) = ? AND COALESCE(skipped_at, 0) > ?) OR
              ((CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END) = ? AND COALESCE(skipped_at, 0) = ? AND created_at > ?) OR
              ((CASE WHEN skipped_at IS NULL THEN 1 ELSE 0 END) = ? AND COALESCE(skipped_at, 0) = ? AND created_at = ? AND id > ?)
            ) ${orderBy}`,
            cOrd0,
            cOrd0,
            cOrd1,
            cOrd0,
            cOrd1,
            cOrd2,
            cOrd0,
            cOrd1,
            cOrd2,
            cOrd3,
            BUFFER_REFILL_COUNT
          )
          .toArray() as Record<string, unknown>[];
      }
      
      // If we have existing reels after cursor, yield them
      if (rows.length > 0) {
        for (const r of rows) {
          yield toChunk(this.rowToReel(r));
        }
        yield { type: "done", finishReason: "stop" };
        return;
      }
      
      // No more reels after cursor - generate new ones if fresh buffer is low
      const freshCount = this.countFreshReels();
      console.log(`${LOG_PREFIX} streamReels cursor=${cursor}, no rows after cursor, freshCount=${freshCount}`);
      if (freshCount >= BUFFER_THRESHOLD) {
        // Enough fresh reels exist elsewhere, don't generate (user may have skipped earlier reels)
        yield { type: "done", finishReason: "stop" };
        return;
      }
      
      // Generate new reels
      console.log(`${LOG_PREFIX} streamReels generating new reels (cursor flow)`);
      const topicState = this.getTopicStateForGeneration();
      const concepts = this.getConceptsList();
      const skipCounts = this.getSkipCountsPerConcept();
      const userPrefs = this.getConceptPrefsMap();
      const topicOverlays = this.getTopicOverlays();
      const { generateReelsStream } = await import("../system-shots/generate");
      let yielded = 0;
      for await (const reel of generateReelsStream(this.env, topicState, concepts, BUFFER_REFILL_COUNT, { skipCounts, userPrefs, topicOverlays })) {
        this.persistOneReel(reel);
        const apiReel: Reel = { ...reel, createdAt: Date.now(), consumedAt: null };
        yield toChunk(apiReel);
        yielded++;
        if (yielded >= BUFFER_REFILL_COUNT) break;
      }
      console.log(`${LOG_PREFIX} streamReels cursor flow yielded=${yielded}`);
      yield { type: "done", finishReason: "stop" };
      return;
    }

    // Initial stream: generate if fresh buffer is low, then yield up to 10 from DB
    const freshCount = this.countFreshReels();
    console.log(`${LOG_PREFIX} streamReels initial freshCount=${freshCount} threshold=${BUFFER_THRESHOLD}`);
    
    if (freshCount < BUFFER_THRESHOLD) {
      // Generate new reels first, then yield from DB (which includes newly generated + any skipped)
      const topicState = this.getTopicStateForGeneration();
      const concepts = this.getConceptsList();
      const skipCounts = this.getSkipCountsPerConcept();
      const userPrefs = this.getConceptPrefsMap();
      const topicOverlays = this.getTopicOverlays();
      const { generateReelsStream } = await import("../system-shots/generate");
      let generated = 0;
      for await (const reel of generateReelsStream(this.env, topicState, concepts, BUFFER_REFILL_COUNT, { skipCounts, userPrefs, topicOverlays })) {
        this.persistOneReel(reel);
        generated++;
        if (generated >= BUFFER_REFILL_COUNT) break;
      }
      console.log(`${LOG_PREFIX} streamReels initial generated=${generated}`);
    }
    
    // Yield up to 10 unconsumed reels from DB (skipped prioritized first, then fresh by created_at)
    const rows = this.sql
      .exec(`SELECT * FROM reels WHERE consumed_at IS NULL ${orderBy}`, BUFFER_REFILL_COUNT)
      .toArray() as Record<string, unknown>[];
    for (const r of rows) {
      yield toChunk(this.rowToReel(r));
    }
    console.log(`${LOG_PREFIX} streamReels initial yielded=${rows.length}`);
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
         COALESCE(t.last_at, 0) AS last_at
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
    }[];
    const items: ProgressItem[] = rows.map((r) => {
      const meta = CONCEPT_V2.find((c) => c.id === r.concept_id);
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
        mastery: this.deriveMastery(r.exposure_count, r.accuracy_ema, r.failure_streak),
      };
    });
    return { items };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // User Learning Preferences CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get all user preferences (concept prefs + topic overlays). */
  async getPreferences(): Promise<PreferencesResponse> {
    console.log(`${LOG_PREFIX} getPreferences`);

    // Get concept preferences (only non-default values are stored)
    const prefRows = this.sql
      .exec("SELECT concept_id, enabled, difficulty_override, priority_bias FROM user_concept_prefs")
      .toArray() as { concept_id: string; enabled: number; difficulty_override: number; priority_bias: number }[];

    const conceptPrefs: UserConceptPrefs[] = prefRows.map((r) => ({
      conceptId: r.concept_id,
      enabled: r.enabled === 1,
      difficultyOverride: r.difficulty_override as DifficultyOverride,
      priorityBias: r.priority_bias as PriorityBias,
    }));

    // Get topic overlays
    const overlayRows = this.sql
      .exec("SELECT id, title, description, mapped_concept_ids, created_at FROM user_topic_overlays ORDER BY created_at DESC")
      .toArray() as { id: string; title: string; description: string; mapped_concept_ids: string; created_at: number }[];

    const topicOverlays: UserTopicOverlay[] = overlayRows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      mappedConceptIds: JSON.parse(r.mapped_concept_ids) as string[],
      createdAt: r.created_at,
    }));

    console.log(`${LOG_PREFIX} getPreferences conceptPrefs=${conceptPrefs.length} overlays=${topicOverlays.length}`);
    return { conceptPrefs, topicOverlays };
  }

  /** Update a single concept's preferences. */
  async updateConceptPref(
    conceptId: string,
    enabled: boolean,
    difficultyOverride: DifficultyOverride,
    priorityBias: PriorityBias
  ): Promise<void> {
    console.log(`${LOG_PREFIX} updateConceptPref conceptId=${conceptId} enabled=${enabled} diff=${difficultyOverride} priority=${priorityBias}`);

    // If all values are default, delete the row (keep table sparse)
    if (enabled && difficultyOverride === 0 && priorityBias === 0) {
      this.sql.exec("DELETE FROM user_concept_prefs WHERE concept_id = ?", conceptId);
      return;
    }

    this.sql.exec(
      `INSERT INTO user_concept_prefs (concept_id, enabled, difficulty_override, priority_bias)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(concept_id) DO UPDATE SET
         enabled = excluded.enabled,
         difficulty_override = excluded.difficulty_override,
         priority_bias = excluded.priority_bias`,
      conceptId,
      enabled ? 1 : 0,
      difficultyOverride,
      priorityBias
    );
  }

  /** Batch update concept preferences. */
  async batchUpdateConceptPrefs(prefs: UserConceptPrefs[]): Promise<void> {
    console.log(`${LOG_PREFIX} batchUpdateConceptPrefs count=${prefs.length}`);
    for (const pref of prefs) {
      await this.updateConceptPref(
        pref.conceptId,
        pref.enabled,
        pref.difficultyOverride,
        pref.priorityBias
      );
    }
  }

  /** Reset concept preferences to defaults (optionally by track). */
  async resetConceptPrefs(track?: string): Promise<void> {
    console.log(`${LOG_PREFIX} resetConceptPrefs track=${track ?? "all"}`);

    if (!track) {
      // Reset all
      this.sql.exec("DELETE FROM user_concept_prefs");
      return;
    }

    // Reset by track: find concept IDs for the track, delete their prefs
    const trackConcepts = CONCEPT_V2.filter((c) => c.track === track).map((c) => c.id);
    for (const conceptId of trackConcepts) {
      this.sql.exec("DELETE FROM user_concept_prefs WHERE concept_id = ?", conceptId);
    }
  }

  /** Add a user topic overlay. */
  async addTopicOverlay(title: string, description: string, mappedConceptIds: string[]): Promise<UserTopicOverlay> {
    console.log(`${LOG_PREFIX} addTopicOverlay title="${title}" mappedConcepts=${mappedConceptIds.length}`);

    const overlay: UserTopicOverlay = {
      id: crypto.randomUUID(),
      title,
      description,
      mappedConceptIds,
      createdAt: Date.now(),
    };

    this.sql.exec(
      "INSERT INTO user_topic_overlays (id, title, description, mapped_concept_ids, created_at) VALUES (?, ?, ?, ?, ?)",
      overlay.id,
      overlay.title,
      overlay.description,
      JSON.stringify(overlay.mappedConceptIds),
      overlay.createdAt
    );

    return overlay;
  }

  /** Remove a user topic overlay. */
  async removeTopicOverlay(id: string): Promise<void> {
    console.log(`${LOG_PREFIX} removeTopicOverlay id=${id}`);
    this.sql.exec("DELETE FROM user_topic_overlays WHERE id = ?", id);
  }

  /** Get enabled concept IDs (for feed generation filtering). */
  getEnabledConceptIds(): Set<string> {
    // Start with all concepts enabled
    const allIds = new Set(CONCEPT_V2.map((c) => c.id));
    
    // Remove disabled ones
    const disabledRows = this.sql
      .exec("SELECT concept_id FROM user_concept_prefs WHERE enabled = 0")
      .toArray() as { concept_id: string }[];
    
    for (const row of disabledRows) {
      allIds.delete(row.concept_id);
    }
    
    return allIds;
  }

  /** Get concept preferences map for batch composer. */
  getConceptPrefsMap(): Map<string, UserConceptPrefs> {
    const prefRows = this.sql
      .exec("SELECT concept_id, enabled, difficulty_override, priority_bias FROM user_concept_prefs")
      .toArray() as { concept_id: string; enabled: number; difficulty_override: number; priority_bias: number }[];

    const map = new Map<string, UserConceptPrefs>();
    for (const r of prefRows) {
      map.set(r.concept_id, {
        conceptId: r.concept_id,
        enabled: r.enabled === 1,
        difficultyOverride: r.difficulty_override as DifficultyOverride,
        priorityBias: r.priority_bias as PriorityBias,
      });
    }
    return map;
  }

  /** Get all topic overlays for prompt injection. */
  getTopicOverlays(): UserTopicOverlay[] {
    const rows = this.sql
      .exec("SELECT id, title, description, mapped_concept_ids, created_at FROM user_topic_overlays")
      .toArray() as { id: string; title: string; description: string; mapped_concept_ids: string; created_at: number }[];

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      mappedConceptIds: JSON.parse(r.mapped_concept_ids) as string[],
      createdAt: r.created_at,
    }));
  }

  private persistReels(reels: Omit<Reel, "createdAt" | "consumedAt">[]): void {
    const now = Date.now();
    for (const r of reels) {
      this.sql.exec(
        `INSERT INTO reels (id, concept_id, type, prompt, options, correct_index, explanation, difficulty, created_at, consumed_at, intent, skip_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
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
        r.skipCount ?? 0
      );
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/stream")) {
      const cursor = url.searchParams.get("cursor") ?? undefined;
      const stream = this.streamReels(cursor);
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
