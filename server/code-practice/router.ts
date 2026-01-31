/**
 * Code Practice tRPC Router
 * 
 * Exposes endpoints for the code practice system.
 */

import { z } from 'zod';
import { t, publicProcedure, authedProcedure } from '../trpc-config';
import { getProblem, listProblems } from '../../problems';
import { CodePracticeService } from './service';
import { judge } from './judge';
import type { Language, Verdict, ExecutionResult, TestResult } from './types';

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

// Router
export const codePracticeRouter = t.router({
  /**
   * List all problems with optional filtering
   */
  listProblems: publicProcedure
    .input(listProblemsInput)
    .query(({ input }) => {
      console.log(`[ROUTER] listProblems called`, input);
      
      let result = listProblems();
      
      if (input?.difficulty) {
        result = result.filter(p => p.difficulty === input.difficulty);
      }
      
      if (input?.topic) {
        const topic = input.topic;
        result = result.filter(p => p.topics.includes(topic));
      }
      
      // Return summary without test cases
      const summary = result.map(p => ({
        problemId: p.problemId,
        title: p.title,
        difficulty: p.difficulty,
        topics: p.topics,
      }));
      
      console.log(`[ROUTER] Returning ${summary.length} problems`);
      return summary;
    }),

  /**
   * Get full problem details
   */
  getProblem: publicProcedure
    .input(getProblemInput)
    .query(({ input }) => {
      console.log(`[ROUTER] getProblem called: ${input.problemId}`);
      
      const problem = getProblem(input.problemId);
      if (!problem) {
        console.log(`[ROUTER] Problem not found: ${input.problemId}`);
        throw new Error(`Problem not found: ${input.problemId}`);
      }
      
      // Return full problem with visible tests only
      const visibleTests = problem.tests.filter(t => t.visibility === 'visible');
      
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
      console.log(`[ROUTER] Code length: ${input.code.length} chars`);
      
      const problem = getProblem(input.problemId);
      if (!problem) {
        console.log(`[ROUTER] Problem not found: ${input.problemId}`);
        throw new Error(`Problem not found: ${input.problemId}`);
      }

      // Check if problem has Java harness
      if (input.language === 'java' && !problem.javaHarness) {
        const result: ExecutionResult = {
          verdict: 'CE' as Verdict,
          score: 0,
          testResults: [] as TestResult[],
          totalTimeMs: 0,
          compilationError: `Problem ${input.problemId} does not have Java harness configured.`,
        };
        return result;
      }

      // Only Java is supported in v1
      if (input.language !== 'java') {
        const result: ExecutionResult = {
          verdict: 'CE' as Verdict,
          score: 0,
          testResults: [] as TestResult[],
          totalTimeMs: 0,
          compilationError: `Language ${input.language} is not supported yet. Only Java is available.`,
        };
        return result;
      }
      
      const startTime = Date.now();
      
      const result = await judge(
        problem,
        input.code,
        'java',
        'all',  // Run all tests for submission
        ctx.env
      );
      
      const duration = Date.now() - startTime;
      console.log(`[ROUTER] Execution completed in ${duration}ms`);
      console.log(`[ROUTER] Verdict: ${result.verdict}, Score: ${result.score}`);
      
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
        const test = problem.tests.find(t => t.testId === r.testId);
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
      console.log(`[ROUTER] runCode called: ${input.problemId}, ${input.language}`);
      console.log(`[ROUTER] Code length: ${input.code.length} chars`);
      
      const problem = getProblem(input.problemId);
      if (!problem) {
        console.log(`[ROUTER] Problem not found: ${input.problemId}`);
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
        'visible',  // Run only visible tests
        ctx.env
      );
      
      const duration = Date.now() - startTime;
      console.log(`[ROUTER] Execution completed in ${duration}ms`);
      console.log(`[ROUTER] Verdict: ${result.verdict}, Score: ${result.score}`);
      
      return result;
    }),

  /**
   * Health check endpoint
   */
  health: publicProcedure.query(() => {
    console.log(`[ROUTER] health check called`);
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      problemCount: listProblems().length,
    };
  }),

  // ============ Draft Management (requires auth) ============

  /**
   * Save a code draft (auto-save as user types)
   */
  saveDraft: authedProcedure
    .input(saveDraftInput)
    .mutation(async ({ input, ctx }) => {
      console.log(`[ROUTER] saveDraft called: ${input.problemId}, ${input.language}, userId=${ctx.userId}`);
      const service = new CodePracticeService(ctx.env);
      await service.saveDraft(ctx.userId, input.problemId, input.language, input.code);
      return { success: true };
    }),

  /**
   * Get saved draft for a problem
   */
  getDraft: authedProcedure
    .input(getDraftInput)
    .query(async ({ input, ctx }) => {
      console.log(`[ROUTER] getDraft called: ${input.problemId}, ${input.language}, userId=${ctx.userId}`);
      const service = new CodePracticeService(ctx.env);
      const code = await service.getDraft(ctx.userId, input.problemId, input.language);
      return { code };
    }),

  /**
   * Delete a draft (e.g., after successful submission)
   */
  deleteDraft: authedProcedure
    .input(getDraftInput)
    .mutation(async ({ input, ctx }) => {
      console.log(`[ROUTER] deleteDraft called: ${input.problemId}, ${input.language}, userId=${ctx.userId}`);
      const service = new CodePracticeService(ctx.env);
      await service.deleteDraft(ctx.userId, input.problemId, input.language);
      return { success: true };
    }),

  // ============ Progress & Stats (requires auth) ============

  /**
   * Get submission history for a problem
   */
  getSubmissions: authedProcedure
    .input(getSubmissionsInput)
    .query(async ({ input, ctx }) => {
      console.log(`[ROUTER] getSubmissions called: ${input.problemId}, userId=${ctx.userId}`);
      const service = new CodePracticeService(ctx.env);
      const submissions = await service.getSubmissions(ctx.userId, input.problemId, input.limit);
      return { submissions };
    }),

  /**
   * Get list of solved problem IDs
   */
  getSolvedProblems: authedProcedure.query(async ({ ctx }) => {
    console.log(`[ROUTER] getSolvedProblems called, userId=${ctx.userId}`);
    const service = new CodePracticeService(ctx.env);
    const solvedIds = await service.getSolvedProblems(ctx.userId);
    return { solvedIds };
  }),

  /**
   * Get user stats (solved, attempted, submissions count)
   */
  getStats: authedProcedure.query(async ({ ctx }) => {
    console.log(`[ROUTER] getStats called, userId=${ctx.userId}`);
    const service = new CodePracticeService(ctx.env);
    const stats = await service.getStats(ctx.userId);
    return stats;
  }),
});

export type CodePracticeRouter = typeof codePracticeRouter;
