import { z } from "zod";

// --- Excalidraw Element Schemas ---

const BaseElementSchema = z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    strokeColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    fillStyle: z.string().optional(),
    strokeWidth: z.number().optional(),
    strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
    roughness: z.number().optional(),
    opacity: z.number().optional(),
    width: z.number(),
    height: z.number(),
    angle: z.number().optional(),
    seed: z.number().optional(),
    version: z.number().optional(),
    versionNonce: z.number().optional(),
    isDeleted: z.boolean().optional(),
    groupIds: z.array(z.string()).optional(),
    frameId: z.string().nullable().optional(),
    boundElements: z.array(z.object({ id: z.string(), type: z.string() })).nullable().optional(),
    updated: z.number().optional(),
    link: z.string().nullable().optional(),
    locked: z.boolean().optional(),
    customData: z.record(z.unknown()).optional(),
});

export const ExcalidrawElementSchema = BaseElementSchema.merge(z.object({
    type: z.string(), // generic type, refined below if needed
    // Specific fields for different types
    text: z.string().optional(),
    fontSize: z.number().optional(),
    fontFamily: z.number().optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),
    baseline: z.number().optional(),
    containerId: z.string().nullable().optional(),
    originalText: z.string().optional(),

    // Linear elements (arrow, line)
    points: z.array(z.array(z.number())).optional(),
    lastCommittedPoint: z.array(z.number()).nullable().optional(),
    startBinding: z.object({ elementId: z.string(), focus: z.number(), gap: z.number() }).nullable().optional(),
    endBinding: z.object({ elementId: z.string(), focus: z.number(), gap: z.number() }).nullable().optional(),
    startArrowhead: z.string().nullable().optional(),
    endArrowhead: z.string().nullable().optional(),

    // Image
    fileId: z.string().nullable().optional(),
    status: z.enum(["pending", "saved", "error"]).optional(),
    scale: z.array(z.number()).optional(),
}));

export type ExcalidrawElement = z.infer<typeof ExcalidrawElementSchema>;

// --- AI Transformation Schemas ---

export const BudgetSchema = z.object({
    maxTokens: z.number().optional().default(2000),
    allowPartialUpdates: z.boolean().optional().default(false),
    timeout: z.number().optional().default(30000), // ms
});

export const ConstraintsSchema = z.object({
    allowDelete: z.boolean().optional().default(false),
    allowNewElements: z.boolean().optional().default(true),
    maxNewElements: z.number().optional().default(5),
    allowedProperties: z.array(z.string()).optional(), // If undefined, all properties allowed
});

export const AITransformQuerySchema = z.object({
    query: z.string().min(1),
    elements: z.array(ExcalidrawElementSchema),
    modelOverride: z.string().optional(),
    budget: BudgetSchema.optional(),
    constraints: ConstraintsSchema.optional(),
});

export type AITransformQuery = z.infer<typeof AITransformQuerySchema>;

// --- Tool Schemas ---

export const MoveElementSchema = z.object({
    id: z.string(),
    dx: z.number().min(-1000).max(1000),
    dy: z.number().min(-1000).max(1000),
});

export const ResizeElementSchema = z.object({
    id: z.string(),
    width: z.number().min(10).max(5000),
    height: z.number().min(10).max(5000),
});

export const UpdateElementStyleSchema = z.object({
    id: z.string(),
    strokeColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    fillStyle: z.enum(["hachure", "cross-hatch", "solid"]).optional(),
    strokeWidth: z.number().min(0.1).max(50).optional(),
});

export const UpdateTextSchema = z.object({
    id: z.string(),
    text: z.string(),
    fontSize: z.number().min(4).max(200).optional(),
});

export const CreateElementSchema = z.object({
    type: z.enum(["rectangle", "ellipse", "diamond", "arrow", "line", "text"]),
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    text: z.string().optional(), // for text type
    strokeColor: z.string().optional(),
    backgroundColor: z.string().optional(),
});

export const CreateElementsSchema = z.object({
    elements: z.array(CreateElementSchema).max(5),
});

export const DeleteElementsSchema = z.object({
    ids: z.array(z.string()),
});

export const GroupElementsSchema = z.object({
    ids: z.array(z.string()),
});

// --- Output Schemas ---

export const OperationLogSchema = z.object({
    tool: z.string(),
    args: z.unknown(),
    status: z.enum(["applied", "rejected", "error"]),
    reason: z.string().optional(),
});

export const AIResponseSchema = z.object({
    success: z.boolean(),
    updatedElements: z.array(ExcalidrawElementSchema),
    metadata: z.object({
        appliedCount: z.number(),
        rejectedCount: z.number(),
        errorCount: z.number(),
        executionTimeMs: z.number(),
        model: z.string(),
        tokensUsed: z.number().optional(),
    }),
    operations: z.array(OperationLogSchema),
    reasoning: z.string().optional(),
    fallback: z.string().optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;
