import { z } from 'zod';

// ==========================================
// Primitives & Specs
// ==========================================

// Helper to define recursive type
type TypeSpecInput =
    | { kind: 'int' }
    | { kind: 'long' }
    | { kind: 'float' }
    | { kind: 'double' }
    | { kind: 'string' }
    | { kind: 'char' }
    | { kind: 'boolean' }
    | { kind: 'array'; of: TypeSpecInput }
    | { kind: 'matrix'; of: TypeSpecInput }
    | { kind: 'tuple'; elements: TypeSpecInput[] }
    | { kind: 'object'; fields: Record<string, TypeSpecInput> }
    | { kind: 'tree' }
    | { kind: 'linkedList' }
    | { kind: 'graph' }
    | { kind: 'void' };

// Cast recursive schema to ZodType<TypeSpecInput>
export const TypeSpecSchema: z.ZodType<TypeSpecInput> = z.lazy(() => z.union([
    z.object({ kind: z.literal('int') }),
    z.object({ kind: z.literal('long') }),
    z.object({ kind: z.literal('float') }),
    z.object({ kind: z.literal('double') }),
    z.object({ kind: z.literal('string') }),
    z.object({ kind: z.literal('char') }),
    z.object({ kind: z.literal('boolean') }),
    z.object({ kind: z.literal('array'), of: TypeSpecSchema }),
    z.object({ kind: z.literal('matrix'), of: TypeSpecSchema }),
    z.object({ kind: z.literal('tuple'), elements: z.array(TypeSpecSchema) }),
    z.object({ kind: z.literal('object'), fields: z.record(z.string(), TypeSpecSchema) }),
    z.object({ kind: z.literal('tree') }),
    z.object({ kind: z.literal('linkedList') }),
    z.object({ kind: z.literal('graph') }),
    z.object({ kind: z.literal('void') }),
])) as any;

export const ComparatorSpecSchema = z.union([
    z.object({ type: z.literal('exact') }),
    z.object({ type: z.literal('numeric'), tolerance: z.number() }),
    z.object({ type: z.literal('unorderedArray') }),
    z.object({ type: z.literal('set') }),
    z.object({ type: z.literal('multiset') }),
    z.object({ type: z.literal('floatArray'), tolerance: z.number() }),
]);

export const FunctionParamSchema = z.object({
    name: z.string(),
    type: z.string(),
    typeSpec: TypeSpecSchema,
});

export const FunctionSignatureSchema = z.object({
    name: z.string(),
    params: z.array(FunctionParamSchema),
    returnType: z.string(),
    returnTypeSpec: TypeSpecSchema,
});

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
    inputSpec: TypeSpecSchema,
    outputSpec: TypeSpecSchema,
    functionSignature: FunctionSignatureSchema.optional(), // Made optional as requested
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

