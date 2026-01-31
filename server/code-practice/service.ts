/**
 * CodePracticeService - Service layer for interacting with CodePracticeDO
 * 
 * Handles DO stub resolution and provides a clean API for the router.
 */

import type { CodePracticeDO, Submission, UserStats } from "../do/CodePracticeDO";

export class CodePracticeService {
  constructor(private env: Env) {}

  /**
   * Get the DO stub for a specific user
   */
  private getStub(userId: string): DurableObjectStub<CodePracticeDO> {
    const doId = this.env.CODE_PRACTICE_DO.idFromName(userId);
    return this.env.CODE_PRACTICE_DO.get(doId);
  }

  // ============ Draft Management ============

  async saveDraft(userId: string, problemId: string, language: string, code: string): Promise<void> {
    const stub = this.getStub(userId);
    return stub.saveDraft(problemId, language, code);
  }

  async getDraft(userId: string, problemId: string, language: string): Promise<string | null> {
    const stub = this.getStub(userId);
    return stub.getDraft(problemId, language);
  }

  async deleteDraft(userId: string, problemId: string, language: string): Promise<void> {
    const stub = this.getStub(userId);
    return stub.deleteDraft(problemId, language);
  }

  // ============ Submissions ============

  async recordSubmission(userId: string, submission: Submission): Promise<void> {
    const stub = this.getStub(userId);
    return stub.recordSubmission(submission);
  }

  async getSubmissions(userId: string, problemId: string, limit?: number): Promise<Submission[]> {
    const stub = this.getStub(userId);
    return stub.getSubmissions(problemId, limit);
  }

  async getLatestSubmission(userId: string, problemId: string): Promise<Submission | null> {
    const stub = this.getStub(userId);
    return stub.getLatestSubmission(problemId);
  }

  // ============ Progress Stats ============

  async getSolvedProblems(userId: string): Promise<string[]> {
    const stub = this.getStub(userId);
    return stub.getSolvedProblems();
  }

  async getStats(userId: string): Promise<UserStats> {
    const stub = this.getStub(userId);
    return stub.getStats();
  }

  async isProblemSolved(userId: string, problemId: string): Promise<boolean> {
    const stub = this.getStub(userId);
    return stub.isProblemSolved(problemId);
  }

  async getAllDrafts(userId: string): Promise<{ problemId: string; language: string; updatedAt: number }[]> {
    const stub = this.getStub(userId);
    return stub.getAllDrafts();
  }
}
