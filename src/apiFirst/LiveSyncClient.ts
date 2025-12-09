import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';

// Minimal types needed for sync
export interface LiveSyncBoard {
    id: string;
    title: string;
    excalidrawElements: OrderedExcalidrawElement[];
    updatedAt: number;
    // We might not need all other fields for the sync itself, but keeping them for compatibility
    // content: string; 
    // userId: string;
    // ...
}

export type BoardChangeCallback = (board: LiveSyncBoard) => void;
export type EphemeralCallback = (data: any) => void;
export type UnsubscribeFunction = () => void;

// Helper to extract board data from API response style object
const parseBoardData = (data: any): LiveSyncBoard => {
    const blob = data.blob || {};
    return {
        id: data.id,
        title: data.title || 'Untitled',
        excalidrawElements: blob.excalidrawElements || [],
        updatedAt: data.updatedAt || Date.now(),
    };
};

const boardToBlob = (board: LiveSyncBoard) => ({
    content: '', // Not used for now in this sync
    excalidrawElements: board.excalidrawElements || [],
});

export class LiveSyncClient {
    private connections: Map<string, WebSocket> = new Map();
    private callbacks: Map<string, Set<BoardChangeCallback>> = new Map();
    private ephemeralCallbacks: Map<string, Set<EphemeralCallback>> = new Map();
    private sessionIds: Map<string, string> = new Map();
    private reconnectTimers: Map<string, number> = new Map();

    // Helper to determine WS URL - can be authorized/customized
    private getWsUrl(id: string): string {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Assuming the sync API is on the same host for this demo/implementation
        // In a real library, this would be a config option.
        return `${protocol}//${window.location.host}/ws/note/${id}`;
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
            ws.send(JSON.stringify({
                type: 'ephemeral',
                data
            }));
        }
    }

    sendUpdate(board: LiveSyncBoard) {
        const id = board.id;
        const ws = this.connections.get(id);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'update_event',
                data: {
                    title: board.title,
                    blob: boardToBlob(board)
                }
            }));
        }
    }

    private connect(id: string) {
        const wsUrl = this.getWsUrl(id);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log(`LiveSync: Connected to ${id}`);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Handle Standard Updates
                if (['initial', 'update', 'revert', 'create'].includes(message.type)) {
                    if (message.type === 'initial' && message.sessionId) {
                        this.sessionIds.set(id, message.sessionId);
                    }

                    const board = parseBoardData(message.data);
                    const callbacks = this.callbacks.get(id);
                    if (callbacks) {
                        callbacks.forEach(cb => cb(board));
                    }
                }
                // Handle Ephemeral Events
                else if (['ephemeral', 'ephemeral_state'].includes(message.type)) {
                    if (message.type === 'ephemeral') {
                        const mySessionId = this.sessionIds.get(id);
                        if (mySessionId && message.senderId === mySessionId) {
                            return; // Ignore own messages
                        }
                    }
                    const callbacks = this.ephemeralCallbacks.get(id);
                    if (callbacks) {
                        callbacks.forEach(cb => cb(message));
                    }
                }
            } catch (error) {
                console.error('LiveSync: Error parsing message:', error);
            }
        };

        ws.onclose = () => {
            console.log(`LiveSync: Closed connection to ${id}`);
            this.connections.delete(id);
            this.sessionIds.delete(id);
            this.scheduleReconnect(id);
        };

        ws.onerror = (err) => {
            console.error(`LiveSync error for ${id}:`, err);
        };

        this.connections.set(id, ws);
    }

    private scheduleReconnect(id: string) {
        const existingTimer = this.reconnectTimers.get(id);
        if (existingTimer) clearTimeout(existingTimer);

        // Only reconnect if we still have listeners
        const normalCbs = this.callbacks.get(id);
        const ephemeralCbs = this.ephemeralCallbacks.get(id);

        if ((normalCbs && normalCbs.size > 0) || (ephemeralCbs && ephemeralCbs.size > 0)) {
            const timer = window.setTimeout(() => {
                this.reconnectTimers.delete(id);
                this.connect(id);
            }, 3000);
            this.reconnectTimers.set(id, timer);
        }
    }

    private disconnect(id: string) {
        const ws = this.connections.get(id);
        if (ws) {
            ws.close();
            this.connections.delete(id);
        }
        const timer = this.reconnectTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.reconnectTimers.delete(id);
        }
        this.callbacks.delete(id);
        this.ephemeralCallbacks.delete(id);
    }
}

export const liveSyncClient = new LiveSyncClient();
