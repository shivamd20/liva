import { DurableObject } from "cloudflare:workers";
import type {
    ID,
    NoteCurrent,
    NoteVersion,
    NoteBlob,
    PaginatedHistoryResponse,
} from "../notes/types";
import { NoteDatabase } from "./NoteDatabase";
import { HistoryManager } from "./HistoryManager";
import { WebSocketManager } from "./WebSocketManager";

/**
 * NoteDurableObject - One instance per note (SQLite-backed)
 * Maintains complete history and current state for a single note using SQLite storage
 * Supports WebSocket connections for real-time updates
 *
 * Refactored for:
 * - Clean separation of concerns (DB, History, WebSocket)
 * - Fast main update path (history is async)
 * - Easy extensibility and testing
 */
export class NoteDurableObject extends DurableObject {
    private db: NoteDatabase;
    private history: HistoryManager;
    private wsManager: WebSocketManager;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);

        // Initialize components
        this.db = new NoteDatabase(ctx.storage.sql);
        this.history = new HistoryManager(this.db);
        this.wsManager = new WebSocketManager();

        // Initialize database tables
        this.db.initializeTables();
    }

    /**
     * Handle WebSocket upgrade requests and regular RPC calls
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // Handle WebSocket upgrade
        if (url.pathname === "/websocket") {
            return this.handleWebSocketUpgrade(request);
        }

        return new Response("Not found", { status: 404 });
    }

    /**
     * Handle WebSocket upgrade and connection
     */
    private async handleWebSocketUpgrade(request: Request): Promise<Response> {
        const upgradeHeader = request.headers.get("Upgrade");
        if (upgradeHeader !== "websocket") {
            return new Response("Expected Upgrade: websocket", { status: 426 });
        }

        // Authorization check
        const userId = request.headers.get("X-Liva-User-Id");
        const current = this.db.getCurrent();

        if (!current) {
            return new Response("Note not found", { status: 404 });
        }

        if (!this.isAuthorized(userId, current)) {
            return new Response("Unauthorized", { status: 403 });
        }

        // Create WebSocket pair
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);
        server.accept();

        // Setup session
        const sessionId = crypto.randomUUID();
        this.wsManager.addSession(server, sessionId);

        // Send initial state
        this.wsManager.sendInitialState(server, current, sessionId);
        this.wsManager.sendEphemeralState(server, sessionId);

        // Setup event handlers
        this.setupWebSocketHandlers(server, sessionId);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    /**
     * Check if user is authorized to access the note
     */
    private isAuthorized(userId: string | null, current: NoteCurrent): boolean {
        const isPublic = current.access === "public";
        const isOwner = !!(userId && current.userId === userId);
        const isCollaborator = !!(userId && current.collaborators.includes(userId));

        return isPublic || isOwner || isCollaborator;
    }

    /**
     * Setup WebSocket event handlers
     */
    private setupWebSocketHandlers(ws: WebSocket, sessionId: string): void {
        ws.addEventListener("message", (event) => {
            try {
                const msg = JSON.parse(event.data as string);
                this.handleWebSocketMessage(ws, msg);
            } catch (error) {
                // Ignore malformed messages
            }
        });

        ws.addEventListener("close", () => {
            this.wsManager.removeSession(ws);
            this.wsManager.broadcastEphemeral(sessionId, null);
        });

        ws.addEventListener("error", () => {
            this.wsManager.removeSession(ws);
            this.wsManager.broadcastEphemeral(sessionId, null);
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    private handleWebSocketMessage(ws: WebSocket, msg: any): void {
        if (msg.type === "ephemeral") {
            this.handleEphemeralMessage(ws, msg.data);
        } else if (msg.type === "update_event") {
            this.handleUpdateEvent(ws, msg.data);
        }
    }

    /**
     * Handle ephemeral state updates
     */
    private handleEphemeralMessage(ws: WebSocket, data: unknown): void {
        const session = this.wsManager.getSession(ws);
        if (session) {
            this.wsManager.updateEphemeralState(ws, data);
            this.wsManager.broadcastEphemeral(session.id, data);
        }
    }

    /**
     * Handle note update events from WebSocket
     */
    private async handleUpdateEvent(
        ws: WebSocket,
        data: { title?: string; blob: NoteBlob }
    ): Promise<void> {
        try {
            const current = this.db.getCurrent();
            if (!current) return;

            // Check expiration
            if (current.expiresAt && Date.now() > current.expiresAt) {
                // Should probably send error back to client, but for now just return
                console.warn("Attempt to update expired note via WS");
                return;
            }

            // Update note with optimistic locking
            await this.updateNote({
                title: data.title,
                blob: data.blob,
                expectedVersion: current.version,
            });
        } catch (error) {
            console.error("Error handling WebSocket update:", error);
            // Could send error back to client here
        }
    }

    /**
     * Create a new note
     */
    async createNote(params: {
        id: ID;
        title?: string | null;
        blob: NoteBlob;
        collaborators?: string[];
        userId: string;
        access?: "private" | "public";
        expiresInHours?: number;
        templateId?: string;
    }): Promise<NoteCurrent> {
        const existing = this.db.getCurrent();
        if (existing) {
            throw new Error("Note already exists");
        }

        const timestamp = Date.now();
        const initialVersion = 1;
        const access = params.access ?? "private";
        const title = params.title ?? null;
        const collaborators = params.collaborators ?? [];

        let expiresAt: number | null = null;
        if (params.expiresInHours && params.expiresInHours > 0) {
            expiresAt = timestamp + (params.expiresInHours * 60 * 60 * 1000);
        }

        // Insert current note (fast path)
        this.db.insertCurrent({
            id: params.id,
            version: initialVersion,
            title,
            blob: params.blob,
            createdAt: timestamp,
            updatedAt: timestamp,
            expiresAt,
            collaborators,
            userId: params.userId,
            access,
            templateId: params.templateId,
        });

        const current: NoteCurrent = {
            id: params.id,
            version: initialVersion,
            title,
            blob: structuredClone(params.blob),
            createdAt: timestamp,
            updatedAt: timestamp,
            expiresAt,
            collaborators,
            userId: params.userId,
            access,
            templateId: params.templateId,
        };

        // Broadcast immediately (fast)
        this.wsManager.broadcastUpdate(current, "create");

        // Save to history asynchronously (doesn't block)
        this.history.saveInitialVersion({
            version: initialVersion,
            blob: params.blob,
            title,
            timestamp,
        });

        return current;
    }

    /**
   * Update the note with a new version
   * ALWAYS increments version for optimistic locking
   * History debouncing only affects whether we create new history entry or update existing
   */
    async updateNote(params: {
        title?: string | null;
        blob: NoteBlob;
        expectedVersion?: number;
        meta?: Record<string, unknown> | null;
    }): Promise<NoteCurrent> {
        const current = this.db.getCurrent();
        if (!current) {
            throw new Error("Note not found");
        }

        // Optimistic concurrency check
        if (params.expectedVersion !== undefined && params.expectedVersion !== current.version) {
            throw new Error("Version mismatch");
        }

        // Check expiration
        if (current.expiresAt && Date.now() > current.expiresAt) {
            throw new Error("Note has expired and is read-only");
        }

        const timestamp = Date.now();
        const newTitle = params.title ?? current.title;

        // Save to history asynchronously (doesn't block main path)
        // This will decide whether to create new history entry or update existing
        const historyResult = await this.history.saveVersion({
            currentVersion: current.version,
            currentUpdatedAt: current.updatedAt,
            newBlob: params.blob,
            newTitle: newTitle,
            timestamp,
            meta: params.meta,
        });

        // Always increment version (for optimistic locking)
        const nextVersion = historyResult.version;

        // Update current note in DB (fast) - always with new version
        this.db.updateCurrent({
            version: nextVersion,
            title: newTitle,
            blob: params.blob,
            updatedAt: timestamp,
        });

        const newCurrent: NoteCurrent = {
            ...current,
            version: nextVersion,
            title: newTitle,
            blob: structuredClone(params.blob),
            updatedAt: timestamp,
        };

        // Broadcast immediately (fast)
        this.wsManager.broadcastUpdate(newCurrent, "update");

        return newCurrent;
    }

    /**
     * Update access level
     */
    async updateAccess(access: "private" | "public"): Promise<NoteCurrent> {
        const current = this.db.getCurrent();
        if (!current) {
            throw new Error("Note not found");
        }

        if (current.access === access) {
            return current;
        }

        const timestamp = Date.now();

        // Update access (fast)
        this.db.updateAccess(current.id, access, timestamp);

        const newCurrent: NoteCurrent = {
            ...current,
            access,
            updatedAt: timestamp,
        };

        // Broadcast immediately
        this.wsManager.broadcastUpdate(newCurrent, "update");

        return newCurrent;
    }

    /**
     * Update owner
     */
    async updateOwner(userId: string): Promise<NoteCurrent> {
        const current = this.db.getCurrent();
        if (!current) {
            throw new Error("Note not found");
        }

        if (current.userId === userId) {
            return current;
        }

        // Update owner (fast)
        this.db.updateOwner(current.id, userId);

        const newCurrent: NoteCurrent = {
            ...current,
            userId,
        };

        // Broadcast immediately
        this.wsManager.broadcastUpdate(newCurrent, "update");

        return newCurrent;
    }

    /**
     * Revert to a specific version
     */
    async revertToVersion(version: number): Promise<NoteCurrent> {
        const current = this.db.getCurrent();
        if (!current) {
            throw new Error("Note not found");
        }

        // Get target version from history
        const targetVersion = await this.history.getVersion(version);
        if (!targetVersion) {
            throw new Error("Version not found");
        }

        const timestamp = Date.now();
        const nextVersion = current.version + 1;
        const revertedBlob = targetVersion.blob;
        const revertedTitle = targetVersion.title ?? current.title;

        // Update current note (fast)
        this.db.updateCurrent({
            version: nextVersion,
            title: revertedTitle,
            blob: revertedBlob,
            updatedAt: timestamp,
        });

        const newCurrent: NoteCurrent = {
            ...current,
            version: nextVersion,
            title: revertedTitle,
            blob: revertedBlob,
            updatedAt: timestamp,
        };

        // Broadcast immediately (fast)
        this.wsManager.broadcastUpdate(newCurrent, "revert");

        // Save revert to history asynchronously
        this.history.saveRevertVersion({
            version: nextVersion,
            blob: revertedBlob,
            title: revertedTitle,
            timestamp,
            revertedFrom: version,
        });

        return newCurrent;
    }

    /**
     * Get current note state
     */
    async getNote(): Promise<NoteCurrent | null> {
        const current = this.db.getCurrent();
        return current ? structuredClone(current) : null;
    }

    /**
     * Get paginated history
     */
    async getHistory(
        limit: number = 50,
        cursor?: number,
        direction: "asc" | "desc" = "desc"
    ): Promise<PaginatedHistoryResponse> {
        return this.history.getHistory({ limit, cursor, direction });
    }

    /**
     * Get a specific version
     */
    async getVersion(version: number): Promise<NoteVersion | null> {
        return this.history.getVersion(version);
    }

    /**
     * Delete the note and all its history
     */
    async deleteNote(): Promise<void> {
        const current = this.db.getCurrent();

        // Delete from database
        this.db.deleteCurrent();
        await this.history.deleteAll();

        // Broadcast delete and close all connections
        // Broadcast delete and close all connections
        this.wsManager.broadcastDelete(current?.id ?? "deleted");
    }

    /**
     * Add a recording
     */
    async addRecording(params: {
        sessionId: string;
        duration: number;
        title?: string;
    }): Promise<void> {
        this.db.addRecording(params);
        // We could broadcast here if we had a "recordings_update" event
    }

    /**
     * Update recording YouTube ID
     */
    async updateRecordingYouTubeId(sessionId: string, videoId: string): Promise<void> {
        this.db.updateRecordingYouTubeId(sessionId, videoId);
    }

    /**
     * Get recordings
     */
    async getRecordings(): Promise<Array<{
        sessionId: string;
        duration: number;
        createdAt: number;
        title: string | null;
        youtubeVideoId?: string;
    }>> {
        return this.db.getRecordings();
    }
}
