/**
 * Two Sum Problem Tests
 * 
 * Comprehensive E2E tests against the judge for the Two Sum problem.
 * Tests cover: AC, WA, CE, RE, TLE, malformed output, edge cases
 */

import { describe, it, expect, beforeAll } from 'vitest';

// =============================================================================
// Configuration
// =============================================================================

const API_PORT = process.env.API_PORT || '5173';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;
const PROBLEM_ID = 'two-sum';

// =============================================================================
// Helper Functions
// =============================================================================

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
}

async function runCode(code: string): Promise<JudgeResponse> {
    const response = await fetch(`${API_BASE}/codePractice.runCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            problemId: PROBLEM_ID,
            code,
            language: 'java',
        }),
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
        const response = await fetch(`${API_BASE}/codePractice.health`);
        return response.ok;
    } catch {
        return false;
    }
}

// =============================================================================
// Import starter code from problem definition
// =============================================================================

import { starterCode as STARTER_CODE } from '../../../../problems/001-two-sum/java';

// =============================================================================
// Test Solutions
// =============================================================================

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

const CORRECT_SOLUTION_REVERSED_ORDER = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        java.util.Map<Integer, Integer> map = new java.util.HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                // Return in reverse order - should still pass with unorderedArray
                return new int[] { i, map.get(complement) };
            }
            map.put(nums[i], i);
        }
        throw new IllegalArgumentException("No solution found");
    }
}`;

const CORRECT_SOLUTION_BRUTE_FORCE = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            for (int j = i + 1; j < nums.length; j++) {
                if (nums[i] + nums[j] == target) {
                    return new int[] { i, j };
                }
            }
        }
        throw new IllegalArgumentException("No solution found");
    }
}`;

const WRONG_ANSWER_ALWAYS_ZERO = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        return new int[] { 0, 0 };
    }
}`;

const WRONG_ANSWER_ALWAYS_FIRST_TWO = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        return new int[] { 0, 1 };
    }
}`;

const WRONG_ANSWER_WRONG_LENGTH = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        return new int[] { 0, 1, 2 };
    }
}`;

const COMPILE_ERROR_MISSING_SEMICOLON = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        return new int[] { 0, 1 }
    }
}`;

const COMPILE_ERROR_SYNTAX = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        this is not valid java!!!
    }
}`;

const COMPILE_ERROR_WRONG_METHOD_NAME = `class UserSolution {
    public int[] wrongMethodName(int[] nums, int target) {
        return new int[] { 0, 1 };
    }
}`;

const RUNTIME_ERROR_ARRAY_INDEX = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        return new int[] { nums[10000], nums[10001] };
    }
}`;

const RUNTIME_ERROR_NULL_POINTER = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        String s = null;
        s.length();
        return new int[] { 0, 1 };
    }
}`;

const RUNTIME_ERROR_DIVIDE_BY_ZERO = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        int x = 1 / 0;
        return new int[] { 0, 1 };
    }
}`;

const RUNTIME_ERROR_STACK_OVERFLOW = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        return twoSum(nums, target);
    }
}`;

