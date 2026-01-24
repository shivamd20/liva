import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { BinaryFileData } from '@excalidraw/excalidraw/types';

// Minimal types needed for sync
export interface LiveSyncBoard {
    id: string;
    title: string;
    excalidrawElements: OrderedExcalidrawElement[];
    files?: Record<string, BinaryFileData>;
    updatedAt: number;
}

export type BoardChangeCallback = (board: LiveSyncBoard) => void;
export type EphemeralCallback = (data: any) => void;
export type UnsubscribeFunction = () => void;
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type StatusCallback = (status: ConnectionStatus) => void;

// Helper to extract board data from API response style object
const parseBoardData = (data: any): LiveSyncBoard => {
    const blob = data.blob || {};
    return {
        id: data.id,
        title: data.title || 'Untitled',
        excalidrawElements: blob.excalidrawElements || [],
        files: blob.files || {},
        updatedAt: data.updatedAt || Date.now(),
    };
};

const boardToBlob = (board: LiveSyncBoard) => ({
    content: '',
    excalidrawElements: board.excalidrawElements || [],
    files: board.files || {},
});

export class LiveSyncClient {
    private connections: Map<string, WebSocket> = new Map();
    private callbacks: Map<string, Set<BoardChangeCallback>> = new Map();
    private ephemeralCallbacks: Map<string, Set<EphemeralCallback>> = new Map();
    private statusCallbacks: Map<string, Set<StatusCallback>> = new Map();

    private sessionIds: Map<string, string> = new Map();
    private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
    private reconnectAttempts: Map<string, number> = new Map();

    private baseUrl: string = 'https://liva.shvm.in';
    private userId?: string;

