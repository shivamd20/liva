
import { chat } from "@tanstack/ai";
import { LivaAIModel } from "../ai/liva-ai-model";
import { ProblemStore } from "../lib/problem-store";
import { judge } from "./judge";
import { PROMPTS } from "./constants";

export class CodePracticeAI {

    /**
     * Phase 1: Generate language-agnostic problem definition
     */
    public static async generateProblem(intent: string, env: Env): Promise<any> {
        try {
            const cacheKey = await this.generateCacheKey('problem-v1', { intent });
            const cached = await this.getCachedResponse(cacheKey, env);
            if (cached) {
                console.log('[AI] Serving from cache:', cacheKey);
                return cached;
            }

            const model = new LivaAIModel(env);
            const adapter = await model.getAdapter();

            const prompt = PROMPTS.GENERATE_PROBLEM(intent);

            const result: any = await chat({
                adapter,
                messages: [{ role: "user", content: prompt }],
            });

            const rawContent = result.content || "";
            const objects = this.parseNDJSON(rawContent);

            if (objects.length === 0) {
                throw new Error("AI returned empty or invalid NDJSON");
            }

            // Aggregate objects into a problem definition
            const problem: any = {
                metadata: objects.find(o => o.type === 'metadata'),
                description: objects.find(o => o.type === 'description'),
                constraints: objects.filter(o => o.type === 'constraint').map(o => o.content),
                examples: objects.filter(o => o.type === 'example'),
                tests: objects.filter(o => o.type === 'test')
            };

            // Flatten for easier consumption if needed, but keeping original types for now
            const response = {
                title: problem.metadata?.title || "Untitled Problem",
                difficulty: problem.metadata?.difficulty?.toLowerCase() || "easy",
                topics: problem.metadata?.topics || [],
                description: problem.description?.content || "",
                constraints: problem.constraints || [],
                examples: problem.examples.map((ex: any) => ({
                    input: ex.input,
                    output: ex.output,
                    explanation: ex.explanation
                })),
                tests: problem.tests.map((t: any) => ({
                    testId: t.testId,
                    input: t.input,
                    expected: t.expected,
                    visibility: t.visibility || 'visible'
                }))
            };

            await this.cacheResponse(cacheKey, response, env);

            return response;

        } catch (e) {
            console.error("Generate problem error:", e);
            throw new Error(`Problem generation failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    /**
     * Phase 2: Generate language-specific implementation (harness + solution + starter + specs)
     * This includes sanity check - runs the reference solution against the harness
     */
    public static async generateImplementation(
        problem: any,
        tests: any[],
        language: string,
        env: Env
    ): Promise<any> {
        // Cache check
        const cachePayload = { problem, tests, language };
        const cacheKey = await this.generateCacheKey('impl-v4', cachePayload);
        const cached = await this.getCachedResponse(cacheKey, env);
        if (cached) {
            console.log('[AI] Serving implementation from cache:', cacheKey);
            return cached;
        }

        if (language !== 'java') {
            throw new Error("Only Java is supported currently");
        }

        const model = new LivaAIModel(env);
        const adapter = await model.getAdapter();

        const prompt = PROMPTS.GENERATE_IMPLEMENTATION(problem);

        console.log('[AI] Generating Java implementation (Protocol v1)...');
        const result: any = await chat({
            adapter,
            messages: [{ role: "user", content: prompt }],
        });

        const rawContent = result.content || "";
        const objects = this.parseNDJSON(rawContent);

        const implementation: any = {
            starterCode: objects.find(o => o.type === 'starterCode')?.content || "",
            referenceSolution: objects.find(o => o.type === 'referenceSolution')?.content || "",
            harness: objects.find(o => o.type === 'harness')?.content || "",
        };

        if (!implementation.harness || !implementation.referenceSolution) {
            throw new Error("AI failed to generate required implementation components (harness/referenceSolution)");
        }

        // Run sanity check
        console.log('[AI] Running Protocol v1 sanity check...');

        const mockProblem: any = {
            problemId: 'sanity-check-' + Date.now(),
            title: problem.title,
            difficulty: problem.difficulty,
            javaHarness: implementation.harness,
            tests: tests.map((t: any) => ({
                ...t,
                weight: 1
            })),
            timeLimit: 2000,
            memoryLimit: 256
        };

        let sanityResult = null;
        try {
            const verdict = await judge(
                mockProblem,
                implementation.referenceSolution,
                'java',
                'all',
                env
            );

            sanityResult = {
                passed: verdict.verdict === 'AC',
                verdict: verdict.verdict,
                score: verdict.score,
                compilationError: verdict.compilationError,
                runtimeError: verdict.runtimeError,
                testResults: verdict.testResults,
                logs: verdict.userStdout || verdict.stderr || verdict.compilationError
            };

            console.log(`[AI] Sanity check finished: ${sanityResult.verdict}`);
        } catch (err) {
            console.error("[AI] Sanity check failed with internal error:", err);
            sanityResult = {
                passed: false,
                error: err instanceof Error ? err.message : String(err)
            };
        }

        const responsePayload = {
            success: true,
            implementation,
            sanityCheck: sanityResult,
        };

        await this.cacheResponse(cacheKey, responsePayload, env);

        return responsePayload;
    }

    /**
     * Phase 3: Finalize and PERSIST the problem
     */
    public static async finalizeProblem(
        data: { problem: any, execution: any, userId: string, userName: string },
        env: Env
    ): Promise<any> {
        const { problem, execution, userId, userName } = data;

        if (!userId || !userName) {
            throw new Error("userId and userName are required");
        }

        if (!problem || !execution) {
            throw new Error("problem and execution data are required");
        }

        // Generate unique ID
        const titleSlug = problem.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const shortId = crypto.randomUUID().slice(0, 8);
        const problemId = `${titleSlug}-${shortId}`;

        // Build complete problem object
        const completeProblem = {
            problemId,
            title: problem.title,
            difficulty: (problem.difficulty || 'easy').toLowerCase(),
            topics: problem.topics || [],
            description: problem.description,
            constraints: problem.constraints || [],
            examples: (problem.examples || []).map((ex: any) => ({
                input: Array.isArray(ex.input) ? ex.input : [ex.input],
                output: ex.output,
                explanation: ex.explanation,
            })),

            tests: (execution.tests || problem.tests || []).map((t: any) => ({
                ...t,
                comparator: t.comparator || { type: 'exact' },
                weight: t.weight || 1,
            })),
            starterCode: {
                java: execution.starterCode,
            },
            referenceSolutions: {
                java: execution.referenceSolution
            },
            javaHarness: execution.harness || "",
        };

        // Store in R2
        const store = new ProblemStore(env.files);
        await store.storeProblem(completeProblem as any);

        // Register in DO
        const id = env.PROBLEM_REGISTRY_DO.idFromName('singleton');
        const registry = env.PROBLEM_REGISTRY_DO.get(id);
        await registry.register({
            problemId,
            title: completeProblem.title,
            r2Prefix: `problems/v1/${problemId}/`,
            difficulty: completeProblem.difficulty as any,
            topics: completeProblem.topics,
            createdAt: Date.now(),
            status: 'active',
            isGenerated: true,
            createdBy: userId,
            createdByName: userName,
            generationStatus: {
                status: 'completed',
                step: 'finalize',
                lastUpdated: Date.now(),
            },
            sanityStatus: {
                status: 'pending',
                lastChecked: Date.now(),
            }
        });

        return {
            success: true,
            problemId
        };
    }

    /**
     * STREAMING: Generate problem definition
     */
    public static async *generateProblemStream(intent: string, env: Env): AsyncGenerator<any> {
        const model = new LivaAIModel(env);
        const adapter = await model.getAdapter();
        const prompt = PROMPTS.GENERATE_PROBLEM(intent);

        console.log('[AI] Starting problem stream...');
        // @ts-ignore
        const stream = await chat({
            adapter,
            messages: [{ role: "user", content: prompt }],
            stream: true,
        });

        // @ts-ignore
        for await (const chunk of stream) {
            // @ts-ignore
            const delta = chunk.delta || chunk.content || "";
            if (delta) {
                yield { type: 'text', content: delta };
            }
        }
    }

    /**
     * STREAMING: Generate implementation
     */
    public static async *generateImplementationStream(
        problem: any,
        tests: any[],
        language: string,
        env: Env
    ): AsyncGenerator<any> {
        if (language !== 'java') throw new Error("Only Java is supported");

        const model = new LivaAIModel(env);
        const adapter = await model.getAdapter();
        const prompt = PROMPTS.GENERATE_IMPLEMENTATION(problem);

        console.log('[AI] Starting implementation stream...');
        // @ts-ignore
        const stream = await chat({
            adapter,
            messages: [{ role: "user", content: prompt }],
            stream: true,
        });

        // @ts-ignore
        for await (const chunk of stream) {
            // @ts-ignore
            const delta = chunk.delta || chunk.content || "";
            if (delta) {
                yield { type: 'text', content: delta };
            }
        }
    }


    // --- Helper Methods ---

    /**
     * Parse NDJSON response from LLM
     */
    private static parseNDJSON(text: string): any[] {
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    console.warn('[AI] Failed to parse NDJSON line:', line);
                    return null;
                }
            })
            .filter(obj => obj !== null);
    }

    private static async generateCacheKey(prefix: string, data: any): Promise<string> {
        const normalize = (obj: any): any => {
            if (obj === null || typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) return obj.map(normalize);
            return Object.keys(obj).sort().reduce((acc: any, key) => {
                acc[key] = normalize(obj[key]);
                return acc;
            }, {});
        };
        const str = JSON.stringify(normalize(data));
        const msgBuffer = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `${prefix}:${hashHex}`;
    }

    private static async getCachedResponse(key: string, env: Env): Promise<any> {
        try {
            // @ts-ignore
            return await env.LLM_CACHE.get(key, 'json');
        } catch (e) {
            console.warn('[AI] Cache read error:', e);
            return null;
        }
    }

    private static async cacheResponse(key: string, data: any, env: Env): Promise<void> {
        try {
            // @ts-ignore
            await env.LLM_CACHE.put(key, JSON.stringify(data), { expirationTtl: 60 * 60 * 24 * 7 }); // 7 days
        } catch (e) {
            console.warn('[AI] Cache write error:', e);
        }
    }
}
