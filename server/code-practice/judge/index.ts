/**
 * Judge Orchestrator
 * 
 * Main entry point for the judge layer.
 * Coordinates harness building, execution, parsing, and verdict determination.
 */

import { createEngine } from '../engine';
import type { ExecutionRequest as EngineRequest } from '../engine/types';
import type { Problem, TestCase, Verdict, TestResult } from '../types';
import type { JudgeResult, JudgeInput, CaseResult } from './types';
import { buildJavaHarness, buildStdin } from './harness';
import { parseJudgeOutput } from './parser';
import { compare } from './comparators';

// =============================================================================
// Main Judge Function
// =============================================================================

/**
 * Judge a user's submission against a problem.
 * 
 * @param problem - The problem definition
 * @param userCode - User's solution code
 * @param language - Programming language (v1: only 'java')
 * @param testFilter - Which tests to run ('all' or 'visible')
 * @param env - Cloudflare environment
 * @returns JudgeResult with verdict and per-test results
 */
export async function judge(
  problem: Problem,
  userCode: string,
  language: 'java',
  testFilter: 'all' | 'visible',
  env: Env
): Promise<JudgeResult> {
  const startTime = Date.now();

  // Get tests to run
  const allTests = problem.tests || [];
  const tests = testFilter === 'all'
    ? allTests
    : allTests.filter(t => t.visibility === 'visible');

  if (tests.length === 0) {
    return {
      verdict: 'AC',
      score: 1.0,
      testResults: [],
      totalTimeMs: 0,
    };
  }

  try {
    // 1. Build harness files
    const harness = buildJavaHarness(problem, userCode);

    // 2. Build stdin
    const stdin = buildStdin(problem, testFilter);

    // 3. Create execution request
    const executionId = `judge_${problem.problemId}_${Date.now()}`;
    const engineRequest: EngineRequest = {
      executionId,
      language: 'java',
      files: harness.files,
      compile: {
        cmd: harness.compileCmd,
        timeoutMs: problem.timeLimit ? problem.timeLimit * 2 : 20000,
      },
      run: {
        cmd: harness.runCmd,
        stdin,
        timeoutMs: problem.timeLimit ? problem.timeLimit * tests.length : 30000,
      },
      limits: {
        cpuMs: problem.timeLimit ? problem.timeLimit * tests.length : 30000,
        memoryMb: problem.memoryLimit || 256,
      },
    };

    // 4. Execute
    const engine = createEngine(env);
    const execResult = await engine.execute(engineRequest);

    // 5. Handle compilation error
    if (execResult.compile && !execResult.compile.success) {
      return {
        verdict: 'CE',
        score: 0,
        testResults: tests.map(t => ({
          testId: t.testId,
          passed: false,
          verdict: 'CE' as Verdict,
          timeMs: 0,
        })),
        totalTimeMs: Date.now() - startTime,
        compilationError: execResult.compile.stderr || 'Compilation failed',
        stderr: execResult.compile.stderr,
      };
    }

    // 6. Handle engine-level errors (timeout, OOM)
    if (execResult.error) {
      const verdict = execResult.error.type === 'timeout' ? 'TLE' :
        execResult.error.type === 'oom' ? 'MLE' : 'RE';
      return {
        verdict,
        score: 0,
        testResults: tests.map(t => ({
          testId: t.testId,
          passed: false,
          verdict,
          timeMs: 0,
        })),
        totalTimeMs: Date.now() - startTime,
        runtimeError: execResult.error.message,
        stderr: execResult.run.stderr,
      };
    }

    // 7. Handle runtime crash (non-zero exit without output)
    if (!execResult.run.success && !execResult.run.stdout.includes('<<<JUDGE_OUTPUT_V1_BEGIN>>>')) {
      return {
        verdict: 'RE',
        score: 0,
        testResults: tests.map(t => ({
          testId: t.testId,
          passed: false,
          verdict: 'RE' as Verdict,
          timeMs: 0,
          error: execResult.run.stderr || 'Runtime error',
        })),
        totalTimeMs: Date.now() - startTime,
        runtimeError: execResult.run.stderr || 'Runtime error',
        userStdout: execResult.run.stdout,
        stderr: execResult.run.stderr,
      };
    }

    // 8. Parse output
    const parseResult = parseJudgeOutput(execResult.run.stdout);

    if (!parseResult.success) {
      // Protocol error - treat as RE
      return {
        verdict: 'RE',
        score: 0,
        testResults: tests.map(t => ({
          testId: t.testId,
          passed: false,
          verdict: 'RE' as Verdict,
          timeMs: 0,
          error: `Protocol error: ${parseResult.error}`,
        })),
        totalTimeMs: Date.now() - startTime,
        runtimeError: `Protocol error: ${parseResult.error}${parseResult.details ? ` - ${parseResult.details}` : ''}`,
        userStdout: parseResult.userStdout,
        stderr: execResult.run.stderr,
      };
    }

    // 9. Compare results
    const testResults = judgeResults(tests, parseResult.output.results);

    // 10. Aggregate verdict
    const { verdict, score } = aggregateVerdict(testResults, tests);

    return {
      verdict,
      score,
      testResults,
      totalTimeMs: Date.now() - startTime,
      userStdout: parseResult.userStdout,
      stderr: execResult.run.stderr,
    };

  } catch (error) {
    // Unexpected error
    return {
      verdict: 'RE',
      score: 0,
      testResults: tests.map(t => ({
        testId: t.testId,
        passed: false,
        verdict: 'RE' as Verdict,
        timeMs: 0,
      })),
      totalTimeMs: Date.now() - startTime,
      runtimeError: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Result Comparison
// =============================================================================

/**
 * Compare execution results with expected values.
 */
function judgeResults(tests: TestCase[], results: CaseResult[]): TestResult[] {
  return tests.map((test, index) => {
    const result = results.find(r => r.id === index);

    if (!result) {
      // Missing result for this test case
      return {
        testId: test.testId,
        passed: false,
        verdict: 'RE' as Verdict,
        timeMs: 0,
        error: 'No output for this test case',
      };
    }

    if (result.status === 'ERROR') {
      // Runtime error for this test case
      return {
        testId: test.testId,
        passed: false,
        verdict: 'RE' as Verdict,
        actualOutput: undefined,
        expectedOutput: test.expected,
        timeMs: 0,
        error: result.error || 'Runtime error',
      };
    }

    // Compare output
    const passed = compare(result.output, test.expected, test.comparator);

    return {
      testId: test.testId,
      passed,
      verdict: passed ? 'AC' as Verdict : 'WA' as Verdict,
      actualOutput: result.output,
      expectedOutput: test.expected,
      timeMs: 0, // Individual timing not available in v1
    };
  });
}

// =============================================================================
// Verdict Aggregation
// =============================================================================

/**
 * Determine overall verdict from individual test results.
 */
function aggregateVerdict(
  testResults: TestResult[],
  tests: TestCase[]
): { verdict: Verdict; score: number } {
  if (testResults.length === 0) {
    return { verdict: 'AC', score: 1.0 };
  }

  // Check for any non-AC verdicts
  const hasRE = testResults.some(r => r.verdict === 'RE');
  const hasTLE = testResults.some(r => r.verdict === 'TLE');
  const hasMLE = testResults.some(r => r.verdict === 'MLE');
  const hasWA = testResults.some(r => r.verdict === 'WA');

  // Calculate score based on weights
  let totalWeight = 0;
  let passedWeight = 0;

  for (let i = 0; i < testResults.length; i++) {
    const weight = tests[i]?.weight || 1;
    totalWeight += weight;
    if (testResults[i].passed) {
      passedWeight += weight;
    }
  }

  const score = totalWeight > 0 ? passedWeight / totalWeight : 0;

  // Determine verdict
  if (score === 1.0) {
    return { verdict: 'AC', score };
  }

  // Priority: RE > TLE > MLE > WA > PA
  if (hasRE) return { verdict: 'RE', score };
  if (hasTLE) return { verdict: 'TLE', score };
  if (hasMLE) return { verdict: 'MLE', score };
  if (hasWA) {
    // Partial accepted if some tests pass
    if (score > 0) {
      return { verdict: 'PA', score };
    }
    return { verdict: 'WA', score };
  }

  return { verdict: 'WA', score };
}

// =============================================================================
// Exports
// =============================================================================

export { compare } from './comparators';
export { parseJudgeOutput, hasSentinels, extractUserStdout } from './parser';
export { buildJavaHarness, buildStdin } from './harness';
export * from './types';
