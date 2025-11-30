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
    collaborators: string[];
    userId: string;
    access: 'private' | 'public';
}

// -----------------------------------------------------------------------------
// Validation Schemas
// -----------------------------------------------------------------------------

export const createNoteInput = z.object({
    id: z.string().optional(),
    title: z.string().nullable().optional(),
    blob: z.unknown(),
    collaborators: z.array(z.string()).optional(),
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
