/**
 * Top K Frequent Elements Problem Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { starterCode as STARTER_CODE, referenceSolution as REFERENCE_SOLUTION, bucketSortSolution as BUCKET_SORT_SOLUTION } from '../../../../problems/005-top-k-frequent-elements/java';

const API_PORT = process.env.API_PORT || '5173';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;
const PROBLEM_ID = 'top-k-frequent-elements';

interface JudgeResponse {
    verdict: string;
    score: number;
    testResults: Array<{ testId: string; passed: boolean; verdict: string }>;
    compilationError?: string;
}

async function runCode(code: string): Promise<JudgeResponse> {
    const response = await fetch(`${API_BASE}/codePractice.runCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: PROBLEM_ID, code, language: 'java' }),
    });
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

// Wrong solutions
const WRONG_FIRST_K = `import java.util.*;

class UserSolution {
    public int[] topKFrequent(int[] nums, int k) {
        // Wrong: just returns first k elements
        int[] result = new int[k];
        for (int i = 0; i < k && i < nums.length; i++) {
            result[i] = nums[i];
        }
        return result;
    }
}`;

const COMPILE_ERROR = `import java.util.*;

class UserSolution {
    public int[] topKFrequent(int[] nums, int k) {
        return new int[0]  // missing semicolon
    }
}`;

const RUNTIME_ERROR = `import java.util.*;

class UserSolution {
    public int[] topKFrequent(int[] nums, int k) {
        return new int[] { nums[10000] };
    }
}`;

// Tests
describe('Problem 005: Top K Frequent Elements', () => {
    beforeAll(async () => {
        const healthy = await healthCheck();
        if (!healthy) throw new Error('Dev server not running');
        console.log('✓ Health check passed');
    });

    describe('Starter Code', () => {
        it('should be runnable and return WA', async () => {
            const result = await runCode(STARTER_CODE);
            expect(result.verdict).not.toBe('CE');
            expect(result.verdict).not.toBe('RE');
            expect(['WA', 'PA']).toContain(result.verdict);
        }, 60000);
    });

    describe('Accepted (AC)', () => {
        it('should return AC for heap solution', async () => {
            const result = await runCode(REFERENCE_SOLUTION);
            expect(result.verdict).toBe('AC');
            expect(result.score).toBe(1.0);
        }, 60000);

        it('should return AC for bucket sort solution', async () => {
            const result = await runCode(BUCKET_SORT_SOLUTION);
            expect(result.verdict).toBe('AC');
            expect(result.score).toBe(1.0);
        }, 60000);
    });

    describe('Wrong Answer (WA)', () => {
        it('should return WA for naive first-k solution', async () => {
            const result = await runCode(WRONG_FIRST_K);
            expect(['WA', 'PA']).toContain(result.verdict);
        }, 60000);
    });

    describe('Compile Error (CE)', () => {
        it('should return CE for syntax error', async () => {
            const result = await runCode(COMPILE_ERROR);
            expect(result.verdict).toBe('CE');
        }, 60000);
    });

    describe('Runtime Error (RE)', () => {
        it('should return RE for ArrayIndexOutOfBounds', async () => {
            const result = await runCode(RUNTIME_ERROR);
            expect(result.verdict).toBe('RE');
        }, 60000);
    });
});
