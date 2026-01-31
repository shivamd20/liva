/**
 * Code Practice tRPC Router
 * 
 * Exposes endpoints for the code practice system.
 */

import { z } from 'zod';
import { t, publicProcedure, authedProcedure } from '../trpc-config';
import { listProblems as staticListProblems } from '../../problems'; // Renamed for migration usage
import { CodePracticeService } from './service';
import { judge } from './judge';
import type { Language, Verdict, ExecutionResult, TestResult, Problem } from './types';
import { ProblemStore } from '../lib/problem-store';
import { problems as staticProblemMap } from '../../problems/index'; // Import for seeding

// Zod schemas
const languageSchema = z.enum(['java', 'javascript', 'typescript', 'python']);

const listProblemsInput = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  topic: z.string().optional(),
}).optional();

const getProblemInput = z.object({
  problemId: z.string(),
});

const submitCodeInput = z.object({
  problemId: z.string(),
  code: z.string(),
  language: languageSchema,
});

const runCodeInput = z.object({
  problemId: z.string(),
  code: z.string(),
  language: languageSchema,
  customInput: z.string().optional(),
});

// Draft management inputs
const saveDraftInput = z.object({
  problemId: z.string(),
  language: languageSchema,
  code: z.string(),
});

const getDraftInput = z.object({
  problemId: z.string(),
  language: languageSchema,
});

const getSubmissionsInput = z.object({
  problemId: z.string(),
  limit: z.number().min(1).max(50).optional(),
});

// Helper to get Registry DO
function getRegistryDO(env: Env) {
  const id = env.PROBLEM_REGISTRY_DO.idFromName('singleton'); // Singleton instance
  return env.PROBLEM_REGISTRY_DO.get(id);
}

