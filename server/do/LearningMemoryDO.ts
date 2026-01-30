import { DurableObject } from "cloudflare:workers";
import type { Reel, TopicStateRow, ProgressResponse, ProgressItem, Mastery } from "../system-shots/types";
import type { AnswerSubmittedPayload } from "../system-shots/types";
import type { ConceptV2 } from "../system-shots/types";
import { getConceptSeedRows, CONCEPT_V2 } from "../system-shots/concepts";

/** Generate next batch only when unconsumed reels (including skipped, which are replayed) drop below this. */
const BUFFER_THRESHOLD = 20;
const BUFFER_REFILL_COUNT = 50;
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
        last_at INTEGER NOT NULL DEFAULT 0
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
        skipped_at INTEGER
      );
    `);
    this.ensureReelsSkippedAtColumn();
  }

  /** Add skipped_at to reels if missing (migration for existing DOs). */
  private ensureReelsSkippedAtColumn(): void {
    const info = this.sql.exec("PRAGMA table_info(reels)").toArray() as { name: string }[];
    if (info.some((r) => r.name === "skipped_at")) return;
    this.sql.exec("ALTER TABLE reels ADD COLUMN skipped_at INTEGER");
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
    };
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
      const reel = this.rowToReel(retry);
      this.appendReelShownEvent(reel.id, reel.conceptId);
      console.log(`${LOG_PREFIX} getNextReel return reelId=${reel.id} (after refill)`);
      return reel;
    }
    const reel = this.rowToReel(row);
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
    const reels = rows.map((r) => this.rowToReel(r));
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
      this.sql.exec("UPDATE reels SET skipped_at = ? WHERE id = ?", timestamp, reelId);
    } else {
      // Answer: consume reel and clear skipped_at so scroll-back-and-answer removes skip state.
      this.sql.exec("UPDATE reels SET consumed_at = ?, skipped_at = NULL WHERE id = ?", timestamp, reelId);
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

    this.sql.exec(
      `INSERT INTO topic_state (concept_id, exposure_count, accuracy_ema, failure_streak, last_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(concept_id) DO UPDATE SET
         exposure_count = excluded.exposure_count,
         accuracy_ema = excluded.accuracy_ema,
         failure_streak = excluded.failure_streak,
         last_at = excluded.last_at`,
      conceptId,
      exposureCount,
      accuracyEma,
      failureStreak,
      timestamp
    );
  }

  /** If unconsumed reels (including skipped, which are replayed) < BUFFER_THRESHOLD, generate BUFFER_REFILL_COUNT via LLM. */
  async ensureBuffer(): Promise<void> {
    const count = this.countUnconsumedReels();
    console.log(`${LOG_PREFIX} ensureBuffer unconsumedCount=${count} threshold=${BUFFER_THRESHOLD}`);
    if (count >= BUFFER_THRESHOLD) {
      console.log(`${LOG_PREFIX} ensureBuffer skip (buffer sufficient)`);
      return;
    }

    const topicState = this.getTopicStateForGeneration();
    const concepts = this.getConceptsList();
    console.log(`${LOG_PREFIX} ensureBuffer generating topicStateConcepts=${topicState.length} concepts=${concepts.length} targetCount=${BUFFER_REFILL_COUNT}`);
    const { generateReelsBatch } = await import("../system-shots/generate");
    const newReels = await generateReelsBatch(
      this.env,
      topicState,
      concepts,
      BUFFER_REFILL_COUNT
    );
    console.log(`${LOG_PREFIX} ensureBuffer generated ${newReels.length} reels`);
    this.persistReels(newReels);
    const afterCount = this.countUnconsumedReels();
    console.log(`${LOG_PREFIX} ensureBuffer done unconsumedCount=${afterCount}`);
  }

  private getTopicStateForGeneration(): TopicStateRow[] {
    const rows = this.sql
      .exec("SELECT concept_id, exposure_count, accuracy_ema, failure_streak, last_at FROM topic_state")
      .toArray() as { concept_id: string; exposure_count: number; accuracy_ema: number; failure_streak: number; last_at: number }[];
    return rows.map((r) => ({
      conceptId: r.concept_id,
      exposureCount: r.exposure_count,
      accuracyEma: r.accuracy_ema,
      failureStreak: r.failure_streak,
      lastAt: r.last_at,
    }));
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

  private persistReels(reels: Omit<Reel, "createdAt" | "consumedAt">[]): void {
    const now = Date.now();
    for (const r of reels) {
      this.sql.exec(
        `INSERT INTO reels (id, concept_id, type, prompt, options, correct_index, explanation, difficulty, created_at, consumed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        r.id,
        r.conceptId,
        r.type,
        r.prompt,
        r.options != null ? JSON.stringify(r.options) : null,
        r.correctIndex ?? null,
        r.explanation,
        r.difficulty,
        now
      );
    }
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response("LearningMemoryDO Active");
  }
}
