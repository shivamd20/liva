/**
 * Valid Palindrome Problem Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { starterCode as STARTER_CODE, referenceSolution as REFERENCE_SOLUTION } from '../../../../problems/006-valid-palindrome/java';

const API_PORT = process.env.API_PORT || '5173';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;
const PROBLEM_ID = 'valid-palindrome';

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

const WRONG_ALWAYS_TRUE = `class UserSolution { public boolean isPalindrome(String s) { return true; } }`;
const WRONG_ALWAYS_FALSE = `class UserSolution { public boolean isPalindrome(String s) { return false; } }`;
const COMPILE_ERROR = `class UserSolution { public boolean isPalindrome(String s) { return true }`;
const RUNTIME_ERROR = `class UserSolution { public boolean isPalindrome(String s) { return s.charAt(10000) == 'a'; } }`;

describe('Problem 006: Valid Palindrome', () => {
    beforeAll(async () => { if (!(await healthCheck())) throw new Error('Dev server not running'); });

    describe('Starter Code', () => {
        it('should be runnable and return WA', async () => {
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
        it('should return WA when always returning true', async () => {
            const result = await runCode(WRONG_ALWAYS_TRUE);
            expect(['WA', 'PA']).toContain(result.verdict);
        }, 60000);

        it('should return WA when always returning false', async () => {
            const result = await runCode(WRONG_ALWAYS_FALSE);
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
        it('should return RE for StringIndexOutOfBounds', async () => {
            const result = await runCode(RUNTIME_ERROR);
            expect(result.verdict).toBe('RE');
        }, 60000);
    });
});
