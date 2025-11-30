import { DurableObject } from "cloudflare:workers";

interface NoteIndexEntry {
    id: string;
    title: string | null;
    version: number;
    updatedAt: number;
    createdAt: number;
    userId: string;
}

/**
 * NoteIndexDurableObject - Single instance for maintaining note index
 * Keeps track of all notes for listing purposes
 */
export class NoteIndexDurableObject extends DurableObject {
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
    }

    /**
     * Add or update a note in the index
     */
    async upsertNote(entry: NoteIndexEntry): Promise<void> {
        await this.ctx.storage.put(`note:${entry.id}`, entry);
    }

    /**
     * Remove a note from the index
     */
    async deleteNote(id: string): Promise<void> {
        await this.ctx.storage.delete(`note:${id}`);
    }

    /**
     * List all notes for a specific user, sorted by updatedAt descending
     */
    async listNotes(userId?: string): Promise<NoteIndexEntry[]> {
        const entries = await this.ctx.storage.list<NoteIndexEntry>({ prefix: "note:" });
        let notes = Array.from(entries.values());

        // Filter by userId if provided
        if (userId) {
            notes = notes.filter(note => note.userId === userId);
        }

        return notes.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /**
     * Get a specific note entry
     */
    async getNote(id: string): Promise<NoteIndexEntry | null> {
        return (await this.ctx.storage.get<NoteIndexEntry>(`note:${id}`)) ?? null;
    }
}
