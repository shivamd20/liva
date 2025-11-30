import { DurableObject } from "cloudflare:workers";
import type {
    ID,
    NoteCurrent,
    NoteVersion,
    NoteBlob,
} from "../notes/types";

interface WebSocketSession {
    id: string;
    ws: WebSocket;
}

/**
 * NoteDurableObject - One instance per note (SQLite-backed)
 * Maintains complete history and current state for a single note using SQLite storage
 * Supports WebSocket connections for real-time updates
 */
export class NoteDurableObject extends DurableObject {
    private sessions: Map<WebSocket, WebSocketSession>;
    private sql: SqlStorage;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sessions = new Map();
        this.sql = ctx.storage.sql;

        // Initialize SQLite tables
        this.initializeTables();
    }

    /**
     * Initialize SQLite tables for note storage
     */
    private initializeTables(): void {
        // Table for current note state
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS note_current (
                id TEXT PRIMARY KEY,
                version INTEGER NOT NULL,
                title TEXT,
                blob TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                collaborators TEXT NOT NULL,
                user_id TEXT NOT NULL
            );
        `);

        // Table for note version history
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS note_history (
                version INTEGER PRIMARY KEY,
                blob TEXT NOT NULL,
                title TEXT,
                timestamp INTEGER NOT NULL,
                meta TEXT
            );
        `);

        // Index for faster history queries
        this.sql.exec(`
            CREATE INDEX IF NOT EXISTS idx_history_version 
            ON note_history(version);
        `);
    }

    /**
     * Handle WebSocket upgrade requests and regular RPC calls
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // Handle WebSocket upgrade
        if (url.pathname === "/websocket") {
            const upgradeHeader = request.headers.get("Upgrade");
            if (upgradeHeader !== "websocket") {
                return new Response("Expected Upgrade: websocket", { status: 426 });
            }

            const webSocketPair = new WebSocketPair();
            const [client, server] = Object.values(webSocketPair);

            server.accept();

            const sessionId = crypto.randomUUID();
            const session: WebSocketSession = { id: sessionId, ws: server };
            this.sessions.set(server, session);

            // Send current note state immediately upon connection
            const current = this.getCurrentFromDB();
            if (current) {
                server.send(JSON.stringify({
                    type: "initial",
                    data: current,
                }));
            }

            server.addEventListener("close", () => {
                this.sessions.delete(server);
            });

            server.addEventListener("error", () => {
                this.sessions.delete(server);
            });

            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }

        return new Response("Not found", { status: 404 });
    }

    /**
     * Broadcast note changes to all connected WebSocket clients
     */
    private broadcastUpdate(current: NoteCurrent, updateType: "update" | "revert" | "create") {
        const message = JSON.stringify({
            type: updateType,
            data: current,
        });

        this.sessions.forEach((session) => {
            try {
                session.ws.send(message);
            } catch (error) {
                // Remove failed connections
                this.sessions.delete(session.ws);
            }
        });
    }

    /**
     * Get current note from database
     */
    private getCurrentFromDB(): NoteCurrent | null {
        const result = this.sql.exec(
            "SELECT * FROM note_current LIMIT 1"
        ).toArray();

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
            collaborators: JSON.parse(row.collaborators),
            userId: row.user_id,
        };
    }

    /**
     * Initialize a new note
     */
    async createNote(params: {
        id: ID;
        title?: string | null;
        blob: NoteBlob;
        collaborators?: string[];
        userId: string;
    }): Promise<NoteCurrent> {
        const existing = this.getCurrentFromDB();
        if (existing) {
            throw new Error("Note already exists");
        }

        const timestamp = Date.now();
        const initialVersion = 1;

        // Insert current note
        this.sql.exec(
            `INSERT INTO note_current (id, version, title, blob, created_at, updated_at, collaborators, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            params.id,
            initialVersion,
            params.title ?? null,
            JSON.stringify(params.blob),
            timestamp,
            timestamp,
            JSON.stringify(params.collaborators ?? []),
            params.userId
        );

        // Insert initial version into history
        this.sql.exec(
            `INSERT INTO note_history (version, blob, title, timestamp, meta)
             VALUES (?, ?, ?, ?, ?)`,
            initialVersion,
            JSON.stringify(params.blob),
            params.title ?? null,
            timestamp,
            null
        );

        const current: NoteCurrent = {
            id: params.id,
            version: initialVersion,
            title: params.title ?? null,
            blob: structuredClone(params.blob),
            createdAt: timestamp,
            updatedAt: timestamp,
            collaborators: params.collaborators ?? [],
            userId: params.userId,
        };

        this.broadcastUpdate(current, "create");
        return current;
    }

    /**
     * Update the note with a new version
     */
    async updateNote(params: {
        title?: string | null;
        blob: NoteBlob;
        expectedVersion?: number;
        meta?: Record<string, unknown> | null;
    }): Promise<NoteCurrent> {
        const current = this.getCurrentFromDB();
        if (!current) {
            throw new Error("Note not found");
        }

        // Optimistic concurrency check
        if (params.expectedVersion !== undefined && params.expectedVersion !== current.version) {
            throw new Error("Version mismatch");
        }

        const nextVersion = current.version + 1;
        const timestamp = Date.now();
        const newTitle = params.title ?? current.title;

        // Update current note
        this.sql.exec(
            `UPDATE note_current 
             SET version = ?, title = ?, blob = ?, updated_at = ?`,
            nextVersion,
            newTitle,
            JSON.stringify(params.blob),
            timestamp
        );

        // Insert new version into history
        this.sql.exec(
            `INSERT INTO note_history (version, blob, title, timestamp, meta)
             VALUES (?, ?, ?, ?, ?)`,
            nextVersion,
            JSON.stringify(params.blob),
            newTitle,
            timestamp,
            params.meta ? JSON.stringify(params.meta) : null
        );

        const newCurrent: NoteCurrent = {
            ...current,
            version: nextVersion,
            title: newTitle,
            blob: structuredClone(params.blob),
            updatedAt: timestamp,
        };

        this.broadcastUpdate(newCurrent, "update");
        return newCurrent;
    }

    /**
     * Revert to a specific version
     */
    async revertToVersion(version: number): Promise<NoteCurrent> {
        const current = this.getCurrentFromDB();
        if (!current) {
            throw new Error("Note not found");
        }

        const targetVersionResult = this.sql.exec(
            "SELECT * FROM note_history WHERE version = ?",
            version
        ).toArray();

        if (targetVersionResult.length === 0) {
            throw new Error("Version not found");
        }

        const targetVersion = targetVersionResult[0] as any;
        const nextVersion = current.version + 1;
        const timestamp = Date.now();
        const revertedBlob = JSON.parse(targetVersion.blob);
        const revertedTitle = targetVersion.title ?? current.title;

        // Update current note
        this.sql.exec(
            `UPDATE note_current 
             SET version = ?, title = ?, blob = ?, updated_at = ?`,
            nextVersion,
            revertedTitle,
            JSON.stringify(revertedBlob),
            timestamp
        );

        // Insert revert version into history
        this.sql.exec(
            `INSERT INTO note_history (version, blob, title, timestamp, meta)
             VALUES (?, ?, ?, ?, ?)`,
            nextVersion,
            JSON.stringify(revertedBlob),
            revertedTitle,
            timestamp,
            JSON.stringify({ revertedFrom: version })
        );

        const newCurrent: NoteCurrent = {
            ...current,
            version: nextVersion,
            title: revertedTitle,
            blob: revertedBlob,
            updatedAt: timestamp,
        };

        this.broadcastUpdate(newCurrent, "revert");
        return newCurrent;
    }

    /**
     * Get current note state
     */
    async getNote(): Promise<NoteCurrent | null> {
        const current = this.getCurrentFromDB();
        return current ? structuredClone(current) : null;
    }

    /**
     * Get complete history
     */
    async getHistory(): Promise<NoteVersion[]> {
        const results = this.sql.exec(
            "SELECT * FROM note_history ORDER BY version ASC"
        ).toArray();

        return results.map((row: any) => ({
            version: row.version,
            blob: JSON.parse(row.blob),
            title: row.title,
            timestamp: row.timestamp,
            meta: row.meta ? JSON.parse(row.meta) : null,
        }));
    }

    /**
     * Get a specific version
     */
    async getVersion(version: number): Promise<NoteVersion | null> {
        const result = this.sql.exec(
            "SELECT * FROM note_history WHERE version = ?",
            version
        ).toArray();

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
     * Delete the note and all its history
     */
    async deleteNote(): Promise<void> {
        // Delete current note
        this.sql.exec("DELETE FROM note_current");

        // Delete history
        this.sql.exec("DELETE FROM note_history");

        // Broadcast delete event to all connected clients
        const message = JSON.stringify({
            type: "delete",
            data: { id: "deleted" }
        });

        this.sessions.forEach((session) => {
            try {
                session.ws.send(message);
                session.ws.close(1000, "Note deleted");
            } catch (error) {
                // Ignore
            }
        });
        this.sessions.clear();
    }
}
