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

// -----------------------------------------------------------------------------
// User Note Index Types & Schemas
// -----------------------------------------------------------------------------

export const listNotesInput = z.object({
    search: z.string().optional(),
    filter: z.enum(['all', 'owned', 'shared']).optional().default('all'),
    visibility: z.enum(['public', 'private', 'all']).optional().default('all'),
    sortBy: z.enum(['lastAccessed', 'lastUpdated', 'alphabetical', 'created']).optional().default('lastAccessed'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    limit: z.number().min(1).max(50).optional().default(10),
    cursor: z.string().optional(),
});

// Input type (what you can pass in - all optional)
export type ListNotesInput = z.input<typeof listNotesInput>;

// Output type (what you get after parsing - defaults applied)
export type ListNotesOutput = z.output<typeof listNotesInput>;

export interface UserNoteEntryResponse {
    noteId: string;
    title: string | null;
    ownerUserId: string;
    isOwned: boolean;
    visibility: 'public' | 'private';
    version: number;
    createdAt: number;
    updatedAt: number;
    lastAccessedAt: number;
}

export interface ListNotesResponse {
    items: UserNoteEntryResponse[];
    nextCursor: string | null;
    totalCount: number;
}

export const trackBoardAccessInput = z.object({
    noteId: z.string(),
});

export const removeSharedBoardInput = z.object({
    noteId: z.string(),
});
