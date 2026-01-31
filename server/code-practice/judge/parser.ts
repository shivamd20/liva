/**
 * Output Parser
 * 
 * Extracts and parses the judge output from sentinel-delimited stdout.
 * Everything before the BEGIN sentinel is treated as user stdout.
 */

import {
  SENTINEL_BEGIN,
  SENTINEL_END,
  type JudgeOutput,
  type ParseResult,
  type CaseResult,
  type JudgeMeta,
} from './types';

/**
 * Parse the raw stdout from execution to extract judge output.
 * 
 * Rules:
 * - Scan from END of stdout for SENTINEL_END
 * - Find matching SENTINEL_BEGIN
 * - Everything before SENTINEL_BEGIN is user stdout
 * - JSON between sentinels is judge output
 * 
 * @param stdout - Raw stdout from execution
 * @returns ParseResult with either success or failure
 */
export function parseJudgeOutput(stdout: string): ParseResult {
  // Find the end sentinel first (scan from end)
  const endIndex = stdout.lastIndexOf(SENTINEL_END);

  if (endIndex === -1) {
    return {
      success: false,
      error: 'MISSING_SENTINEL',
      userStdout: stdout,
      details: 'SENTINEL_END not found in stdout',
    };
  }

  // Find the begin sentinel before the end sentinel
  const searchArea = stdout.substring(0, endIndex);
  const beginIndex = searchArea.lastIndexOf(SENTINEL_BEGIN);

  if (beginIndex === -1) {
    return {
      success: false,
      error: 'MISSING_SENTINEL',
      userStdout: stdout,
      details: 'SENTINEL_BEGIN not found before SENTINEL_END',
    };
  }

  // Extract user stdout (everything before BEGIN sentinel)
  const userStdout = stdout.substring(0, beginIndex).trim();

  // Extract JSON between sentinels
  const jsonStart = beginIndex + SENTINEL_BEGIN.length;
  const jsonContent = stdout.substring(jsonStart, endIndex).trim();

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (e) {
    return {
      success: false,
      error: 'MALFORMED_JSON',
      userStdout,
      details: e instanceof Error ? e.message : 'JSON parse failed',
    };
  }

  // Validate structure
  const validation = validateJudgeOutput(parsed);
  if (!validation.valid) {
    return {
      success: false,
      error: 'INVALID_STRUCTURE',
      userStdout,
      details: validation.error,
    };
  }

  return {
    success: true,
    output: parsed as JudgeOutput,
    userStdout,
  };
}

/**
 * Validate that parsed JSON matches JudgeOutput structure.
 */
function validateJudgeOutput(obj: unknown): { valid: true } | { valid: false; error: string } {
  if (typeof obj !== 'object' || obj === null) {
    return { valid: false, error: 'Root must be an object' };
  }

  const root = obj as Record<string, unknown>;

  // Check results array
  if (!Array.isArray(root.results)) {
    return { valid: false, error: 'Missing or invalid "results" array' };
  }

  // Validate each result
  for (let i = 0; i < root.results.length; i++) {
    const result = root.results[i] as Record<string, unknown>;

    if (typeof result !== 'object' || result === null) {
      return { valid: false, error: `results[${i}] must be an object` };
    }

    if (typeof result.id !== 'number') {
      return { valid: false, error: `results[${i}].id must be a number` };
    }

    if (result.status !== 'OK' && result.status !== 'ERROR') {
      return { valid: false, error: `results[${i}].status must be 'OK' or 'ERROR'` };
    }
  }

  // Check meta object
  if (typeof root.meta !== 'object' || root.meta === null) {
    return { valid: false, error: 'Missing or invalid "meta" object' };
  }

  const meta = root.meta as Record<string, unknown>;
  if (typeof meta.timeMs !== 'number') {
    return { valid: false, error: 'meta.timeMs must be a number' };
  }

  return { valid: true };
}

/**
 * Check if stdout contains the judge output sentinels.
 * Useful for quick checks before full parsing.
 */
export function hasSentinels(stdout: string): boolean {
  return stdout.includes(SENTINEL_BEGIN) && stdout.includes(SENTINEL_END);
}

/**
 * Extract just the user stdout portion (everything before sentinel).
 * Returns full stdout if no sentinel found.
 */
export function extractUserStdout(stdout: string): string {
  const beginIndex = stdout.indexOf(SENTINEL_BEGIN);
  if (beginIndex === -1) {
    return stdout;
  }
  return stdout.substring(0, beginIndex).trim();
}
