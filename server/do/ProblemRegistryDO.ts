/**
 * ProblemRegistryDO
 * 
 * Authoritative metadata store for Code Practice problems.
 * Handles problem discovery, filtering, and ratings.
 * 
 * State: in-memory map of ALL problems (approx 2k items).
 * Persistence: SQLite (via DO storage) for durability.
 */

import { DurableObject } from "cloudflare:workers";

interface ProblemMeta {
    problemId: string;
    title: string;
    r2Prefix: string;
    difficulty: 'easy' | 'medium' | 'hard';
    topics: string[];
    createdAt: number;
    status: 'active' | 'deprecated' | 'suppressed';

    // Rating stats
    starsTotal: number;
    starsCount: number;
    starredBy: Set<string>; // userIds
}

// Lightweight summary for listing
export interface ProblemSummary {
    problemId: string;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    topics: string[];
    rating: number; // average
    starsCount: number;
}

export interface ListProblemsOptions {
    difficulty?: 'easy' | 'medium' | 'hard';
    topic?: string;
}

export class ProblemRegistryDO extends DurableObject<Env> {
    private problems: Map<string, ProblemMeta> = new Map();
    private initialized: boolean = false;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.ctx.blockConcurrencyWhile(async () => {
            await this.loadState();
        });
    }

    /**
     * Load state from storage on startup
     */
    private async loadState() {
        try {
            // Load all problems from storage
            const stored = await this.ctx.storage.list<ProblemMeta>({ prefix: 'problem:' });

            this.problems.clear();
            for (const [key, meta] of stored) {
                // Rehydrate Set from array (storage serialization)
                if (Array.isArray(meta.starredBy)) {
                    meta.starredBy = new Set(meta.starredBy);
                } else {
                    meta.starredBy = new Set();
                }

                // Key is 'problem:{id}', extract ID or use meta
                const id = key.replace('problem:', '');
                this.problems.set(id, meta);
            }

            this.initialized = true;
            console.log(`[ProblemRegistryDO] Loaded ${this.problems.size} problems`);
        } catch (e) {
            console.error(`[ProblemRegistryDO] Failed to load state:`, e);
            // Don't crash, start empty (or maybe retry?)
            this.initialized = true;
        }
    }

    /**
     * helper to save a single problem
     */
    private async saveProblem(meta: ProblemMeta) {
        // Serialize Set to Array for storage
        const storageObj = {
            ...meta,
            starredBy: Array.from(meta.starredBy)
        };
        await this.ctx.storage.put(`problem:${meta.problemId}`, storageObj);
    }

    // ===========================================
    // Public API
    // ===========================================

    /**
     * Register or update a problem (Admin/System only)
     */
    async register(meta: Omit<ProblemMeta, 'starsTotal' | 'starsCount' | 'starredBy'>): Promise<void> {
        const existing = this.problems.get(meta.problemId);

        const newMeta: ProblemMeta = {
            ...meta,
            // Preserve social stats if updating
            starsTotal: existing?.starsTotal ?? 0,
            starsCount: existing?.starsCount ?? 0,
            starredBy: existing?.starredBy ?? new Set(),
        };

        this.problems.set(meta.problemId, newMeta);
        await this.saveProblem(newMeta);

        console.log(`[ProblemRegistryDO] Registered problem: ${meta.problemId}`);
    }

    /**
     * Get problem metadata + R2 prefix
     */
    async get(problemId: string): Promise<{ meta: ProblemMeta, r2Prefix: string } | null> {
        const p = this.problems.get(problemId);
        if (!p) return null;

        return {
            meta: p,
            r2Prefix: p.r2Prefix
        };
    }

    /**
     * List problems with optional filtering
     */
    async list(filter?: ListProblemsOptions): Promise<ProblemSummary[]> {
        let results = Array.from(this.problems.values());

        // Apply filters
        if (filter?.difficulty) {
            results = results.filter(p => p.difficulty === filter.difficulty);
        }

        if (filter?.topic) {
            const topic = filter.topic;
            results = results.filter(p => p.topics.includes(topic));
        }


        // Default sort: createdAt for steady state, but maybe stars/rating later
        // v1: Sort by ID for stability or createdAt
        results.sort((a, b) => a.createdAt - b.createdAt);

        return results.map(p => ({
            problemId: p.problemId,
            title: p.title,
            difficulty: p.difficulty,
            topics: p.topics,
            rating: p.starsCount > 0 ? p.starsTotal / p.starsCount : 0,
            starsCount: p.starsCount
        }));
    }

    /**
     * Rate a problem (Week 2 feature, but implementing foundational logic now)
     */
    async star(problemId: string, userId: string, stars: number): Promise<number> {
        const p = this.problems.get(problemId);
        if (!p) throw new Error('Problem not found');

        if (stars < 1 || stars > 5) throw new Error('Invalid rating (1-5)');

        if (p.starredBy.has(userId)) {
            // User already rated. For v1, let's say "no changing votes" or just ignore
            // To implement changing votes, we'd need to store individual user ratings
            // For simplicity/v1: prevent double voting
            return p.starsCount > 0 ? p.starsTotal / p.starsCount : 0;
        }

        p.starredBy.add(userId);
        p.starsTotal += stars;
        p.starsCount += 1;

        await this.saveProblem(p);

        return p.starsTotal / p.starsCount;
    }
}
