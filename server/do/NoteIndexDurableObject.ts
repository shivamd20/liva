import { DurableObject } from "cloudflare:workers";

/**
 * User-specific note entry stored in the index
 */
export interface UserNoteEntry {
    noteId: string;              // Board ID
    title: string | null;
    ownerUserId: string;         // Original owner's ID
    isOwned: boolean;            // true if user owns this board
    visibility: 'public' | 'private';
    version: number;             // For cache invalidation (used by client-side thumbnail cache)
    createdAt: number;           // Board creation time
    updatedAt: number;           // Last board modification
    lastAccessedAt: number;      // Last time THIS user opened it
}

/**
 * Options for listing notes
 */
export interface ListNotesOptions {
    search?: string;             // Title search (case-insensitive)
    filter?: 'all' | 'owned' | 'shared';
    visibility?: 'public' | 'private' | 'all';
    sortBy?: 'lastAccessed' | 'lastUpdated' | 'alphabetical' | 'created';
    sortOrder?: 'asc' | 'desc';
    limit?: number;              // Default 10
    cursor?: string;             // Pagination cursor (encoded offset)
}

/**
 * Paginated response for notes list
 */
export interface ListNotesResponse {
    items: UserNoteEntry[];
    nextCursor: string | null;
    totalCount: number;
}

/**
 * NoteIndexDurableObject - One instance PER USER for maintaining their personal note index
 * Keeps track of all notes the user owns + shared notes they've accessed
 * Uses SQLite for efficient querying, sorting, and pagination
 */