// Router
export const codePracticeRouter = t.router({
  /**
   * List all problems with optional filtering
   * Uses ProblemRegistryDO
   */
  listProblems: publicProcedure
    .input(listProblemsInput)
    .query(async ({ input, ctx }) => {
      console.log(`[ROUTER] listProblems called`, input);

      const registry = getRegistryDO(ctx.env);

      // Call DO list
      const problems = await registry.list({
        difficulty: input?.difficulty,
        topic: input?.topic
      });

      console.log(`[ROUTER] Returning ${problems.length} problems`);
      return problems;
    }),

  /**
   * Get full problem details
   * Uses ProblemRegistryDO lookup -> R2 fetch
   */
  getProblem: publicProcedure
    .input(getProblemInput)
    .query(async ({ input, ctx }) => {
      console.log(`[ROUTER] getProblem called: ${input.problemId}`);

      const registry = getRegistryDO(ctx.env);

      // 1. Get metadata & R2 prefix from DO
      const entry = await registry.get(input.problemId);

      if (!entry) {
        console.log(`[ROUTER] Problem not found in Registry: ${input.problemId}`);
        throw new Error(`Problem not found: ${input.problemId}`);
      }

      // 2. Fetch content from R2
      const store = new ProblemStore(ctx.env.files);
      const problem = await store.fetchProblem(input.problemId); // using ID as key logic inside store for now

      if (!problem) {
        console.log(`[ROUTER] Problem content missing in R2: ${input.problemId}`);
        throw new Error(`Problem content unavailable`);
      }

      // Return full problem with visible tests only
      const visibleTests = (problem.tests || []).filter(t => t.visibility === 'visible');

      console.log(`[ROUTER] Returning problem with ${visibleTests.length} visible tests`);
      return {
        ...problem,
        tests: visibleTests,
        // Don't expose reference solutions
        referenceSolutions: undefined,
      };
    }),

  /**
   * Submit code for execution (runs all tests)
   * Records submission in user's progress DO
   */
  submitCode: authedProcedure
    .input(submitCodeInput)
    .mutation(async ({ input, ctx }) => {
      console.log(`[ROUTER] submitCode called: ${input.problemId}, ${input.language}, userId=${ctx.userId}`);

      // Fetch full problem for judging (need hidden tests too)
      const store = new ProblemStore(ctx.env.files);
      const problem = await store.fetchProblem(input.problemId);

      if (!problem) {
        throw new Error(`Problem not found: ${input.problemId}`);
      }

      // Check if problem has Java harness
      if (input.language === 'java' && !problem.javaHarness) {
        return {
          verdict: 'CE' as Verdict,
          score: 0,
          testResults: [] as TestResult[],
          totalTimeMs: 0,
          compilationError: `Problem ${input.problemId} does not have Java harness configured.`,
        };
      }

      // Only Java is supported in v1
      if (input.language !== 'java') {
        return {
          verdict: 'CE' as Verdict,
          score: 0,
          testResults: [] as TestResult[],
          totalTimeMs: 0,
          compilationError: `Language ${input.language} is not supported yet. Only Java is available.`,
        };
      }

      const startTime = Date.now();

      const result = await judge(
        problem,
        input.code,
        'java',
        'all',  // Run all tests for submission
        ctx.env
      );

      // Record submission in user's progress DO
      const service = new CodePracticeService(ctx.env);
      await service.recordSubmission(ctx.userId, {
        id: crypto.randomUUID(),
        problemId: input.problemId,
        language: input.language,
        code: input.code,
        verdict: result.verdict,
        score: result.score,
        timeMs: result.totalTimeMs,
        submittedAt: Date.now(),
      });

      // For hidden tests, only return pass/fail, not details
      const sanitizedResults = result.testResults.map(r => {
        const test = (problem.tests || []).find(t => t.testId === r.testId);
        if (test?.visibility === 'hidden') {
          return {
            testId: r.testId,
            passed: r.passed,
            verdict: r.verdict,
            timeMs: r.timeMs,
            // Don't expose hidden test details
            expectedOutput: undefined,
            actualOutput: undefined,
            stdout: undefined,
            stderr: undefined,
          };
        }
        return r;
      });

      return {
        ...result,
        testResults: sanitizedResults,
      };
    }),

  /**
   * Run code (visible tests only, for quick testing)
   */
  runCode: publicProcedure
    .input(runCodeInput)
    .mutation(async ({ input, ctx }) => {
      console.log(`[ROUTER] runCode called: ${input.problemId}`);

      const store = new ProblemStore(ctx.env.files);
      const problem = await store.fetchProblem(input.problemId);

      if (!problem) {
        throw new Error(`Problem not found: ${input.problemId}`);
      }

      if (input.language === 'java' && !problem.javaHarness) {
        return {
          verdict: 'CE' as Verdict,
          score: 0,
          testResults: [] as TestResult[],
          totalTimeMs: 0,
          compilationError: `Problem ${input.problemId} does not have Java harness configured.`,
        };
      }

      if (input.language !== 'java') {
        return {
          verdict: 'CE' as Verdict,
          score: 0,
          testResults: [] as TestResult[],
          totalTimeMs: 0,
          compilationError: `Language ${input.language} is not supported yet.`,
        };
      }

      const result = await judge(
        problem,
        input.code,
        'java',
        'visible',  // Run only visible tests
        ctx.env
      );

      return result;
    }),

  /**
   * Health check endpoint
   */
  health: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // ============ Draft Management ============

  saveDraft: authedProcedure
    .input(saveDraftInput)
    .mutation(async ({ input, ctx }) => {
      const service = new CodePracticeService(ctx.env);
      await service.saveDraft(ctx.userId, input.problemId, input.language, input.code);
      return { success: true };
    }),

  getDraft: authedProcedure
    .input(getDraftInput)
    .query(async ({ input, ctx }) => {
      const service = new CodePracticeService(ctx.env);
      const code = await service.getDraft(ctx.userId, input.problemId, input.language);
      return { code };
    }),

  deleteDraft: authedProcedure
    .input(getDraftInput)
    .mutation(async ({ input, ctx }) => {
      const service = new CodePracticeService(ctx.env);
      await service.deleteDraft(ctx.userId, input.problemId, input.language);
      return { success: true };
    }),

  // ============ Progress & Stats ============

  getSubmissions: authedProcedure
    .input(getSubmissionsInput)
    .query(async ({ input, ctx }) => {
      const service = new CodePracticeService(ctx.env);
      const submissions = await service.getSubmissions(ctx.userId, input.problemId, input.limit);
      return { submissions };
    }),

  getSolvedProblems: authedProcedure.query(async ({ ctx }) => {
    const service = new CodePracticeService(ctx.env);
    const solvedIds = await service.getSolvedProblems(ctx.userId);
    return { solvedIds };
  }),

  getStats: authedProcedure.query(async ({ ctx }) => {
    const service = new CodePracticeService(ctx.env);
    const stats = await service.getStats(ctx.userId);
    return stats;
  }),


  // ============ ADMIN: Seed Migration ============

  /**
   * One-time migration script to upload static files to R2/DO
   */
  adminSeedProblems: authedProcedure
    .mutation(async ({ ctx }) => {
      // Simple security check (could be stronger)
      // In real app, check ctx.user.role === 'admin'
      console.log(`[ADMIN] Starting problem seeding...`);

      const registry = getRegistryDO(ctx.env);
      const store = new ProblemStore(ctx.env.files);

      const allProblems = Object.values(staticProblemMap);
      let count = 0;

      for (const problem of allProblems) {
        console.log(`[ADMIN] seeding ${problem.problemId}...`);

        // 1. Upload to R2
        const r2Prefix = await store.storeProblem(problem);

        // 2. Register in DO
        await registry.register({
          problemId: problem.problemId,
          title: problem.title,
          r2Prefix: r2Prefix,
          difficulty: problem.difficulty,
          topics: problem.topics,
          createdAt: Date.now(), // or specific time if we had it
          status: 'active'
        });

        count++;
      }

      return { success: true, seeded: count };
    }),

});

export type CodePracticeRouter = typeof codePracticeRouter;
