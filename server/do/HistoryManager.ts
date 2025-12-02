import type { NoteCurrent, NoteBlob, NoteVersion } from "../notes/types";
import type { NoteDatabase } from "./NoteDatabase";

/**
 * History Manager - Handles all history-related operations asynchronously
 * This allows the main note update path to be fast while history is handled in the background
 */
export class HistoryManager {
    private db: NoteDatabase;
    private debounceTime: number;

    constructor(db: NoteDatabase, debounceTime: number = 5000) {
        this.db = db;
        this.debounceTime = debounceTime;
    }

    /**
     * Save initial version to history (async operation)
     */
    async saveInitialVersion(params: {
        version: number;
        blob: NoteBlob;
        title: string | null;
        timestamp: number;
    }): Promise<void> {
        // This runs asynchronously - fire and forget
        this.db.insertHistoryVersion({
            version: params.version,
            blob: params.blob,
            title: params.title,
            timestamp: params.timestamp,
            meta: null,
        });
    }

    /**
   * Save or update history version based on debounce logic
   * ALWAYS increments version (for optimistic locking)
   * Debouncing only affects whether we create a new history entry or update the last one
   */
    async saveVersion(params: {
        currentVersion: number;
        currentUpdatedAt: number;
        newBlob: NoteBlob;
        newTitle: string | null;
        timestamp: number;
        meta?: Record<string, unknown> | null;
    }): Promise<{ version: number; shouldSaveToHistory: boolean }> {
        const timeDiff = params.timestamp - params.currentUpdatedAt;
        const shouldDebounce = timeDiff < this.debounceTime && params.currentVersion > 1;

        // Always increment version for optimistic locking
        const newVersion = params.currentVersion + 1;

        if (shouldDebounce) {
            // Update existing history entry (debounced)
            // We update the PREVIOUS version's entry with the new data
            this.db.updateHistoryVersion({
                version: params.currentVersion,
                blob: params.newBlob,
                title: params.newTitle,
                timestamp: params.timestamp,
                meta: params.meta ?? null,
            });

            return {
                version: newVersion,
                shouldSaveToHistory: false, // We updated existing entry
            };
        } else {
            // Create new history entry
            this.db.insertHistoryVersion({
                version: newVersion,
                blob: params.newBlob,
                title: params.newTitle,
                timestamp: params.timestamp,
                meta: params.meta ?? null,
            });

            return {
                version: newVersion,
                shouldSaveToHistory: true, // We created new entry
            };
        }
    }

    /**
     * Save revert version to history
     */
    async saveRevertVersion(params: {
        version: number;
        blob: NoteBlob;
        title: string | null;
        timestamp: number;
        revertedFrom: number;
    }): Promise<void> {
        this.db.insertHistoryVersion({
            version: params.version,
            blob: params.blob,
            title: params.title,
            timestamp: params.timestamp,
            meta: { revertedFrom: params.revertedFrom },
        });
    }

    /**
     * Get a specific version from history
     */
    async getVersion(version: number): Promise<NoteVersion | null> {
        return this.db.getVersion(version);
    }

    /**
     * Get paginated history
     */
    async getHistory(params: {
        limit: number;
        cursor?: number;
        direction: "asc" | "desc";
    }): Promise<{ items: NoteVersion[]; nextCursor: number | null }> {
        const { rows, hasMore } = this.db.getHistory(params);

        const items = rows.map((row: any) => ({
            version: row.version,
            blob: JSON.parse(row.blob),
            title: row.title,
            timestamp: row.timestamp,
            meta: row.meta ? JSON.parse(row.meta) : null,
        }));

        let nextCursor: number | null = null;
        if (hasMore && items.length > 0) {
            const lastItem = items[items.length - 1];
            nextCursor = lastItem.version;
        }

        return { items, nextCursor };
    }

    /**
     * Delete all history
     */
    async deleteAll(): Promise<void> {
        this.db.deleteHistory();
    }
}
