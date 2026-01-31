/**
 * Code Execution Engine Types
 * 
 * Language-agnostic, judge-agnostic execution interface.
 * The engine does exactly one thing: compile + run + observe.
 * 
 * It does NOT know about:
 * - Test cases
 * - Expected outputs
 * - Correctness/scoring
 * - Problem semantics
 */

import { z } from 'zod';

// =============================================================================
// Supported Languages
// =============================================================================

export const SupportedLanguage = z.enum(['java', 'cpp', 'python', 'go']);
export type SupportedLanguage = z.infer<typeof SupportedLanguage>;

// =============================================================================
// File Specification
// =============================================================================

export const FileSpec = z.object({
  /** Relative path within execution workspace */
  path: z.string(),
  /** File contents */
  content: z.string(),
  /** Whether file should be executable (for scripts/binaries) */
  executable: z.boolean().optional(),
});
export type FileSpec = z.infer<typeof FileSpec>;

// =============================================================================
// Compile Phase Specification
// =============================================================================

export const CompileSpec = z.object({
  /** Shell command to run (e.g., "javac -cp /engine/libs/gson.jar Main.java") */
  cmd: z.string(),
  /** Maximum time allowed for compilation in milliseconds */
  timeoutMs: z.number().int().positive(),
});
export type CompileSpec = z.infer<typeof CompileSpec>;

// =============================================================================
// Run Phase Specification
// =============================================================================

export const RunSpec = z.object({
  /** Shell command to run (e.g., "java -cp .:/engine/libs/gson.jar Main") */
  cmd: z.string(),
  /** Optional stdin to pass to the process */
  stdin: z.string().optional(),
  /** Maximum time allowed for execution in milliseconds */
  timeoutMs: z.number().int().positive(),
});
export type RunSpec = z.infer<typeof RunSpec>;

// =============================================================================
// Resource Limits
// =============================================================================

export const ResourceLimits = z.object({
  /** CPU time limit in milliseconds (wall-clock time) */
  cpuMs: z.number().int().positive(),
  /** Memory limit in megabytes */
  memoryMb: z.number().int().positive(),
});
export type ResourceLimits = z.infer<typeof ResourceLimits>;

// =============================================================================
// Execution Request (Input Contract)
// =============================================================================

export const ExecutionRequest = z.object({
  /** Unique identifier for tracing and filesystem isolation */
  executionId: z.string(),

  /** Language runtime */
  language: SupportedLanguage,

  /** Files to materialize before execution */
  files: z.array(FileSpec),

  /** Compile command (optional - some languages don't need compilation) */
  compile: CompileSpec.optional(),

  /** Run command (required) */
  run: RunSpec,

  /** Resource limits */
  limits: ResourceLimits,

  /** Environment variables (optional) */
  env: z.record(z.string(), z.string()).optional(),

  /** Working directory relative to execution root (default: execution root) */
  cwd: z.string().optional(),
});
export type ExecutionRequest = z.infer<typeof ExecutionRequest>;

// =============================================================================
// Phase Result (Internal)
// =============================================================================

export interface PhaseResult {
  /** Whether the phase completed successfully (exit code 0) */
  success: boolean;
  /** Process exit code */
  exitCode: number;
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
  /** Wall-clock time in milliseconds */
  timeMs: number;
}

// =============================================================================
// Engine Error Types
// =============================================================================

export const EngineErrorType = z.enum(['timeout', 'oom', 'sandbox_error']);
export type EngineErrorType = z.infer<typeof EngineErrorType>;

export interface EngineError {
  type: EngineErrorType;
  message: string;
}

// =============================================================================
// Execution Result (Output Contract)
// =============================================================================

export interface ExecutionResult {
  /** Echo back the execution ID for correlation */
  executionId: string;

  /** Compilation phase result (if compilation was requested) */
  compile?: PhaseResult;

  /** Run phase result */
  run: PhaseResult;

  /** Engine-level errors (timeouts, OOM, sandbox failures) */
  error?: EngineError;
}

// =============================================================================
// Engine Constants
// =============================================================================

/** 
 * Path where engine-provided libraries are available.
 * Currently only Gson is provided for Java.
 */
export const ENGINE_LIBS_PATH = '/engine/libs';

/**
 * Gson JAR path for Java classpath
 */
export const GSON_JAR_PATH = `${ENGINE_LIBS_PATH}/gson.jar`;

/**
 * Execution workspace base path
 */
export const WORKSPACE_BASE = '/workspace/exec';

/**
 * Default timeouts (can be overridden per request)
 */
export const DEFAULT_COMPILE_TIMEOUT_MS = 10000; // 10 seconds
export const DEFAULT_RUN_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Default limits
 */
export const DEFAULT_MEMORY_LIMIT_MB = 256;
export const DEFAULT_CPU_LIMIT_MS = 5000;
