/**
 * Code Practice Type Definitions
 * 
 * This module defines the core types for the code practice system.
 * Types are now derived from Zod schemas for runtime validation.
 */

import { z } from 'zod';
import {
  ProblemSchema,
  TestCaseSchema,
  ExampleSchema,
  TypeSpecSchema,
  ComparatorSpecSchema,
  FunctionSignatureSchema,
  FunctionParamSchema
} from './schema';

// Export Zod-inferred types
export type Problem = z.infer<typeof ProblemSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type Example = z.infer<typeof ExampleSchema>;
export type TypeSpec = z.infer<typeof TypeSpecSchema>;
export type ComparatorSpec = z.infer<typeof ComparatorSpecSchema>;
export type FunctionSignature = z.infer<typeof FunctionSignatureSchema>;
export type FunctionParam = z.infer<typeof FunctionParamSchema>;

// =============================================================================
// File Specifications (Per-Language)
// =============================================================================

export interface JavaFileSpec {
  /** Main entry point class name (default: "Main") */
  mainClass: string;
  /** User solution class name (default: "Solution") */
  solutionClass: string;
  /** Additional imports to add to the main file */
  imports?: string[];
  /** Custom helper classes (TreeNode, ListNode are built-in) */
  customHelpers?: Array<{
    className: string;
    code: string;
  }>;
}

export interface PythonFileSpec {
  /** Main entry point file name (default: "main.py") */
  mainFile: string;
  /** User solution file name (default: "solution.py") */
  solutionFile: string;
}

export interface FileSpecs {
  java?: JavaFileSpec;
  python?: PythonFileSpec;
}

// Default file specs
export const DEFAULT_JAVA_FILE_SPEC: JavaFileSpec = {
  mainClass: 'Main',
  solutionClass: 'Solution',
};

// =============================================================================
// Execution Types
// =============================================================================

export type Language = 'java' | 'javascript' | 'typescript' | 'python';

export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'PA';

export interface TestResult {
  testId: string;
  passed: boolean;
  verdict: Verdict;
  actualOutput?: unknown;
  expectedOutput?: unknown;
  stdout?: string;
  stderr?: string;
  timeMs: number;
  memoryMb?: number;
  error?: string;
}

export interface ExecutionResult {
  verdict: Verdict;
  score: number;              // 0.0 to 1.0
  testResults: TestResult[];
  totalTimeMs: number;
  compilationError?: string;
  runtimeError?: string;
}

export interface ExecutionRequest {
  code: string;
  language: Language;
  problem: Problem;
  testFilter: 'all' | 'visible';
  customInput?: string;
  timeout?: number;
}

// =============================================================================
// Logging Types
// =============================================================================

export interface ExecutionLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  phase: 'compile' | 'execute' | 'judge' | 'parse';
  message: string;
  data?: Record<string, unknown>;
}

export type LogCollector = (log: ExecutionLog) => void;

// Helper to create a logger
export function createLogger(collector?: LogCollector): LogCollector {
  return (log: ExecutionLog) => {
    const prefix = `[${log.phase.toUpperCase()}] [${log.level.toUpperCase()}]`;
    const msg = `${prefix} ${log.message}`;

    if (log.level === 'error') {
      console.error(msg, log.data || '');
    } else if (log.level === 'warn') {
      console.warn(msg, log.data || '');
    } else {
      console.log(msg, log.data || '');
    }

    collector?.(log);
  };
}
