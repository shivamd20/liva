/**
 * Judge Layer Types
 * 
 * Types specific to the judge layer that sits on top of the execution engine.
 * The judge handles test case batching, output parsing, and verdict determination.
 */

// =============================================================================
// Protocol Constants (Frozen per v1 spec)
// =============================================================================

/** Sentinel marking the beginning of judge output */
export const SENTINEL_BEGIN = '<<<JUDGE_OUTPUT_V1_BEGIN>>>';

/** Sentinel marking the end of judge output */
export const SENTINEL_END = '<<<JUDGE_OUTPUT_V1_END>>>';

// =============================================================================
// Stdin Format (JSON sent to execution)
// =============================================================================

/**
 * Individual test case in stdin
 */
export interface JudgeTestCase {
  /** Test case ID (0-indexed) */
  id: number;
  /** Problem-specific input (matches problem's inputSpec) */
  input: unknown;
}

/**
 * Complete stdin JSON structure
 */
export interface JudgeStdin {
  testcases: JudgeTestCase[];
}

// =============================================================================
// Stdout Protocol (parsed from sentinel block)
// =============================================================================

/**
 * Status of a single test case execution
 */
export type CaseStatus = 'OK' | 'ERROR';

/**
 * Result of a single test case from the harness
 */
export interface CaseResult {
  /** Test case ID (matches input) */
  id: number;
  /** Execution status */
  status: CaseStatus;
  /** Output value (if status is OK) */
  output?: unknown;
  /** Error message (if status is ERROR) */
  error?: string;
}

/**
 * Metadata about the execution
 */
export interface JudgeMeta {
  /** Total execution time in milliseconds */
  timeMs: number;
  /** Memory usage in kilobytes (optional) */
  memoryKb?: number;
}

/**
 * Complete output structure from the harness
 */
export interface JudgeOutput {
  results: CaseResult[];
  meta: JudgeMeta;
}

// =============================================================================
// Parser Result
// =============================================================================

/**
 * Successful parse result
 */
export interface ParseSuccess {
  success: true;
  /** Parsed judge output */
  output: JudgeOutput;
  /** Everything before SENTINEL_BEGIN (user's console output) */
  userStdout: string;
}

/**
 * Parse error types
 */
export type ParseErrorType =
  | 'MISSING_SENTINEL'    // Sentinels not found
  | 'MALFORMED_JSON'      // JSON parse failed
  | 'INVALID_STRUCTURE';  // JSON doesn't match expected structure

/**
 * Failed parse result
 */
export interface ParseFailure {
  success: false;
  error: ParseErrorType;
  /** Everything we could capture as user stdout */
  userStdout: string;
  /** Additional error details */
  details?: string;
}

/**
 * Union type for parse result
 */
export type ParseResult = ParseSuccess | ParseFailure;

// =============================================================================
// Judge Result
// =============================================================================

import type { Verdict, TestResult, ComparatorSpec } from '../types';

/**
 * Input to the judge
 */
export interface JudgeInput {
  /** Problem ID */
  problemId: string;
  /** User's solution code */
  userCode: string;
  /** Programming language */
  language: 'java';  // v1 only supports Java
  /** Which tests to run */
  testFilter: 'all' | 'visible';
}

/**
 * Per-test-case judge result (before aggregation)
 */
export interface JudgedCase {
  /** Test case ID from problem */
  testId: string;
  /** Whether the test passed */
  passed: boolean;
  /** Verdict for this case */
  verdict: Verdict;
  /** Actual output from user's code */
  actualOutput?: unknown;
  /** Expected output from test case */
  expectedOutput?: unknown;
  /** Execution time for this case (if available) */
  timeMs?: number;
  /** Error message (for RE/ERROR cases) */
  error?: string;
}

/**
 * Complete judge result
 */
export interface JudgeResult {
  /** Overall verdict */
  verdict: Verdict;
  /** Score (0.0 to 1.0) */
  score: number;
  /** Per-test results */
  testResults: TestResult[];
  /** Total execution time */
  totalTimeMs: number;
  /** Compilation error (if CE) */
  compilationError?: string;
  /** Runtime error (if RE) */
  runtimeError?: string;
  /** User's console output (before sentinel) */
  userStdout?: string;
  /** Stderr output */
  stderr?: string;
}

// =============================================================================
// Harness Types
// =============================================================================

/**
 * Files prepared for execution
 */
export interface HarnessFiles {
  /** Files to write to sandbox */
  files: Array<{
    path: string;
    content: string;
  }>;
  /** Compile command */
  compileCmd: string;
  /** Run command */
  runCmd: string;
}

/**
 * Java-specific harness configuration
 */
export interface JavaHarnessConfig {
  /** Main.java content (from problem definition) */
  mainJava: string;
  /** Common.java content (generated helper classes) */
  commonJava: string;
  /** User's solution wrapped as UserSolution.java */
  userSolutionJava: string;
}
