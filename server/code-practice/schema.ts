import { z } from 'zod';

// ==========================================
// Primitives & Specs
// ==========================================

export const ComparatorSpecSchema = z.union([
    z.object({ type: z.literal('exact') }),
    z.object({ type: z.literal('numeric'), tolerance: z.number() }),
    z.object({ type: z.literal('unorderedArray') }),
    z.object({ type: z.literal('set') }),
    z.object({ type: z.literal('multiset') }),
    z.object({ type: z.literal('floatArray'), tolerance: z.number() }),
]);

// ==========================================
// Test Cases
// ==========================================

export const TestCaseSchema = z.object({
    testId: z.string(),
    input: z.array(z.unknown()),
    expected: z.unknown(),
    comparator: ComparatorSpecSchema,
    visibility: z.enum(['visible', 'hidden'] as const),
    weight: z.number().default(1),
    description: z.string().optional(),
});

export const ExampleSchema = z.object({
    input: z.array(z.unknown()),
    output: z.unknown(),
    explanation: z.string().optional(),
});

// ==========================================
// Problem Definition
// ==========================================

// Base metadata that is always present in the main JSON
const ProblemBaseSchema = z.object({
    problemId: z.string(),
    title: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard'] as const),
    topics: z.array(z.string()),
    description: z.string(),
    constraints: z.array(z.string()),
    examples: z.array(ExampleSchema),
    hints: z.array(z.string()).optional(),
    timeLimit: z.number().default(2000),
    memoryLimit: z.number().default(256),
});

// File Reference Schema for "Compact" mode
// Stores paths/keys to where the content is stored
export const ProblemFilesSchema = z.object({
    tests: z.string().optional(), // Path to tests.json
    starterCode: z.record(z.string(), z.string()).optional(), // language -> path
    referenceSolutions: z.record(z.string(), z.string()).optional(), // language -> path
    harness: z.record(z.string(), z.string()).optional(), // language -> path
});

// Full Problem (Legacy/Memory Compatible) includes content inline
export const ProblemSchema = ProblemBaseSchema.extend({
    // Inline content (Legacy support)
    tests: z.array(TestCaseSchema).optional(),
    starterCode: z.record(z.string(), z.string()).optional(),
    referenceSolutions: z.record(z.string(), z.string()).optional(),
    javaHarness: z.string().optional(), // Specific legacy field

    // New modular references
    files: ProblemFilesSchema.optional(),
});

export type Problem = z.infer<typeof ProblemSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;

