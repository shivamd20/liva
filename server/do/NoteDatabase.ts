import type { NoteCurrent, NoteVersion, NoteBlob } from "../notes/types";
import { QUERIES } from "./queries";

/**
 * Database layer for NoteDurableObject
 * Handles all direct SQL operations with clean interfaces
 */
export class NoteDatabase {
    private sql: SqlStorage;

    constructor(sql: SqlStorage) {
        this.sql = sql;
    }

    /**
     * Initialize database tables
     */
    initializeTables(): void {
        this.sql.exec(QUERIES.CREATE_NOTE_CURRENT_TABLE);
        this.sql.exec(QUERIES.CREATE_NOTE_HISTORY_TABLE);
        this.sql.exec(QUERIES.CREATE_HISTORY_INDEX);

        // Migration: Add access column if it doesn't exist
        try {
            this.sql.exec(QUERIES.ADD_ACCESS_COLUMN);
        } catch (e) {
            // Column already exists, ignore
        }

        // Migration: Add expires_at column if it doesn't exist
        try {
            this.sql.exec(QUERIES.ADD_EXPIRES_AT_COLUMN);
        } catch (e) {
            // Column already exists, ignore
        }

        // Migration: Add template_id column if it doesn't exist
        try {
            this.sql.exec(QUERIES.ADD_TEMPLATE_ID_COLUMN);
        } catch (e) {
            // Column already exists, ignore
        }

        // Initialize Recordings Table
        this.sql.exec(QUERIES.CREATE_NOTE_RECORDINGS_TABLE);
        this.sql.exec(QUERIES.CREATE_RECORDINGS_INDEX);

        // Migration: Add youtube_video_id column if it doesn't exist
        try {
            this.sql.exec(QUERIES.ADD_YOUTUBE_VIDEO_ID_COLUMN);
        } catch (e) {
            // Column already exists, ignore
        }
    }

    /**
     * Get current note from database
     */
    getCurrent(): NoteCurrent | null {
        const result = this.sql.exec(QUERIES.GET_CURRENT_NOTE).toArray();

        if (result.length === 0) {
            return null;
        }

        const row = result[0] as any;
        return {
            id: row.id,
            version: row.version,
            title: row.title,
            blob: JSON.parse(row.blob),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            expiresAt: row.expires_at, // can be null
            collaborators: JSON.parse(row.collaborators),
            userId: row.user_id,
            access: row.access as "private" | "public",
            templateId: row.template_id,
        };
    }

    /**
     * Insert new note
     */
    insertCurrent(params: {
        id: string;
        version: number;
        title: string | null;
        blob: NoteBlob;
        createdAt: number;
        updatedAt: number;
        expiresAt: number | null;
        collaborators: string[];
        userId: string;
        access: "private" | "public";
        templateId?: string;
    }): void {
        this.sql.exec(
            QUERIES.INSERT_CURRENT_NOTE,
            params.id,
            params.version,
            params.title,
            JSON.stringify(params.blob),
            params.createdAt,
            params.updatedAt,
            params.expiresAt,
            JSON.stringify(params.collaborators),
            params.userId,
            params.access,
            params.templateId || null
        );
    }

    /**
     * Update current note (always updates version)
     */
    updateCurrent(params: {
        version: number;
        title: string | null;
        blob: NoteBlob;
        updatedAt: number;
    }): void {
        this.sql.exec(
            QUERIES.UPDATE_CURRENT_NOTE,
            params.version,
            params.title,
            JSON.stringify(params.blob),
            params.updatedAt
        );
    }

    /**
     * Update access level
     */
    updateAccess(id: string, access: "private" | "public", updatedAt: number): void {
        this.sql.exec(QUERIES.UPDATE_ACCESS, access, updatedAt, id);
    }

    /**
     * Update owner
     */
    updateOwner(id: string, userId: string): void {
        this.sql.exec(QUERIES.UPDATE_OWNER, userId, id);
    }

    /**
     * Delete current note
     */
    deleteCurrent(): void {
        this.sql.exec(QUERIES.DELETE_CURRENT_NOTE);
    }

    /**
     * Get specific version from history
     */
    getVersion(version: number): NoteVersion | null {
        const result = this.sql.exec(QUERIES.GET_VERSION, version).toArray();

        if (result.length === 0) {
            return null;
        }

        const row = result[0] as any;
        return {
            version: row.version,
            blob: JSON.parse(row.blob),
            title: row.title,
            timestamp: row.timestamp,
            meta: row.meta ? JSON.parse(row.meta) : null,
        };
    }

    /**
     * Get paginated history
     */
    getHistory(params: {
        limit: number;
        cursor?: number;
        direction: "asc" | "desc";
    }): { rows: any[]; hasMore: boolean } {
        let query = "SELECT * FROM note_history";
        const queryParams: any[] = [];
        const conditions: string[] = [];

        if (params.cursor !== undefined) {
            if (params.direction === "desc") {
                conditions.push("version < ?");
            } else {
                conditions.push("version > ?");
            }
            queryParams.push(params.cursor);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += ` ORDER BY version ${params.direction === "asc" ? "ASC" : "DESC"} `;
        query += " LIMIT ?";
        queryParams.push(params.limit + 1); // Fetch one extra to check for next page

        const results = this.sql.exec(query, ...queryParams).toArray();
        const hasMore = results.length > params.limit;

        if (hasMore) {
            results.pop(); // Remove the extra item
        }

        return { rows: results, hasMore };
    }

    /**
     * Insert history version
     */
    insertHistoryVersion(params: {
        version: number;
        blob: NoteBlob;
        title: string | null;
        timestamp: number;
        meta: Record<string, unknown> | null;
    }): void {
        this.sql.exec(
            QUERIES.INSERT_HISTORY_VERSION,
            params.version,
            JSON.stringify(params.blob),
            params.title,
            params.timestamp,
            params.meta ? JSON.stringify(params.meta) : null
        );
    }

    /**
     * Update history version (for debounced updates)
     */
    updateHistoryVersion(params: {
        version: number;
        blob: NoteBlob;
        title: string | null;
        timestamp: number;
        meta: Record<string, unknown> | null;
    }): void {
        this.sql.exec(
            QUERIES.UPDATE_HISTORY_VERSION,
            JSON.stringify(params.blob),
            params.title,
            params.timestamp,
            params.meta ? JSON.stringify(params.meta) : null,
            params.version
        );
    }

    /**
     * Delete all history
     */
    deleteHistory(): void {
        this.sql.exec(QUERIES.DELETE_HISTORY);
    }

    /**
     * Add a recording to the note
     */
    addRecording(params: {
        sessionId: string;
        duration: number;
        title?: string;
    }): void {
        this.sql.exec(
            QUERIES.INSERT_RECORDING,
            params.sessionId,
            params.duration,
            Date.now(),
            params.title || null
        );
    }

    /**
     * Update recording YouTube Video ID
     */
    updateRecordingYouTubeId(sessionId: string, videoId: string): void {
        this.sql.exec(QUERIES.UPDATE_RECORDING_YOUTUBE_ID, videoId, sessionId);
    }

    /**
     * Get all recordings for this note
     */
    getRecordings(): Array<{
        sessionId: string;
        duration: number;
        createdAt: number;
        title: string | null;
    }> {
        const results = this.sql.exec(QUERIES.GET_RECORDINGS).toArray();
        return results.map((row: any) => ({
            sessionId: row.session_id,
            duration: row.duration,
            createdAt: row.created_at,
            title: row.title,
            youtubeVideoId: row.youtube_video_id,
        }));
    }
}
