/**
 * Code Practice tRPC Router
 * 
 * Exposes endpoints for the code practice system.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { t, publicProcedure, authedProcedure, Context } from '../trpc-config';
import { CodePracticeService } from './service';
import { judge } from './judge/index'; // Explicit index import for clarity
import { judge as judgeFunc } from './judge/index'; // Double check import if needed, but 'judge' var name conflict
import type { Verdict, TestResult, SanityCheckResult } from './types';
import { ProblemStore } from '../lib/problem-store';
import { problems as staticProblemMap } from '../../problems/index'; // Import for seeding
import { CodePracticeAI } from './ai';

// Zod schemas
const languageSchema = z.enum(['java', 'javascript', 'typescript', 'python']);

const listProblemsInput = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  topic: z.string().optional(),
}).optional();

const getProblemInput = z.object({
  problemId: z.string(),
});

const sanityCheckInput = z.object({
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

// Helper for sanity check logic (reused in finalize)
async function performSanityCheck(input: { problemId: string }, ctx: Context): Promise<SanityCheckResult> {
  console.log(`[ROUTER] sanityCheck called: ${input.problemId}`);

  const registry = getRegistryDO(ctx.env);
  const store = new ProblemStore(ctx.env.files);

  // 1. Fetch Problem
  const problem = await store.fetchProblem(input.problemId);
  if (!problem) throw new Error(`Problem not found: ${input.problemId}`);

  // 2. Fetch Reference Solution (Java)
  const referenceCode = await store.fetchReferenceSolution(input.problemId);
  if (!referenceCode) throw new Error(`Reference solution not found for ${input.problemId}`);

  const starterCode = problem.starterCode?.['java'] || '';

  // 3. Execute Reference Solution
  const refResult = await judgeFunc(
    problem,
    referenceCode,
    'java',
    'all',
    ctx.env
  );

  // 4. Execute Starter Code
  const starterResult = await judgeFunc(
    problem,
    starterCode,
    'java',
    'all',
    ctx.env
  );

  // 5. Determine Sanity Status
  const isRefPassing = refResult.verdict === 'AC';
  const overallStatus = isRefPassing ? 'passed' : 'failed';

  // 6. Update Registry
  await registry.updateSanityStatus(input.problemId, {
    status: overallStatus,
    lastChecked: Date.now(),
    error: !isRefPassing ? `Reference solution failed with ${refResult.verdict}` : undefined,
  });

  return {
    problemId: input.problemId,
    reference: {
      verdict: refResult.verdict,
      score: refResult.score,
      error: refResult.runtimeError || refResult.compilationError,
    },
    starter: {
      verdict: starterResult.verdict,
      score: starterResult.score,
      error: starterResult.runtimeError || starterResult.compilationError,
    },
    overallStatus,
    timestamp: Date.now(),
  };
}

// Router
export const codePracticeRouter = t.router({

  /**
   * AI: Generate Problem Definition
   */
  generateProblem: authedProcedure
    .input(z.object({ intent: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Clean service call
      return CodePracticeAI.generateProblem(input.intent, ctx.env);
    }),

  /**
   * AI: Generate Implementation
   */
  generateImplementation: authedProcedure
    .input(z.object({
      problem: z.any(),
      tests: z.any().optional(),
      language: z.string().default('java')
    }))
    .mutation(async ({ input, ctx }) => {
      return CodePracticeAI.generateImplementation(input.problem, input.tests || [], input.language, ctx.env);
    }),

  /**
   * AI: Finalize Problem
   */
  finalize: authedProcedure
    .input(z.object({
      problem: z.any(),
      execution: z.any(),
      userName: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await CodePracticeAI.finalizeProblem({
        problem: input.problem,
        execution: input.execution,
        userId: ctx.userId,
        userName: input.userName || 'Unknown User'
      }, ctx.env);

      // Trigger Sanity Check in background
      if (ctx.executionCtx) {
        ctx.executionCtx.waitUntil(
          performSanityCheck({ problemId: result.problemId }, ctx).catch(err => {
            console.error(`[ROUTER] Background sanity check failed for ${result.problemId}:`, err);
          })
        );
      } else {
        // Fallback for dev/test
        performSanityCheck({ problemId: result.problemId }, ctx).catch(console.error);
      }

      return result;
    }),


  /**
   * List all problems with optional filtering
   * Uses ProblemRegistryDO
   */
  listProblems: publicProcedure
    .input(listProblemsInput)
    .query(async ({ input, ctx }) => {
      const registry = getRegistryDO(ctx.env);

      // Call DO list with userId for visibility filtering
      // Note: Visibility logic now shows all generated problems as per update
      const problems = await registry.list({
        difficulty: input?.difficulty,
        topic: input?.topic
      }, ctx.userId);

      return problems;
    }),

  /**
   * Get full problem details
   * Uses ProblemRegistryDO lookup -> R2 fetch
   */
  getProblem: publicProcedure
    .input(getProblemInput)
    .query(async ({ input, ctx }) => {
      const registry = getRegistryDO(ctx.env);

      // 1. Get metadata & R2 prefix from DO
      const entry = await registry.get(input.problemId);

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Problem not found: ${input.problemId}`,
        });
      }

      // 2. Fetch content from R2
      const store = new ProblemStore(ctx.env.files);
      const problem = await store.fetchProblem(input.problemId);

      if (!problem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Problem content unavailable`,
        });
      }

      // Return full problem with visible tests only
      const visibleTests = (problem.tests || []).filter(t => t.visibility === 'visible');

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
      // Fetch full problem for judging (need hidden tests too)
      const store = new ProblemStore(ctx.env.files);
      const problem = await store.fetchProblem(input.problemId);

      if (!problem) {
        throw new Error(`Problem not found: ${input.problemId}`);
      }

      // Check if problem has Java harness
      if (input.language === 'java' && !problem.javaHarness) {
        // Should return a proper error verdict
        return {
          verdict: 'CE' as Verdict,
          score: 0,
          testResults: [],
          totalTimeMs: 0,
          compilationError: `Problem ${input.problemId} does not have Java harness configured.`,
        };
      }

      // Only Java is supported in v1
      if (input.language !== 'java') {
        return {
          verdict: 'CE' as Verdict,
          score: 0,
          testResults: [],
          totalTimeMs: 0,
          compilationError: `Language ${input.language} is not supported yet. Only Java is available.`,
        };
      }

      // Run Judge
      const result = await judgeFunc(
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
      const store = new ProblemStore(ctx.env.files);
      const problem = await store.fetchProblem(input.problemId);

      if (!problem) {
        throw new Error(`Problem not found: ${input.problemId}`);
      }

      if (input.language === 'java' && !problem.javaHarness) {
        return {
          verdict: 'CE' as Verdict,
          score: 0,
          testResults: [],
          totalTimeMs: 0,
          compilationError: 'No harness found'
        };
      }

      if (input.language !== 'java') {
        return {
          verdict: 'CE' as Verdict,
          score: 0,
          testResults: [],
          totalTimeMs: 0,
          compilationError: 'Language not supported'
        };
      }

      const result = await judgeFunc(
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


  // ============ Sanity Check ============

  sanityCheck: authedProcedure
    .input(sanityCheckInput)
    .mutation(async ({ input, ctx }): Promise<SanityCheckResult> => {
      return performSanityCheck(input, ctx);
    }),


  // ============ ADMIN: Seed Migration ============

  /**
   * One-time migration script to upload static files to R2/DO
   */
  adminSeedProblems: authedProcedure
    .mutation(async ({ ctx }) => {
      console.log(`[ADMIN] Starting problem seeding...`);

      const registry = getRegistryDO(ctx.env);
      const store = new ProblemStore(ctx.env.files);

      const allProblems = Object.values(staticProblemMap);
      let count = 0;

      for (const problem of allProblems) {
        const r2Prefix = await store.storeProblem(problem);

        await registry.register({
          problemId: problem.problemId,
          title: problem.title,
          r2Prefix: r2Prefix,
          difficulty: problem.difficulty,
          topics: problem.topics,
          createdAt: Date.now(),
          status: 'active'
        });

        count++;
      }

      return { success: true, seeded: count };
    }),

});

export type CodePracticeRouter = typeof codePracticeRouter;
