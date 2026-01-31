import { describe, it, expect, beforeAll } from 'vitest';
import { starterCode as STARTER_CODE, referenceSolution as REFERENCE_SOLUTION } from '../../../../problems/010-three-sum/java';

const API_PORT = process.env.API_PORT || '5173';
const API_BASE = `http://localhost:${API_PORT}/api/v1`;
const PROBLEM_ID = 'three-sum';

interface JudgeResponse { verdict: string; score: number; }
async function runCode(code: string): Promise<JudgeResponse> {
    const response = await fetch(`${API_BASE}/codePractice.runCode`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problemId: PROBLEM_ID, code, language: 'java' }) });
    const json = await response.json() as { result: { data: JudgeResponse } };
    return json.result.data;
}
async function healthCheck(): Promise<boolean> { try { return (await fetch(`${API_BASE}/codePractice.health`)).ok; } catch { return false; } }

const WRONG_EMPTY = `import java.util.*; class UserSolution { public List<List<Integer>> threeSum(int[] nums) { return new ArrayList<>(); } }`;
const COMPILE_ERROR = `class UserSolution { public List<List<Integer>> threeSum(int[] nums) { return null }`;
const RUNTIME_ERROR = `import java.util.*; class UserSolution { public List<List<Integer>> threeSum(int[] nums) { String x = null; return Collections.singletonList(Collections.singletonList(x.length())); } }`;

describe('Problem 010: 3Sum', () => {
    beforeAll(async () => { if (!(await healthCheck())) throw new Error('Dev server not running'); });

    describe('Starter Code', () => { it('should be runnable and return WA', async () => { const result = await runCode(STARTER_CODE); expect(result.verdict).not.toBe('CE'); expect(['WA', 'PA']).toContain(result.verdict); }, 60000); });
    describe('Accepted (AC)', () => { it('should return AC', async () => { const result = await runCode(REFERENCE_SOLUTION); expect(result.verdict).toBe('AC'); expect(result.score).toBe(1.0); }, 60000); });
    describe('Wrong Answer (WA)', () => { it('should return WA for empty result', async () => { const result = await runCode(WRONG_EMPTY); expect(['WA', 'PA']).toContain(result.verdict); }, 60000); });
    describe('Compile Error (CE)', () => { it('should return CE', async () => { const result = await runCode(COMPILE_ERROR); expect(result.verdict).toBe('CE'); }, 60000); });
    describe('Runtime Error (RE)', () => { it('should return RE', async () => { const result = await runCode(RUNTIME_ERROR); expect(result.verdict).toBe('RE'); }, 60000); });
});