export class NoteIndexDurableObject extends DurableObject {
    private sql: SqlStorage;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        this.initializeTables();
    }

    /**
     * Initialize SQLite tables
     */
    private initializeTables(): void {
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS notes (
                note_id TEXT PRIMARY KEY,
                title TEXT,
                owner_user_id TEXT NOT NULL,
                is_owned INTEGER NOT NULL DEFAULT 0,
                visibility TEXT NOT NULL DEFAULT 'private',
                version INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                last_accessed_at INTEGER NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_notes_is_owned ON notes(is_owned);
            CREATE INDEX IF NOT EXISTS idx_notes_visibility ON notes(visibility);
            CREATE INDEX IF NOT EXISTS idx_notes_last_accessed ON notes(last_accessed_at DESC);
            CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title COLLATE NOCASE);
        `);
        
        // Migration: drop thumbnail_base64 column if it exists (thumbnails now cached client-side)
        try {
            this.sql.exec(`ALTER TABLE notes DROP COLUMN thumbnail_base64`);
        } catch {
            // Column doesn't exist, ignore
        }
    }

    /**
     * Add or update a note that the user owns
     */
    async upsertOwnedNote(entry: Omit<UserNoteEntry, 'isOwned' | 'lastAccessedAt'> & { lastAccessedAt?: number }): Promise<void> {
        const now = Date.now();
        const lastAccessed = entry.lastAccessedAt ?? now;

        this.sql.exec(`
            INSERT INTO notes (note_id, title, owner_user_id, is_owned, visibility, version, created_at, updated_at, last_accessed_at)
            VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
            ON CONFLICT(note_id) DO UPDATE SET
                title = excluded.title,
                visibility = excluded.visibility,
                version = excluded.version,
                updated_at = excluded.updated_at,
                last_accessed_at = MAX(notes.last_accessed_at, excluded.last_accessed_at)
        `,
            entry.noteId,
            entry.title,
            entry.ownerUserId,
            entry.visibility,
            entry.version,
            entry.createdAt,
            entry.updatedAt,
            lastAccessed
        );
    }

    /**
     * Add or update a shared note (one the user doesn't own but has accessed)
     */
    async upsertSharedNote(entry: Omit<UserNoteEntry, 'isOwned'>): Promise<void> {
        this.sql.exec(`
            INSERT INTO notes (note_id, title, owner_user_id, is_owned, visibility, version, created_at, updated_at, last_accessed_at)
            VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
            ON CONFLICT(note_id) DO UPDATE SET
                title = excluded.title,
                visibility = excluded.visibility,
                version = excluded.version,
                updated_at = excluded.updated_at,
                last_accessed_at = MAX(notes.last_accessed_at, excluded.last_accessed_at)
        `,
            entry.noteId,
            entry.title,
            entry.ownerUserId,
            entry.visibility,
            entry.version,
            entry.createdAt,
            entry.updatedAt,
            entry.lastAccessedAt
        );
    }

    /**
     * Remove a note from the index (manual removal or visibility change)
     */
    async removeNote(noteId: string): Promise<void> {
        this.sql.exec(`DELETE FROM notes WHERE note_id = ?`, noteId);
    }

    /**
     * Update the last accessed timestamp
     */
    async updateLastAccessed(noteId: string): Promise<void> {
        const now = Date.now();
        this.sql.exec(`
            UPDATE notes SET last_accessed_at = ? WHERE note_id = ?
        `, now, noteId);
    }

    /**
     * Update note metadata (title, version, updatedAt, visibility)
     * Used when the actual note is updated elsewhere
     */
    async updateNoteMetadata(noteId: string, updates: {
        title?: string | null;
        version?: number;
        updatedAt?: number;
        visibility?: 'public' | 'private';
    }): Promise<void> {
        const setParts: string[] = [];
        const values: any[] = [];

        if (updates.title !== undefined) {
            setParts.push('title = ?');
            values.push(updates.title);
        }
        if (updates.version !== undefined) {
            setParts.push('version = ?');
            values.push(updates.version);
        }
        if (updates.updatedAt !== undefined) {
            setParts.push('updated_at = ?');
            values.push(updates.updatedAt);
        }
        if (updates.visibility !== undefined) {
            setParts.push('visibility = ?');
            values.push(updates.visibility);
        }

        if (setParts.length === 0) return;

        values.push(noteId);
        this.sql.exec(`UPDATE notes SET ${setParts.join(', ')} WHERE note_id = ?`, ...values);
    }

    /**
     * Check if a note exists in the index
     */
    async hasNote(noteId: string): Promise<boolean> {
        const result = this.sql.exec(`SELECT 1 FROM notes WHERE note_id = ? LIMIT 1`, noteId);
        return result.toArray().length > 0;
    }

    /**
     * Get a single note entry
     */
    async getNote(noteId: string): Promise<UserNoteEntry | null> {
        const result = this.sql.exec(`SELECT * FROM notes WHERE note_id = ?`, noteId);
        const rows = result.toArray();
        if (rows.length === 0) return null;
        return this.rowToEntry(rows[0]);
    }

    /**
     * List notes with filtering, sorting, and pagination
     */
    async listNotes(options: ListNotesOptions = {}): Promise<ListNotesResponse> {
        const {
            search,
            filter = 'all',
            visibility = 'all',
            sortBy = 'lastAccessed',
            sortOrder = 'desc',
            limit = 10,
            cursor
        } = options;

        // Build WHERE clause
        const whereClauses: string[] = [];
        const whereValues: any[] = [];

        // Filter by ownership
        if (filter === 'owned') {
            whereClauses.push('is_owned = 1');
        } else if (filter === 'shared') {
            whereClauses.push('is_owned = 0');
        }

        // Filter by visibility
        if (visibility !== 'all') {
            whereClauses.push('visibility = ?');
            whereValues.push(visibility);
        }

        // Search by title
        if (search && search.trim()) {
            whereClauses.push('title LIKE ?');
            whereValues.push(`%${search.trim()}%`);
        }

        const whereClause = whereClauses.length > 0
            ? `WHERE ${whereClauses.join(' AND ')}`
            : '';

        // Build ORDER BY clause
        let orderColumn: string;
        switch (sortBy) {
            case 'alphabetical':
                orderColumn = 'title COLLATE NOCASE';
                break;
            case 'lastUpdated':
                orderColumn = 'updated_at';
                break;
            case 'created':
                orderColumn = 'created_at';
                break;
            case 'lastAccessed':
            default:
                orderColumn = 'last_accessed_at';
                break;
        }
        const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
        const orderClause = `ORDER BY ${orderColumn} ${orderDirection}`;

        // Pagination - cursor is encoded offset
        const offset = cursor ? parseInt(cursor, 10) : 0;

        // Get total count
        const countResult = this.sql.exec(
            `SELECT COUNT(*) as count FROM notes ${whereClause}`,
            ...whereValues
        );
        const totalCount = Number(countResult.toArray()[0].count);

        // Get paginated results
        const queryValues = [...whereValues, limit, offset];
        const result = this.sql.exec(
            `SELECT * FROM notes ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
            ...queryValues
        );

        const items = result.toArray().map(row => this.rowToEntry(row));

        // Calculate next cursor
        const nextOffset = offset + items.length;
        const nextCursor = nextOffset < totalCount ? String(nextOffset) : null;

        return {
            items,
            nextCursor,
            totalCount
        };
    }

    /**
     * Remove all shared notes (notes where is_owned = 0)
     * Used for cleanup
     */
    async removeAllSharedNotes(): Promise<void> {
        this.sql.exec(`DELETE FROM notes WHERE is_owned = 0`);
    }

    /**
     * Mark shared notes as stale if their visibility changed to private
     * This is called lazily during list operations
     */
    async removeStaleSharedNotes(noteIds: string[]): Promise<void> {
        if (noteIds.length === 0) return;
        const placeholders = noteIds.map(() => '?').join(',');
        this.sql.exec(
            `DELETE FROM notes WHERE note_id IN (${placeholders}) AND is_owned = 0`,
            ...noteIds
        );
    }

    /**
     * Convert a database row to UserNoteEntry
     */
    private rowToEntry(row: Record<string, SqlStorageValue>): UserNoteEntry {
        return {
            noteId: row.note_id as string,
            title: row.title as string | null,
            ownerUserId: row.owner_user_id as string,
            isOwned: row.is_owned === 1,
            visibility: row.visibility as 'public' | 'private',
            version: row.version as number,
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number,
            lastAccessedAt: row.last_accessed_at as number
        };
    }

    // =========================================================================
    // LEGACY COMPATIBILITY - These methods are deprecated but kept for migration
    // =========================================================================

    /**
     * @deprecated Use upsertOwnedNote or upsertSharedNote instead
     */
    async upsertNote(entry: {
        id: string;
        title: string | null;
        version: number;
        updatedAt: number;
        createdAt: number;
        userId: string;
    }): Promise<void> {
        // Convert legacy format to new format and store as owned
        await this.upsertOwnedNote({
            noteId: entry.id,
            title: entry.title,
            ownerUserId: entry.userId,
            visibility: 'private',
            version: entry.version,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt
        });
    }

    /**
     * @deprecated Use removeNote instead
     */
    async deleteNote(id: string): Promise<void> {
        await this.removeNote(id);
    }
}
