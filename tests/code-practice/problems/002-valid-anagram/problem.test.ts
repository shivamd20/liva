/**
 * Valid Anagram Problem Tests
 * 
 * Comprehensive E2E tests against the judge for the Valid Anagram problem.
 * Tests cover: AC, WA, CE, RE, starter code, edge cases
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { starterCode as STARTER_CODE, referenceSolution as REFERENCE_SOLUTION, sortingSolution as SORTING_SOLUTION } from '../../../../problems/002-valid-anagram/java';

// =============================================================================
// Configuration
// =============================================================================

const API_PORT = process.env.API_PORT || '5173';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;
const PROBLEM_ID = 'valid-anagram';

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
// Test Solutions
// =============================================================================

const WRONG_ALWAYS_TRUE = `import java.util.*;

class UserSolution {
    public boolean isAnagram(String s, String t) {
        return true;
    }
}`;

const WRONG_ALWAYS_FALSE = `import java.util.*;

class UserSolution {
    public boolean isAnagram(String s, String t) {
        return false;
    }
}`;

const WRONG_LENGTH_CHECK_ONLY = `import java.util.*;

class UserSolution {
    public boolean isAnagram(String s, String t) {
        // Only checks length, not character frequencies
        return s.length() == t.length();
    }
}`;

const COMPILE_ERROR = `import java.util.*;

class UserSolution {
    public boolean isAnagram(String s, String t) {
        return true  // missing semicolon
    }
}`;

const RUNTIME_ERROR_NPE = `import java.util.*;

class UserSolution {
    public boolean isAnagram(String s, String t) {
        String x = null;
        return x.equals(s);
    }
}`;

const RUNTIME_ERROR_INDEX = `import java.util.*;

class UserSolution {
    public boolean isAnagram(String s, String t) {
        return s.charAt(1000) == t.charAt(1000);
    }
}`;

// =============================================================================
// Tests
// =============================================================================

describe('Problem 002: Valid Anagram', () => {
    beforeAll(async () => {
        const healthy = await healthCheck();
        if (!healthy) {
            throw new Error('Dev server not running. Start with: npm run dev');
        }
        console.log('✓ Health check passed');
    });

    // ---------------------------------------------------------------------------
    // Starter Code Tests
    // ---------------------------------------------------------------------------

    describe('Starter Code', () => {
        it('should be runnable and return WA (placeholder returns false)', async () => {
            const result = await runCode(STARTER_CODE);

            expect(result.verdict).not.toBe('CE');
            expect(result.verdict).not.toBe('RE');
            // Starter returns false always, so should fail on true cases
            expect(['WA', 'PA']).toContain(result.verdict);
            expect(result.score).toBeLessThan(1.0);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Accepted (AC) Tests
    // ---------------------------------------------------------------------------

    describe('Accepted (AC)', () => {
        it('should return AC for optimal frequency count solution', async () => {
            const result = await runCode(REFERENCE_SOLUTION);

            expect(result.verdict).toBe('AC');
            expect(result.score).toBe(1.0);
            expect(result.testResults.length).toBeGreaterThan(0);
            expect(result.testResults.every(r => r.passed)).toBe(true);
        }, 60000);

        it('should return AC for sorting solution', async () => {
            const result = await runCode(SORTING_SOLUTION);

            expect(result.verdict).toBe('AC');
            expect(result.score).toBe(1.0);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Wrong Answer (WA) Tests
    // ---------------------------------------------------------------------------

    describe('Wrong Answer (WA)', () => {
        it('should return WA when always returning true', async () => {
            const result = await runCode(WRONG_ALWAYS_TRUE);

            expect(['WA', 'PA']).toContain(result.verdict);
            expect(result.score).toBeLessThan(1.0);
        }, 60000);

        it('should return WA when always returning false', async () => {
            const result = await runCode(WRONG_ALWAYS_FALSE);

            expect(['WA', 'PA']).toContain(result.verdict);
            expect(result.score).toBeLessThan(1.0);
        }, 60000);

        it('should return WA when only checking length', async () => {
            const result = await runCode(WRONG_LENGTH_CHECK_ONLY);

            // This will pass some tests but fail on "aacc" vs "ccac" (same length, not anagram)
            expect(['WA', 'PA']).toContain(result.verdict);
            expect(result.score).toBeLessThan(1.0);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Compile Error (CE) Tests
    // ---------------------------------------------------------------------------

    describe('Compile Error (CE)', () => {
        it('should return CE for missing semicolon', async () => {
            const result = await runCode(COMPILE_ERROR);

            expect(result.verdict).toBe('CE');
            expect(result.score).toBe(0);
            expect(result.compilationError).toBeDefined();
        }, 60000);

        it('should return CE for garbage input', async () => {
            const result = await runCode('this is not java!!!');

            expect(result.verdict).toBe('CE');
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Runtime Error (RE) Tests
    // ---------------------------------------------------------------------------

    describe('Runtime Error (RE)', () => {
        it('should return RE for NullPointerException', async () => {
            const result = await runCode(RUNTIME_ERROR_NPE);

            expect(result.verdict).toBe('RE');
            expect(result.score).toBe(0);
        }, 60000);

        it('should return RE for StringIndexOutOfBoundsException', async () => {
            const result = await runCode(RUNTIME_ERROR_INDEX);

            expect(result.verdict).toBe('RE');
            expect(result.score).toBe(0);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Edge Cases
    // ---------------------------------------------------------------------------

    describe('Edge Cases', () => {
        it('should pass all edge case tests with reference solution', async () => {
            const result = await runCode(REFERENCE_SOLUTION);

            // Verify all tests pass
            expect(result.verdict).toBe('AC');
            expect(result.testResults.every(r => r.passed)).toBe(true);
        }, 60000);
    });
});
