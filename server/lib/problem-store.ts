/**
 * Problem Store Library
 * 
 * Handles interaction with R2 for problem content.
 * 
 * Layout in R2:
 * problems/v1/{problemId}/
 *   - content.json   (Problem definition, desc, specs)
 *   - tests.json     (Test cases)
 *   - starter/
 *       - java.java
 *   - reference/
 *       - java.java
 */

import { Problem, TestCase } from "../code-practice/types";

// Subset of Problem that goes into content.json
type ProblemContent = Omit<Problem, 'tests' | 'starterCode' | 'referenceSolutions' | 'javaHarness'>;

const BUCKET_PREFIX = 'problems/v1';

export class ProblemStore {
    constructor(private bucket: R2Bucket) { }

    /**
     * Fetch full problem object from R2 (reassembles parts)
     */
    async fetchProblem(problemId: string): Promise<Problem | null> {
        const prefix = `${BUCKET_PREFIX}/${problemId}`;

        // Parallel fetch of parts
        const [contentRes, testsRes, starterJavaRes, harnessRes] = await Promise.all([
            this.bucket.get(`${prefix}/content.json`),
            this.bucket.get(`${prefix}/tests.json`),
            this.bucket.get(`${prefix}/starter/java.java`),
            this.bucket.get(`${prefix}/harness/java.java`),
        ]);

        if (!contentRes) return null;

        const content = await contentRes.json() as ProblemContent;
        const tests = testsRes ? await testsRes.json() as TestCase[] : [];

        // Load code files as text
        const starterJava = starterJavaRes ? await starterJavaRes.text() : undefined;
        const javaHarness = harnessRes ? await harnessRes.text() : undefined;

        // Reconstruct full object
        const problem: Problem = {
            ...content,
            tests,
            starterCode: starterJava ? { java: starterJava } : {},
            javaHarness,
            // Note: reference solutions are NOT loaded by default for security/perf
            // If we need them for judging, we fetch specifically? 
            // Current architecture: Judge might need them if it compares outputs, 
            // but our TestCase has `expected` value inline mostly.
            // If needed, we can add them here.
        };

        return problem;
    }

    /**
     * Fetch the reference solution (Java) for internal use/sanity check
     * NOT exposed to users.
     */
    async fetchReferenceSolution(problemId: string): Promise<string | null> {
        const prefix = `${BUCKET_PREFIX}/${problemId}`;
        const refRes = await this.bucket.get(`${prefix}/reference/java.java`);

        if (!refRes) return null;
        return refRes.text();
    }

    /**
     * Store a problem to R2 (Splits into parts)
     * This is used by the Admin Seeder
     */
    async storeProblem(problem: Problem): Promise<string> {
        const prefix = `${BUCKET_PREFIX}/${problem.problemId}`;
        const r2Prefix = prefix; // Return this to be stored in DO

        // 1. Split Content by destructuring to remove excluded fields
        const { tests, starterCode, referenceSolutions, javaHarness, ...rest } = problem;
        const content: ProblemContent = rest;

        // 2. Prepare operations
        const ops: Promise<R2Object | null>[] = [
            this.bucket.put(`${prefix}/content.json`, JSON.stringify(content)),
            this.bucket.put(`${prefix}/tests.json`, JSON.stringify(problem.tests)),
        ];

        if (problem.starterCode?.['java']) {
            ops.push(this.bucket.put(`${prefix}/starter/java.java`, problem.starterCode['java']));
        }

        if (problem.javaHarness) {
            ops.push(this.bucket.put(`${prefix}/harness/java.java`, problem.javaHarness));
        }

        // Optional: Reference solutions (stored but maybe not used immediately)
        if (problem.referenceSolutions?.['java']) {
            ops.push(this.bucket.put(`${prefix}/reference/java.java`, problem.referenceSolutions['java']));
        }

        await Promise.all(ops);

        return r2Prefix;
    }
}
