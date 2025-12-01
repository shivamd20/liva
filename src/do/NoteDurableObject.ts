
import { DurableObject } from "cloudflare:workers";
import type {
    ID,
    NoteCurrent,
    NoteVersion,
    NoteBlob,
    PaginatedHistoryResponse,
} from "../notes/types";

interface WebSocketSession {
    id: string;
    ws: WebSocket;
    ephemeral?: unknown;
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
            CREATE TABLE IF NOT EXISTS note_current(
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    title TEXT,
    blob TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    collaborators TEXT NOT NULL,
    user_id TEXT NOT NULL,
    access TEXT NOT NULL DEFAULT 'private'
);
`);

        // Attempt to add 'access' column if it doesn't exist (migration)
        try {
            this.sql.exec("ALTER TABLE note_current ADD COLUMN access TEXT NOT NULL DEFAULT 'private'");
        } catch (e) {
            // Ignore error if column already exists
        }

        // Table for note version history
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS note_history(
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

            // Auth Check
            const userId = request.headers.get("X-Liva-User-Id");
            const current = this.getCurrentFromDB();

            if (!current) {
                return new Response("Note not found", { status: 404 });
            }

            const isPublic = current.access === 'public';
            const isOwner = userId && current.userId === userId;
            const isCollaborator = userId && current.collaborators.includes(userId);

            if (!isPublic && !isOwner && !isCollaborator) {
                return new Response("Unauthorized", { status: 403 });
            }

            const webSocketPair = new WebSocketPair();
            const [client, server] = Object.values(webSocketPair);

            server.accept();

            const sessionId = crypto.randomUUID();
            const session: WebSocketSession = { id: sessionId, ws: server };
            this.sessions.set(server, session);

            // Send current note state immediately upon connection
            if (current) {
                server.send(JSON.stringify({
                    type: "initial",
                    data: current,
                    sessionId: sessionId,
                }));
            }

            // Send existing ephemeral state from other clients
            const ephemeralState: Record<string, unknown> = {};
            for (const s of this.sessions.values()) {
                if (s.id !== sessionId && s.ephemeral) {
                    ephemeralState[s.id] = s.ephemeral;
                }
            }
            if (Object.keys(ephemeralState).length > 0) {
                server.send(JSON.stringify({
                    type: "ephemeral_state",
                    data: ephemeralState
                }));
            }

            server.addEventListener("message", (event) => {
                try {
                    const msg = JSON.parse(event.data as string);
                    this.handleMessage(server, msg);
                } catch (error) {
                    // Ignore malformed messages
                }
            });

            server.addEventListener("close", () => {
                this.sessions.delete(server);
                this.broadcastEphemeral(sessionId, null); // Notify others of disconnection/cleared state
            });

            server.addEventListener("error", () => {
                this.sessions.delete(server);
                this.broadcastEphemeral(sessionId, null);
            });

            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }

        return new Response("Not found", { status: 404 });
    }

    /**
     * Handle incoming WebSocket messages
     */
    private handleMessage(ws: WebSocket, msg: any) {
        if (msg.type === "ephemeral") {
            const session = this.sessions.get(ws);
            if (session) {
                // Update ephemeral state
                session.ephemeral = msg.data;
                // Broadcast to all clients
                this.broadcastEphemeral(session.id, msg.data);
            }
        } else if (msg.type === "update_event") {
            const session = this.sessions.get(ws);
            if (session) {
                this.handleUpdateEvent(ws, msg.data);
            }
        }
    }

    /**
     * Handle update event from WebSocket
     */
    private async handleUpdateEvent(ws: WebSocket, data: { title?: string; blob: NoteBlob }) {
        try {
            const current = this.getCurrentFromDB();
            if (!current) return;

            // Basic permissions check (should match fetch handler)
            // We rely on initial connection auth, but re-checking here is safer if we passed userId in session
            // For now, we assume if they are connected, they are authorized to update 
            // (since we check permissions on connect)

            await this.updateNote({
                title: data.title,
                blob: data.blob,
                expectedVersion: current.version // Optimistic locking
            });
        } catch (error) {
            console.error("Error handling WebSocket update:", error);
            // Optionally send error back to client
        }
    }

    /**
     * Broadcast ephemeral state change
     */
    private broadcastEphemeral(senderId: string, data: unknown) {
        const message = JSON.stringify({
            type: "ephemeral",
            senderId,
            data,
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
            access: row.access as 'private' | 'public',
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
        access?: 'private' | 'public';
    }): Promise<NoteCurrent> {
        const existing = this.getCurrentFromDB();
        if (existing) {
            throw new Error("Note already exists");
        }

        const timestamp = Date.now();
        const initialVersion = 1;
        const access = params.access ?? 'private';

        // Insert current note
        this.sql.exec(
            `INSERT INTO note_current(id, version, title, blob, created_at, updated_at, collaborators, user_id, access)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params.id,
            initialVersion,
            params.title ?? null,
            JSON.stringify(params.blob),
            timestamp,
            timestamp,
            JSON.stringify(params.collaborators ?? []),
            params.userId,
            access
        );

        // Insert initial version into history
        this.sql.exec(
            `INSERT INTO note_history(version, blob, title, timestamp, meta)
VALUES(?, ?, ?, ?, ?)`,
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
            access: access,
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

        const timestamp = Date.now();
        const newTitle = params.title ?? current.title;
        const timeDiff = timestamp - current.updatedAt;
        const debounceTime = 5000; // 5 seconds

        let nextVersion: number;
        let newCurrent: NoteCurrent;

        if (timeDiff < debounceTime && current.version > 1) {
            // Debounced update: replace the last history entry
            nextVersion = current.version;

            // Update current note (without changing version)
            this.sql.exec(
                `UPDATE note_current
                 SET title = ?, blob = ?, updated_at = ?`,
                newTitle,
                JSON.stringify(params.blob),
                timestamp
            );

            // Update the latest entry in history
            this.sql.exec(
                `UPDATE note_history
                 SET blob = ?, title = ?, timestamp = ?, meta = ?
                 WHERE version = ?`,
                JSON.stringify(params.blob),
                newTitle,
                timestamp,
                params.meta ? JSON.stringify(params.meta) : null,
                nextVersion
            );

            newCurrent = {
                ...current,
                title: newTitle,
                blob: structuredClone(params.blob),
                updatedAt: timestamp,
            };

        } else {
            // New history entry
            nextVersion = current.version + 1;

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
                `INSERT INTO note_history(version, blob, title, timestamp, meta)
VALUES(?, ?, ?, ?, ?)`,
                nextVersion,
                JSON.stringify(params.blob),
                newTitle,
                timestamp,
                params.meta ? JSON.stringify(params.meta) : null
            );

            newCurrent = {
                ...current,
                version: nextVersion,
                title: newTitle,
                blob: structuredClone(params.blob),
                updatedAt: timestamp,
            };
        }

        this.broadcastUpdate(newCurrent, "update");
        return newCurrent;
    }

    /**
     * Update access level
     */
    async updateAccess(access: 'private' | 'public'): Promise<NoteCurrent> {
        const current = this.getCurrentFromDB();
        if (!current) {
            throw new Error("Note not found");
        }

        if (current.access === access) {
            return current;
        }

        const timestamp = Date.now();

        this.sql.exec(
            `UPDATE note_current SET access = ?, updated_at = ? WHERE id = ? `,
            access,
            timestamp,
            current.id
        );

        const newCurrent: NoteCurrent = {
            ...current,
            access,
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
             SET version = ?, title = ?, blob = ?, updated_at = ? `,
            nextVersion,
            revertedTitle,
            JSON.stringify(revertedBlob),
            timestamp
        );

        // Insert revert version into history
        this.sql.exec(
            `INSERT INTO note_history(version, blob, title, timestamp, meta)
VALUES(?, ?, ?, ?, ?)`,
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
 * Get paginated history
 */
    async getHistory(limit: number = 50, cursor?: number, direction: 'asc' | 'desc' = 'desc'): Promise<PaginatedHistoryResponse> {
        let query = "SELECT * FROM note_history";
        const params: any[] = [];
        const conditions: string[] = [];

        if (cursor !== undefined) {
            if (direction === 'desc') {
                conditions.push("version < ?");
            } else {
                conditions.push("version > ?");
            }
            params.push(cursor);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += ` ORDER BY version ${direction === 'asc' ? 'ASC' : 'DESC'} `;
        query += " LIMIT ?";
        params.push(limit + 1); // Fetch one extra to check for next page

        const results = this.sql.exec(query, ...params).toArray();

        let nextCursor: number | null = null;
        if (results.length > limit) {
            const nextItem = results.pop(); // Remove the extra item
            // For desc, the cursor for the next page is the version of the last item returned
            // Actually, standard cursor pagination usually uses the last item's ID/sort key as the cursor for the next page.
            // If we requested limit 50 and got 51, there is a next page.
            // The cursor for the next request should be the version of the last item in the *current* result set (the 50th item).
            // Wait, if we are sorting by version DESC, and we have versions 100 down to 51.
            // Next request should start after 51, so version < 51.
            // So nextCursor should be 51.
            const lastItem = results[results.length - 1] as any;
            nextCursor = lastItem.version;
        }

        const items = results.map((row: any) => ({
            version: row.version,
            blob: JSON.parse(row.blob),
            title: row.title,
            timestamp: row.timestamp,
            meta: row.meta ? JSON.parse(row.meta) : null,
        }));

        return {
            items,
            nextCursor
        };
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
