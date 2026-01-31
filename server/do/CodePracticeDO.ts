/**
 * CodePracticeDO - Durable Object for per-user code practice progress
 * 
 * One instance per user (keyed by userId). Stores:
 * - Code drafts (auto-saved work in progress)
 * - Submission history
 * - Solved problems cache
 */

import { DurableObject } from "cloudflare:workers";

const LOG_PREFIX = "[CodePracticeDO]";

export interface Submission {
  id: string;
  problemId: string;
  language: string;
  code: string;
  verdict: string;
  score: number;
  timeMs: number | null;
  submittedAt: number;
}

export interface UserStats {
  solved: number;
  attempted: number;
  submissions: number;
}

export class CodePracticeDO extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initializeTables();
  }

  private initializeTables(): void {
    // Code drafts (auto-saved work in progress)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS drafts (
        problem_id TEXT NOT NULL,
        language TEXT NOT NULL,
        code TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (problem_id, language)
      );
    `);

    // Submissions history
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        problem_id TEXT NOT NULL,
        language TEXT NOT NULL,
        code TEXT NOT NULL,
        verdict TEXT NOT NULL,
        score REAL NOT NULL,
        time_ms INTEGER,
        submitted_at INTEGER NOT NULL
      );
    `);

    // Solved problems cache (for quick lookups)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS solved (
        problem_id TEXT PRIMARY KEY,
        first_solved_at INTEGER NOT NULL,
        best_time_ms INTEGER
      );
    `);

    // Create indexes for efficient queries
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_submissions_problem 
      ON submissions(problem_id, submitted_at DESC);
    `);
  }

  // ============ Draft Management ============

  /**
   * Save or update a code draft for a problem
   */
  async saveDraft(problemId: string, language: string, code: string): Promise<void> {
    const now = Date.now();
    console.log(`${LOG_PREFIX} saveDraft problemId=${problemId} language=${language} codeLen=${code.length}`);
    
    this.sql.exec(
      `INSERT INTO drafts (problem_id, language, code, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(problem_id, language) DO UPDATE SET
         code = excluded.code,
         updated_at = excluded.updated_at`,
      problemId,
      language,
      code,
      now
    );
  }

  /**
   * Get saved draft for a problem and language
   */
  async getDraft(problemId: string, language: string): Promise<string | null> {
    console.log(`${LOG_PREFIX} getDraft problemId=${problemId} language=${language}`);
    
    const rows = this.sql
      .exec("SELECT code FROM drafts WHERE problem_id = ? AND language = ?", problemId, language)
      .toArray() as { code: string }[];
    
    return rows[0]?.code ?? null;
  }

  /**
   * Delete a draft (e.g., after successful submission)
   */
  async deleteDraft(problemId: string, language: string): Promise<void> {
    console.log(`${LOG_PREFIX} deleteDraft problemId=${problemId} language=${language}`);
    
    this.sql.exec(
      "DELETE FROM drafts WHERE problem_id = ? AND language = ?",
      problemId,
      language
    );
  }

  // ============ Submissions ============

  /**
   * Record a new submission
   */
  async recordSubmission(submission: Submission): Promise<void> {
    console.log(`${LOG_PREFIX} recordSubmission problemId=${submission.problemId} verdict=${submission.verdict}`);
    
    this.sql.exec(
      `INSERT INTO submissions (id, problem_id, language, code, verdict, score, time_ms, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      submission.id,
      submission.problemId,
      submission.language,
      submission.code,
      submission.verdict,
      submission.score,
      submission.timeMs,
      submission.submittedAt
    );

    // If accepted, update solved table
    if (submission.verdict === 'AC') {
      const existing = this.sql
        .exec("SELECT best_time_ms FROM solved WHERE problem_id = ?", submission.problemId)
        .toArray() as { best_time_ms: number | null }[];
      
      if (existing.length === 0) {
        // First time solving
        this.sql.exec(
          `INSERT INTO solved (problem_id, first_solved_at, best_time_ms)
           VALUES (?, ?, ?)`,
          submission.problemId,
          submission.submittedAt,
          submission.timeMs
        );
      } else if (submission.timeMs !== null && (existing[0].best_time_ms === null || submission.timeMs < existing[0].best_time_ms)) {
        // Update best time
        this.sql.exec(
          `UPDATE solved SET best_time_ms = ? WHERE problem_id = ?`,
          submission.timeMs,
          submission.problemId
        );
      }
    }
  }

  /**
   * Get submission history for a problem
   */
  async getSubmissions(problemId: string, limit: number = 10): Promise<Submission[]> {
    console.log(`${LOG_PREFIX} getSubmissions problemId=${problemId} limit=${limit}`);
    
    const rows = this.sql
      .exec(
        `SELECT id, problem_id, language, code, verdict, score, time_ms, submitted_at
         FROM submissions
         WHERE problem_id = ?
         ORDER BY submitted_at DESC
         LIMIT ?`,
        problemId,
        limit
      )
      .toArray() as {
        id: string;
        problem_id: string;
        language: string;
        code: string;
        verdict: string;
        score: number;
        time_ms: number | null;
        submitted_at: number;
      }[];
    
    return rows.map(r => ({
      id: r.id,
      problemId: r.problem_id,
      language: r.language,
      code: r.code,
      verdict: r.verdict,
      score: r.score,
      timeMs: r.time_ms,
      submittedAt: r.submitted_at,
    }));
  }

  /**
   * Get the latest submission for a problem (any language)
   */
  async getLatestSubmission(problemId: string): Promise<Submission | null> {
    const submissions = await this.getSubmissions(problemId, 1);
    return submissions[0] ?? null;
  }

  // ============ Progress Stats ============

  /**
   * Get list of solved problem IDs
   */
  async getSolvedProblems(): Promise<string[]> {
    console.log(`${LOG_PREFIX} getSolvedProblems`);
    
    const rows = this.sql
      .exec("SELECT problem_id FROM solved ORDER BY first_solved_at DESC")
      .toArray() as { problem_id: string }[];
    
    return rows.map(r => r.problem_id);
  }

  /**
   * Get overall user stats
   */
  async getStats(): Promise<UserStats> {
    console.log(`${LOG_PREFIX} getStats`);
    
    // Count solved problems
    const solvedRow = this.sql
      .exec("SELECT COUNT(*) as count FROM solved")
      .one() as { count: number };
    
    // Count attempted problems (distinct problems with at least one submission)
    const attemptedRow = this.sql
      .exec("SELECT COUNT(DISTINCT problem_id) as count FROM submissions")
      .one() as { count: number };
    
    // Count total submissions
    const submissionsRow = this.sql
      .exec("SELECT COUNT(*) as count FROM submissions")
      .one() as { count: number };
    
    return {
      solved: solvedRow.count,
      attempted: attemptedRow.count,
      submissions: submissionsRow.count,
    };
  }

  /**
   * Check if a specific problem is solved
   */
  async isProblemSolved(problemId: string): Promise<boolean> {
    const row = this.sql
      .exec("SELECT 1 FROM solved WHERE problem_id = ?", problemId)
      .toArray();
    return row.length > 0;
  }

  /**
   * Get all drafts for the user (for potential cleanup or listing)
   */
  async getAllDrafts(): Promise<{ problemId: string; language: string; updatedAt: number }[]> {
    const rows = this.sql
      .exec("SELECT problem_id, language, updated_at FROM drafts ORDER BY updated_at DESC")
      .toArray() as { problem_id: string; language: string; updated_at: number }[];
    
    return rows.map(r => ({
      problemId: r.problem_id,
      language: r.language,
      updatedAt: r.updated_at,
    }));
  }
}
