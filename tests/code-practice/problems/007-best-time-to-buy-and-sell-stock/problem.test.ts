/**
 * Best Time to Buy and Sell Stock Problem Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { starterCode as STARTER_CODE, referenceSolution as REFERENCE_SOLUTION } from '../../../../problems/007-best-time-to-buy-and-sell-stock/java';

const API_PORT = process.env.API_PORT || '5173';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;
const PROBLEM_ID = 'best-time-to-buy-and-sell-stock';

interface JudgeResponse { verdict: string; score: number; compilationError?: string; }

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
    try { return (await fetch(`${API_BASE}/codePractice.health`)).ok; } catch { return false; }
}

const WRONG_ALWAYS_ZERO = `class UserSolution { public int maxProfit(int[] prices) { return 0; } }`;
const WRONG_MAX_MINUS_MIN = `class UserSolution { 
    public int maxProfit(int[] prices) { 
        int min = Integer.MAX_VALUE, max = 0;
        for (int p : prices) { min = Math.min(min, p); max = Math.max(max, p); }
        return max - min;  // Wrong: doesn't check order
    } 
}`;
const COMPILE_ERROR = `class UserSolution { public int maxProfit(int[] prices) { return 0 }`;
const RUNTIME_ERROR = `class UserSolution { public int maxProfit(int[] prices) { return prices[10000]; } }`;

describe('Problem 007: Best Time to Buy and Sell Stock', () => {
    beforeAll(async () => { if (!(await healthCheck())) throw new Error('Dev server not running'); });

    describe('Starter Code', () => {
        it('should be runnable and return WA or PA', async () => {
            const result = await runCode(STARTER_CODE);
            expect(result.verdict).not.toBe('CE');
            expect(['WA', 'PA']).toContain(result.verdict);
        }, 60000);
    });

    describe('Accepted (AC)', () => {
        it('should return AC for reference solution', async () => {
            const result = await runCode(REFERENCE_SOLUTION);
            expect(result.verdict).toBe('AC');
            expect(result.score).toBe(1.0);
        }, 60000);
    });

    describe('Wrong Answer (WA)', () => {
        it('should return WA when always returning 0', async () => {
            const result = await runCode(WRONG_ALWAYS_ZERO);
            expect(['WA', 'PA']).toContain(result.verdict);
        }, 60000);

        it('should return WA for max-min without order check', async () => {
            const result = await runCode(WRONG_MAX_MINUS_MIN);
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