    private readonly BASE_RECONNECT_DELAY = 1000;
    private readonly MAX_RECONNECT_DELAY = 30000;

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this.log('Network online, attempting to reconnect all...');
                this.reconnectAll();
            });
            window.addEventListener('offline', () => {
                this.log('Network offline, pausing sync.');
            });
        }
    }

    private log(msg: string, ...args: any[]) {
        console.log(`[LiveSync ${new Date().toLocaleTimeString()}] ${msg}`, ...args);
    }

    private error(msg: string, ...args: any[]) {
        console.error(`[LiveSync ${new Date().toLocaleTimeString()}] ${msg}`, ...args);
    }

    setBaseUrl(url: string) {
        this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
    }

    setUserId(id: string) {
        if (this.userId !== id) {
            const oldId = this.userId;
            this.userId = id;

            if (oldId && this.connections.size > 0) {
                this.log(`UserId changed from ${oldId} to ${id}. Reconnecting all active sessions...`);
                // Close all existing connections
                Array.from(this.connections.entries()).forEach(([boardId, ws]) => {
                    this.forceDisconnect(boardId);
                    this.connect(boardId);
                });
            }
        }
    }

    // New: Force reconnect a specific board
    reconnect(id: string) {
        this.log(`Manual reconnect requested for ${id}`);
        this.forceDisconnect(id);
        this.connect(id);
    }

    private forceDisconnect(id: string) {
        const ws = this.connections.get(id);
        if (ws) {
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;
            try { ws.close(); } catch (e) { }
            this.connections.delete(id);
        }
        const timer = this.reconnectTimers.get(id);
        if (timer) {
            clearTimeout(timer as any);
            this.reconnectTimers.delete(id);
        }
        this.updateStatus(id, 'disconnected');
    }

    private getWsUrl(id: string): string {
        const appendQuery = (base: string) => {
            if (!this.userId) {
                throw new Error("userId must be set before connecting.");
            }
            return `${base}?x-liva-user-id=${encodeURIComponent(this.userId)}`;
        };

        try {
            const url = new URL(this.baseUrl);
            const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            return appendQuery(`${protocol}//${url.host}/ws/note/${id}`);
        } catch (e) {
            // Fallback for relative URLs or invalid inputs
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            return appendQuery(`${protocol}//${window.location.host}/ws/note/${id}`);
        }
    }

    subscribe(id: string, callback: BoardChangeCallback): UnsubscribeFunction {
        if (!this.callbacks.has(id)) {
            this.callbacks.set(id, new Set());
        }
        this.callbacks.get(id)!.add(callback);

        if (!this.connections.has(id)) {
            this.connect(id);
        }

        return () => {
            const callbacks = this.callbacks.get(id);
            if (callbacks) {
                callbacks.delete(callback);
                this.checkDisconnect(id);
            }
        };
    }

    subscribeEphemeral(id: string, callback: EphemeralCallback): UnsubscribeFunction {
        if (!this.ephemeralCallbacks.has(id)) {
            this.ephemeralCallbacks.set(id, new Set());
        }
        this.ephemeralCallbacks.get(id)!.add(callback);

        if (!this.connections.has(id)) {
            this.connect(id);
        }

        return () => {
            const callbacks = this.ephemeralCallbacks.get(id);
            if (callbacks) {
                callbacks.delete(callback);
                this.checkDisconnect(id);
            }
        };
    }

    subscribeStatus(id: string, callback: StatusCallback): UnsubscribeFunction {
        if (!this.statusCallbacks.has(id)) {
            this.statusCallbacks.set(id, new Set());
        }
        this.statusCallbacks.get(id)!.add(callback);

        callback(this.getConnectionStatus(id));

        return () => {
            const callbacks = this.statusCallbacks.get(id);
            if (callbacks) callbacks.delete(callback);
        };
    }

    getConnectionStatus(id: string): ConnectionStatus {
        const ws = this.connections.get(id);
        if (ws && ws.readyState === WebSocket.OPEN) return 'connected';
        if (ws && ws.readyState === WebSocket.CONNECTING) return 'connecting';

        // If we are waiting for a reconnect timer, we are technically connecting/reconnecting
        if (this.reconnectTimers.has(id)) return 'reconnecting';

        return 'disconnected';
    }

    private updateStatus(id: string, status: ConnectionStatus) {
        const callbacks = this.statusCallbacks.get(id);
        if (callbacks) {
            callbacks.forEach(cb => cb(status));
        }
    }

    private checkDisconnect(id: string) {
        const normalCbs = this.callbacks.get(id);
        const ephemeralCbs = this.ephemeralCallbacks.get(id);
        const hasNormal = normalCbs && normalCbs.size > 0;
        const hasEphemeral = ephemeralCbs && ephemeralCbs.size > 0;

        if (!hasNormal && !hasEphemeral) {
            this.disconnect(id);
        }
    }

    sendEphemeral(id: string, data: any) {
        const ws = this.connections.get(id);
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({
                    type: 'ephemeral',
                    data
                }));
            } catch (e) {
                this.error(`Failed to send ephemeral message to ${id}`, e);
            }
        }
    }

    sendUpdate(board: LiveSyncBoard) {
        const id = board.id;
        const ws = this.connections.get(id);
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({
                    type: 'update_event',
                    data: {
                        title: board.title,
                        blob: boardToBlob(board)
                    }
                }));
            } catch (e) {
                this.error(`Failed to send update to ${id}`, e);
            }
        }
    }

    private connect(id: string) {
        if (this.connections.has(id)) {
            const existing = this.connections.get(id);
            if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
                return;
            }
            // If exists but closed/closing, clean up first
            try { existing?.close(); } catch (e) { }
            this.connections.delete(id);
        }

        if (!this.userId) {
            this.log(`userId not set, delaying connection to ${id}`);
            this.scheduleReconnect(id);
            return;
        }

        try {
            const wsUrl = this.getWsUrl(id);
            this.log(`Connecting to ${id} (${wsUrl})`);
            this.updateStatus(id, 'connecting');

            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                this.log(`Connected to ${id}`);
                this.reconnectAttempts.set(id, 0);
                this.updateStatus(id, 'connected');
                // Removed timeout clearing here because we might want to keep it simple? 
                // No, we should clear any pending reconnect timer just in case
                if (this.reconnectTimers.has(id)) {
                    clearTimeout(this.reconnectTimers.get(id) as any);
                    this.reconnectTimers.delete(id);
                }
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (['initial', 'update', 'revert', 'create'].includes(message.type)) {
                        if (message.type === 'initial' && message.sessionId) {
                            this.sessionIds.set(id, message.sessionId);
                            // this.log(`Session ID for ${id}: ${message.sessionId}`);
                        }

                        const board = parseBoardData(message.data);
                        const callbacks = this.callbacks.get(id);
                        if (callbacks) {
                            callbacks.forEach(cb => cb(board));
                        }
                    }
                    else if (['ephemeral', 'ephemeral_state'].includes(message.type)) {
                        if (message.type === 'ephemeral') {
                            const mySessionId = this.sessionIds.get(id);
                            if (mySessionId && message.senderId === mySessionId) {
                                return;
                            }
                        } else if (message.type === 'ephemeral_state') {
                            const mySessionId = this.sessionIds.get(id);
                            if (mySessionId && message.data && message.data[mySessionId]) {
                                delete message.data[mySessionId];
                            }
                        }
                        const callbacks = this.ephemeralCallbacks.get(id);
                        if (callbacks) {
                            callbacks.forEach(cb => cb(message));
                        }
                    }
                } catch (error) {
                    this.error('Error parsing message:', error);
                }
            };

            ws.onclose = (ev) => {
                // If we forced disconnect, onclose is nullified, so this won't run.
                // If it runs, it's an accidental close.
                this.log(`Closed connection to ${id} (code: ${ev.code})`);
                this.connections.delete(id);
                this.sessionIds.delete(id);
                this.updateStatus(id, 'disconnected');
                this.scheduleReconnect(id);
            };

            ws.onerror = (err: Event) => {
                this.error(`WebSocket error for ${id}`, err);
                // Rely on close to handle reconnect
            };

            this.connections.set(id, ws);

        } catch (e) {
            this.error(`Failed to initiate connection to ${id}:`, e);
            this.scheduleReconnect(id);
        }
    }

    private scheduleReconnect(id: string) {
        if (this.reconnectTimers.has(id)) return; // Already scheduled

        const normalCbs = this.callbacks.get(id);
        const ephemeralCbs = this.ephemeralCallbacks.get(id);
        const hasListeners = (normalCbs && normalCbs.size > 0) || (ephemeralCbs && ephemeralCbs.size > 0);

        if (hasListeners) {
            const attempts = this.reconnectAttempts.get(id) || 0;
            const delay = Math.min(this.BASE_RECONNECT_DELAY * Math.pow(1.5, attempts), this.MAX_RECONNECT_DELAY);

            this.log(`Scheduling reconnect for ${id} in ${delay}ms (attempt ${attempts + 1})`);
            this.updateStatus(id, 'reconnecting');

            const timer = setTimeout(() => {
                this.reconnectTimers.delete(id);
                this.reconnectAttempts.set(id, attempts + 1);

                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    this.log(`Offline, skipping reconnect attempt for ${id}.`);
                    return;
                }

                this.connect(id);
            }, delay);

            this.reconnectTimers.set(id, timer);
        }
    }

    private reconnectAll() {
        const allIds = new Set([...this.callbacks.keys(), ...this.ephemeralCallbacks.keys()]);
        allIds.forEach(id => {
            if (!this.connections.has(id)) {
                this.connect(id);
            }
        });
    }

    private disconnect(id: string) {
        this.log(`Disconnecting from ${id}`);
        this.forceDisconnect(id);
        this.callbacks.delete(id);
        this.ephemeralCallbacks.delete(id);
        this.statusCallbacks.delete(id);
    }
}

export const liveSyncClient = new LiveSyncClient();