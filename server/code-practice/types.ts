/**
 * Code Practice Type Definitions
 * 
 * This module defines the core types for the code practice system.
 * All problems follow a language-neutral format with LeetCode-compatible encoding.
 */

// =============================================================================
// Type Specifications (Language-Neutral)
// =============================================================================

export type TypeSpec =
  | { kind: 'int' }
  | { kind: 'long' }
  | { kind: 'float' }
  | { kind: 'double' }
  | { kind: 'string' }
  | { kind: 'char' }
  | { kind: 'boolean' }
  | { kind: 'array'; of: TypeSpec }
  | { kind: 'matrix'; of: TypeSpec }  // 2D array shorthand
  | { kind: 'tuple'; elements: TypeSpec[] }
  | { kind: 'object'; fields: Record<string, TypeSpec> }
  | { kind: 'tree' }           // Binary tree (LeetCode level-order encoding)
  | { kind: 'linkedList' }     // Singly linked list
  | { kind: 'graph' }          // Adjacency list representation
  | { kind: 'void' };          // For methods that return nothing

// =============================================================================
// Comparator Specifications
// =============================================================================

export type ComparatorSpec =
  | { type: 'exact' }
  | { type: 'numeric'; tolerance: number }
  | { type: 'unorderedArray' }
  | { type: 'set' }
  | { type: 'multiset' }
  | { type: 'floatArray'; tolerance: number };

// =============================================================================
// Function Signature
// =============================================================================

export interface FunctionParam {
  name: string;
  type: string;        // Java type string: "int[]", "TreeNode", etc.
  typeSpec: TypeSpec;  // Structured type for parsing
}

export interface FunctionSignature {
  name: string;
  params: FunctionParam[];
  returnType: string;
  returnTypeSpec: TypeSpec;
}

// =============================================================================
// Test Cases
// =============================================================================

export interface TestCase {
  testId: string;
  input: unknown[];           // Array of arguments (canonical JSON values)
  expected: unknown;          // Expected output (canonical JSON value)
  comparator: ComparatorSpec;
  visibility: 'visible' | 'hidden';
  weight: number;             // For partial scoring
  description?: string;       // Optional description for debugging
}

export interface Example {
  input: unknown[];
  output: unknown;
  explanation?: string;
}

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
  // Future: javascript, typescript, etc.
}

// Default file specs
export const DEFAULT_JAVA_FILE_SPEC: JavaFileSpec = {
  mainClass: 'Main',
  solutionClass: 'Solution',
};

// =============================================================================
// Problem Definition
// =============================================================================

export interface Problem {
  problemId: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topics: string[];
  description: string;        // Markdown
  constraints: string[];
  inputSpec: TypeSpec;        // Overall input structure
  outputSpec: TypeSpec;       // Overall output structure
  functionSignature: FunctionSignature;
  examples: Example[];
  tests: TestCase[];

  /**
   * Starter code per language - what users see when they begin the problem.
   * Should be runnable but produce wrong answer (returns placeholder values).
   */
  starterCode?: {
    java?: string;
  };

  /**
   * Reference solutions per language - correct solutions used for testing.
   * Not exposed to users.
   */
  referenceSolutions?: {
    java?: string;
  };

  hints?: string[];
  timeLimit?: number;         // ms, default 2000
  memoryLimit?: number;       // MB, default 256

  /**
   * Java harness code (Main.java content).
   * This is the judge-owned entry point that:
   * - Parses stdin JSON (testcases array)
   * - Iterates over each test case
   * - Calls user's solution method
   * - Catches exceptions per test
   * - Emits sentinel-delimited JSON output
   */
  javaHarness?: string;
}

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
