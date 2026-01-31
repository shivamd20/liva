/**
 * Judge Layer Integration Tests
 * 
 * Tests the complete judge pipeline against a real dev server.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// =============================================================================
// Test Configuration
// =============================================================================

const API_PORT = process.env.API_PORT || '5173';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;

// =============================================================================
// Helper Functions
// =============================================================================

interface RunCodeInput {
  problemId: string;
  code: string;
  language: 'java';
  customInput?: string;
}

interface TestResult {
  testId: string;
  passed: boolean;
  verdict: string;
  actualOutput?: unknown;
  expectedOutput?: unknown;
  timeMs: number;
  error?: string;
}

interface JudgeResponse {
  verdict: string;
  score: number;
  testResults: TestResult[];
  totalTimeMs: number;
  compilationError?: string;
  runtimeError?: string;
  userStdout?: string;
  stderr?: string;
}

async function runCode(input: RunCodeInput): Promise<JudgeResponse> {
  const response = await fetch(`${API_BASE}/codePractice.runCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`runCode failed: ${response.status} - ${text}`);
  }

  const json = await response.json() as { result: { data: JudgeResponse } };
  return json.result.data;
}

async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/codePractice.health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Judge Layer', () => {
  beforeAll(async () => {
    const healthy = await healthCheck();
    if (!healthy) {
      throw new Error('Dev server not running - start with: npm run dev');
    }
    console.log('Judge health check passed');
  });

  describe('Two Sum Problem', () => {
    const CORRECT_SOLUTION = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        java.util.Map<Integer, Integer> map = new java.util.HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        throw new IllegalArgumentException("No solution found");
    }
}`;

    const WRONG_ANSWER_SOLUTION = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        // Always returns wrong answer
        return new int[] { 0, 0 };
    }
}`;

    const COMPILE_ERROR_SOLUTION = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        // Missing semicolon
        return new int[] { 0, 1 }
    }
}`;

    const RUNTIME_ERROR_SOLUTION = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        // ArrayIndexOutOfBoundsException
        return new int[] { nums[1000], nums[1001] };
    }
}`;

    const NULL_POINTER_SOLUTION = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        String s = null;
        s.length(); // NPE
        return new int[] { 0, 1 };
    }
}`;

    it('should return AC for correct solution', async () => {
      const result = await runCode({
        problemId: 'two-sum',
        code: CORRECT_SOLUTION,
        language: 'java',
      });

      expect(result.verdict).toBe('AC');
      expect(result.score).toBe(1.0);
      expect(result.testResults.length).toBeGreaterThan(0);
      expect(result.testResults.every(r => r.passed)).toBe(true);
    }, 60000);

    it('should return WA for wrong answer', async () => {
      const result = await runCode({
        problemId: 'two-sum',
        code: WRONG_ANSWER_SOLUTION,
        language: 'java',
      });

      expect(result.verdict).toBe('WA');
      expect(result.score).toBeLessThan(1.0);
      expect(result.testResults.some(r => !r.passed)).toBe(true);
    }, 60000);

    it('should return CE for compilation error', async () => {
      const result = await runCode({
        problemId: 'two-sum',
        code: COMPILE_ERROR_SOLUTION,
        language: 'java',
      });

      expect(result.verdict).toBe('CE');
      expect(result.score).toBe(0);
      expect(result.compilationError).toBeDefined();
      expect(result.compilationError).toContain('error');
    }, 60000);

    it('should return RE for runtime error (ArrayIndexOutOfBounds)', async () => {
      const result = await runCode({
        problemId: 'two-sum',
        code: RUNTIME_ERROR_SOLUTION,
        language: 'java',
      });

      expect(result.verdict).toBe('RE');
      expect(result.score).toBe(0);
      // Either runtimeError or individual test errors
      const hasError = result.runtimeError || 
        result.testResults.some(r => r.error?.includes('ArrayIndexOutOfBoundsException'));
      expect(hasError).toBe(true);
    }, 60000);

    it('should return RE for NullPointerException', async () => {
      const result = await runCode({
        problemId: 'two-sum',
        code: NULL_POINTER_SOLUTION,
        language: 'java',
      });

      expect(result.verdict).toBe('RE');
      expect(result.score).toBe(0);
    }, 60000);

    it('should capture user stdout separately', async () => {
      const SOLUTION_WITH_PRINT = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        System.out.println("Debug: searching for target " + target);
        java.util.Map<Integer, Integer> map = new java.util.HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                System.out.println("Found at indices: " + map.get(complement) + ", " + i);
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        throw new IllegalArgumentException("No solution found");
    }
}`;

      const result = await runCode({
        problemId: 'two-sum',
        code: SOLUTION_WITH_PRINT,
        language: 'java',
      });

      expect(result.verdict).toBe('AC');
      // User's print statements should be captured
      expect(result.userStdout).toContain('Debug: searching for target');
    }, 60000);
  });

  describe('Verdict Priority', () => {
    it('should prioritize CE over other errors', async () => {
      // If code doesn't compile, it should be CE regardless of test cases
      const result = await runCode({
        problemId: 'two-sum',
        code: 'this is not valid java code at all!!!',
        language: 'java',
      });

      expect(result.verdict).toBe('CE');
    }, 60000);
  });

  describe('Output Comparison', () => {
    it('should handle unordered array comparison (two-sum uses it)', async () => {
      // Two-sum allows returning indices in any order
      const REVERSED_ORDER_SOLUTION = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        // Return indices in reverse order - should still pass due to unorderedArray comparator
        java.util.Map<Integer, Integer> map = new java.util.HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                // Return in reverse order: [i, earlier_index] instead of [earlier_index, i]
                return new int[] { i, map.get(complement) };
            }
            map.put(nums[i], i);
        }
        throw new IllegalArgumentException("No solution found");
    }
}`;

      const result = await runCode({
        problemId: 'two-sum',
        code: REVERSED_ORDER_SOLUTION,
        language: 'java',
      });

      // Should pass because comparator is unorderedArray
      expect(result.verdict).toBe('AC');
    }, 60000);
  });
});
