import type { NoteCurrent } from "../notes/types";

/**
 * WebSocket session information
 */
export interface WebSocketSession {
    id: string;
    ws: WebSocket;
    ephemeral?: unknown;
}

/**
 * WebSocket message types
 */
export type WSMessage =
    | { type: "initial"; data: NoteCurrent; sessionId: string }
    | { type: "ephemeral_state"; data: Record<string, unknown> }
    | { type: "ephemeral"; senderId: string; data: unknown }
    | { type: "update" | "revert" | "create"; data: NoteCurrent }
    | { type: "delete"; data: { id: string } };

/**
 * WebSocket Manager - Handles all WebSocket connections and broadcasting
 * Separated from main DO logic for cleaner code organization
 */
export class WebSocketManager {
    private sessions: Map<WebSocket, WebSocketSession>;

    constructor() {
        this.sessions = new Map();
    }

    /**
     * Add a new WebSocket session
     */
    addSession(ws: WebSocket, sessionId: string): WebSocketSession {
        const session: WebSocketSession = { id: sessionId, ws };
        this.sessions.set(ws, session);
        return session;
    }

    /**
     * Remove a WebSocket session
     */
    removeSession(ws: WebSocket): void {
        this.sessions.delete(ws);
    }

    /**
     * Get session by WebSocket
     */
    getSession(ws: WebSocket): WebSocketSession | undefined {
        return this.sessions.get(ws);
    }

    /**
     * Get all sessions
     */
    getAllSessions(): WebSocketSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Clear all sessions
     */
    clearSessions(): void {
        this.sessions.clear();
    }

    /**
     * Send initial state to a newly connected client
     */
    sendInitialState(ws: WebSocket, current: NoteCurrent, sessionId: string): void {
        const message: WSMessage = {
            type: "initial",
            data: current,
            sessionId,
        };
        this.sendToClient(ws, message);
    }

    /**
     * Send ephemeral state from other clients
     */
    sendEphemeralState(ws: WebSocket, excludeSessionId: string): void {
        const ephemeralState: Record<string, unknown> = {};

        for (const session of this.sessions.values()) {
            if (session.id !== excludeSessionId && session.ephemeral) {
                ephemeralState[session.id] = session.ephemeral;
            }
        }

        if (Object.keys(ephemeralState).length > 0) {
            const message: WSMessage = {
                type: "ephemeral_state",
                data: ephemeralState,
            };
            this.sendToClient(ws, message);
        }
    }

    /**
     * Update ephemeral state for a session
     */
    updateEphemeralState(ws: WebSocket, data: unknown): void {
        const session = this.sessions.get(ws);
        if (session) {
            session.ephemeral = data;
        }
    }

    /**
     * Broadcast ephemeral state change to all clients
     */
    broadcastEphemeral(senderId: string, data: unknown): void {
        const message: WSMessage = {
            type: "ephemeral",
            senderId,
            data,
        };
        this.broadcast(message);
    }

    /**
     * Broadcast note update to all clients
     */
    broadcastUpdate(current: NoteCurrent, updateType: "update" | "revert" | "create"): void {
        const message: WSMessage = {
            type: updateType,
            data: current,
        };
        this.broadcast(message);
    }

    /**
     * Broadcast delete event and close all connections
     */
    broadcastDelete(noteId: string): void {
        const message: WSMessage = {
            type: "delete",
            data: { id: noteId },
        };

        this.sessions.forEach((session) => {
            try {
                session.ws.send(JSON.stringify(message));
                session.ws.close(1000, "Note deleted");
            } catch (error) {
                // Ignore errors during cleanup
            }
        });

        this.clearSessions();
    }

    /**
     * Send message to a specific client
     */
    private sendToClient(ws: WebSocket, message: WSMessage): void {
        try {
            ws.send(JSON.stringify(message));
        } catch (error) {
            // Remove failed connection
            this.sessions.delete(ws);
        }
    }

    /**
     * Broadcast message to all connected clients
     */
    private broadcast(message: WSMessage): void {
        const messageStr = JSON.stringify(message);

        this.sessions.forEach((session) => {
            try {
                session.ws.send(messageStr);
            } catch (error) {
                // Remove failed connections
                this.sessions.delete(session.ws);
            }
        });
    }
}