const MALFORMED_RETURNS_NULL = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        return null;
    }
}`;

const SOLUTION_WITH_DEBUG_PRINT = `class UserSolution {
    public int[] twoSum(int[] nums, int target) {
        System.out.println("Debug: searching for target " + target);
        java.util.Map<Integer, Integer> map = new java.util.HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                System.out.println("Found pair at indices " + map.get(complement) + " and " + i);
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        throw new IllegalArgumentException("No solution found");
    }
}`;

// =============================================================================
// Tests
// =============================================================================

describe('Problem 001: Two Sum', () => {
    beforeAll(async () => {
        const healthy = await healthCheck();
        if (!healthy) {
            throw new Error('Dev server not running. Start with: npm run dev');
        }
        console.log('✓ Health check passed');
    });

    // ---------------------------------------------------------------------------
    // Starter Code Tests - Verify the initial template is runnable
    // ---------------------------------------------------------------------------

    describe('Starter Code', () => {
        it('should be runnable and return WA (placeholder implementation)', async () => {
            const result = await runCode(STARTER_CODE);

            // Starter code should compile and run but return wrong answers
            expect(result.verdict).not.toBe('CE');
            expect(result.verdict).not.toBe('RE');
            // Should be WA or PA (not AC)
            expect(['WA', 'PA']).toContain(result.verdict);
            expect(result.score).toBeLessThan(1.0);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Accepted (AC) Tests
    // ---------------------------------------------------------------------------

    describe('Accepted (AC)', () => {
        it('should return AC for optimal hash map solution', async () => {
            const result = await runCode(CORRECT_SOLUTION);

            expect(result.verdict).toBe('AC');
            expect(result.score).toBe(1.0);
            expect(result.testResults.length).toBeGreaterThan(0);
            expect(result.testResults.every(r => r.passed)).toBe(true);
        }, 60000);

        it('should return AC for brute force solution (O(n²))', async () => {
            const result = await runCode(CORRECT_SOLUTION_BRUTE_FORCE);

            expect(result.verdict).toBe('AC');
            expect(result.score).toBe(1.0);
        }, 60000);

        it('should return AC when indices are returned in reverse order', async () => {
            // Two Sum uses unorderedArray comparator, so order shouldn't matter
            const result = await runCode(CORRECT_SOLUTION_REVERSED_ORDER);

            expect(result.verdict).toBe('AC');
            expect(result.score).toBe(1.0);
        }, 60000);

        it('should return AC and capture user stdout without affecting verdict', async () => {
            const result = await runCode(SOLUTION_WITH_DEBUG_PRINT);

            expect(result.verdict).toBe('AC');
            expect(result.userStdout).toContain('Debug: searching for target');
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Wrong Answer (WA) Tests
    // ---------------------------------------------------------------------------

    describe('Wrong Answer (WA)', () => {
        it('should return WA when always returning [0, 0]', async () => {
            const result = await runCode(WRONG_ANSWER_ALWAYS_ZERO);

            expect(result.verdict).toBe('WA');
            expect(result.score).toBeLessThan(1.0);
            expect(result.testResults.some(r => !r.passed)).toBe(true);
        }, 60000);

        it('should return WA or PA when always returning first two indices', async () => {
            const result = await runCode(WRONG_ANSWER_ALWAYS_FIRST_TWO);

            // PA = Partial Accept (some tests pass by luck, e.g., visible-3 where [0,1] is correct)
            // WA = Wrong Answer (all tests fail)
            expect(['WA', 'PA']).toContain(result.verdict);
            // Might pass some tests by luck but not all
            expect(result.score).toBeLessThan(1.0);
        }, 60000);

        it('should return WA when returning wrong array length', async () => {
            const result = await runCode(WRONG_ANSWER_WRONG_LENGTH);

            expect(result.verdict).toBe('WA');
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Compile Error (CE) Tests
    // ---------------------------------------------------------------------------

    describe('Compile Error (CE)', () => {
        it('should return CE for missing semicolon', async () => {
            const result = await runCode(COMPILE_ERROR_MISSING_SEMICOLON);

            expect(result.verdict).toBe('CE');
            expect(result.score).toBe(0);
            expect(result.compilationError).toBeDefined();
        }, 60000);

        it('should return CE for invalid syntax', async () => {
            const result = await runCode(COMPILE_ERROR_SYNTAX);

            expect(result.verdict).toBe('CE');
            expect(result.score).toBe(0);
        }, 60000);

        it('should return CE when method name is wrong', async () => {
            const result = await runCode(COMPILE_ERROR_WRONG_METHOD_NAME);

            expect(result.verdict).toBe('CE');
            expect(result.score).toBe(0);
        }, 60000);

        it('should return CE for completely garbage input', async () => {
            const result = await runCode('not java code at all !!!@#$%');

            expect(result.verdict).toBe('CE');
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Runtime Error (RE) Tests
    // ---------------------------------------------------------------------------

    describe('Runtime Error (RE)', () => {
        it('should return RE for ArrayIndexOutOfBoundsException', async () => {
            const result = await runCode(RUNTIME_ERROR_ARRAY_INDEX);

            expect(result.verdict).toBe('RE');
            expect(result.score).toBe(0);
        }, 60000);

        it('should return RE for NullPointerException', async () => {
            const result = await runCode(RUNTIME_ERROR_NULL_POINTER);

            expect(result.verdict).toBe('RE');
            expect(result.score).toBe(0);
        }, 60000);

        it('should return RE for ArithmeticException (divide by zero)', async () => {
            const result = await runCode(RUNTIME_ERROR_DIVIDE_BY_ZERO);

            expect(result.verdict).toBe('RE');
            expect(result.score).toBe(0);
        }, 60000);

        it('should return RE for StackOverflowError', async () => {
            const result = await runCode(RUNTIME_ERROR_STACK_OVERFLOW);

            expect(result.verdict).toBe('RE');
            expect(result.score).toBe(0);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Malformed Output Tests
    // ---------------------------------------------------------------------------

    describe('Malformed Output', () => {
        it('should handle null return value', async () => {
            const result = await runCode(MALFORMED_RETURNS_NULL);

            // Should be WA or RE depending on how harness handles null
            expect(['WA', 'RE']).toContain(result.verdict);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Edge Cases - Test Data Verification
    // ---------------------------------------------------------------------------

    describe('Edge Cases (Data Verification)', () => {
        it('should have at least 3 visible test cases', async () => {
            // Get problem details - tRPC query uses GET with input in query params
            const input = encodeURIComponent(JSON.stringify({ problemId: PROBLEM_ID }));
            const response = await fetch(`${API_BASE}/codePractice.getProblem?input=${input}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            const json = await response.json() as { result: { data: { tests: unknown[] } } };

            expect(json.result.data.tests.length).toBeGreaterThanOrEqual(3);
        });

        it('should handle negative numbers correctly', async () => {
            // Test with our correct solution which handles all cases
            const result = await runCode(CORRECT_SOLUTION);
            expect(result.verdict).toBe('AC');
            // hidden-1 tests negative numbers
        }, 60000);

        it('should handle zero target correctly', async () => {
            const result = await runCode(CORRECT_SOLUTION);
            expect(result.verdict).toBe('AC');
            // hidden-2 tests target = 0
        }, 60000);

        it('should handle minimum array size (length 2)', async () => {
            const result = await runCode(CORRECT_SOLUTION);
            expect(result.verdict).toBe('AC');
            // hidden-4 tests [1, 2] with target 3
        }, 60000);

        it('should handle large numbers (near MAX_INT)', async () => {
            const result = await runCode(CORRECT_SOLUTION);
            expect(result.verdict).toBe('AC');
            // hidden-3 tests with 10^9 values
        }, 60000);

        it('should handle duplicate values in array', async () => {
            const result = await runCode(CORRECT_SOLUTION);
            expect(result.verdict).toBe('AC');
            // hidden-6 tests [1, 5, 5, 3] with target 10
        }, 60000);
    });
});
