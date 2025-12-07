import { z } from "zod";

// -----------------------------------------------------------------------------
// Domain Types
// -----------------------------------------------------------------------------

export type ID = string;
export type NoteBlob = unknown; // Opaque JSON blob

export interface NoteVersion {
    version: number;
    blob: NoteBlob;
    title: string | null;
    timestamp: number;
    meta: Record<string, unknown> | null;
}

export interface NoteCurrent {
    id: ID;
    version: number;
    title: string | null;
    blob: NoteBlob;
    createdAt: number;
    updatedAt: number;
    expiresAt: number | null;
    collaborators: string[];
    userId: string;
    access: 'private' | 'public';
    templateId?: string;
}

// -----------------------------------------------------------------------------
// Validation Schemas
// -----------------------------------------------------------------------------

export const createNoteInput = z.object({
    id: z.string().optional(),
    title: z.string().nullable().optional(),
    blob: z.unknown(),
    collaborators: z.array(z.string()).optional(),
    expiresInHours: z.number().optional(),
    templateId: z.string().optional(),
});

export const updateNoteInput = z.object({
    id: z.string(),
    title: z.string().nullable().optional(),
    blob: z.unknown(),
    expectedVersion: z.number().optional(),
    meta: z.record(z.string(), z.any()).optional(),
});

export const idInput = z.object({ id: z.string() });
export const getVersionInput = z.object({ id: z.string(), version: z.number() });

export const getHistoryInput = z.object({
    id: z.string(),
    limit: z.number().min(1).max(100).optional().default(50),
    cursor: z.number().optional(), // version number to start after
    direction: z.enum(['asc', 'desc']).optional().default('desc'),
});

export interface PaginatedHistoryResponse {
    items: NoteVersion[];
    nextCursor: number | null;
}
