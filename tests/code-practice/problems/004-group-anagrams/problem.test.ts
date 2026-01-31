/**
 * Group Anagrams Problem Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { starterCode as STARTER_CODE, referenceSolution as REFERENCE_SOLUTION, countingSolution as COUNTING_SOLUTION } from '../../../../problems/004-group-anagrams/java';

// =============================================================================
// Configuration
// =============================================================================

const API_PORT = process.env.API_PORT || '5173';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;
const PROBLEM_ID = 'group-anagrams';

// =============================================================================
// Helper Functions
// =============================================================================

interface JudgeResponse {
    verdict: string;
    score: number;
    testResults: Array<{ testId: string; passed: boolean; verdict: string }>;
    totalTimeMs: number;
    compilationError?: string;
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

const WRONG_SINGLE_GROUP = `import java.util.*;

class UserSolution {
    public List<List<String>> groupAnagrams(String[] strs) {
        // Wrong: puts everything in one group
        List<List<String>> result = new ArrayList<>();
        result.add(Arrays.asList(strs));
        return result;
    }
}`;

const WRONG_EACH_SEPARATE = `import java.util.*;

class UserSolution {
    public List<List<String>> groupAnagrams(String[] strs) {
        // Wrong: each string in its own group
        List<List<String>> result = new ArrayList<>();
        for (String s : strs) {
            List<String> group = new ArrayList<>();
            group.add(s);
            result.add(group);
        }
        return result;
    }
}`;

const COMPILE_ERROR = `import java.util.*;

class UserSolution {
    public List<List<String>> groupAnagrams(String[] strs) {
        return new ArrayList<>()  // missing semicolon
    }
}`;

const RUNTIME_ERROR = `import java.util.*;

class UserSolution {
    public List<List<String>> groupAnagrams(String[] strs) {
        String x = null;
        return Collections.singletonList(Collections.singletonList(x.toUpperCase()));
    }
}`;

// =============================================================================
// Tests
// =============================================================================

describe('Problem 004: Group Anagrams', () => {
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
        it('should be runnable and return WA (empty result)', async () => {
            const result = await runCode(STARTER_CODE);

            expect(result.verdict).not.toBe('CE');
            expect(result.verdict).not.toBe('RE');
            expect(['WA', 'PA']).toContain(result.verdict);
            expect(result.score).toBeLessThan(1.0);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Accepted (AC) Tests
    // ---------------------------------------------------------------------------

    describe('Accepted (AC)', () => {
        it('should return AC for sorting-based solution', async () => {
            const result = await runCode(REFERENCE_SOLUTION);

            expect(result.verdict).toBe('AC');
            expect(result.score).toBe(1.0);
        }, 60000);

        it('should return AC for counting-based solution', async () => {
            const result = await runCode(COUNTING_SOLUTION);

            expect(result.verdict).toBe('AC');
            expect(result.score).toBe(1.0);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Wrong Answer (WA) Tests
    // ---------------------------------------------------------------------------

    describe('Wrong Answer (WA)', () => {
        it('should return WA when putting all in single group', async () => {
            const result = await runCode(WRONG_SINGLE_GROUP);

            expect(['WA', 'PA']).toContain(result.verdict);
            expect(result.score).toBeLessThan(1.0);
        }, 60000);

        it('should return WA when putting each in separate group', async () => {
            const result = await runCode(WRONG_EACH_SEPARATE);

            expect(['WA', 'PA']).toContain(result.verdict);
            expect(result.score).toBeLessThan(1.0);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Compile Error (CE) Tests
    // ---------------------------------------------------------------------------

    describe('Compile Error (CE)', () => {
        it('should return CE for syntax error', async () => {
            const result = await runCode(COMPILE_ERROR);

            expect(result.verdict).toBe('CE');
            expect(result.score).toBe(0);
        }, 60000);
    });

    // ---------------------------------------------------------------------------
    // Runtime Error (RE) Tests
    // ---------------------------------------------------------------------------

    describe('Runtime Error (RE)', () => {
        it('should return RE for NullPointerException', async () => {
            const result = await runCode(RUNTIME_ERROR);

            expect(result.verdict).toBe('RE');
            expect(result.score).toBe(0);
        }, 60000);
    });
});
