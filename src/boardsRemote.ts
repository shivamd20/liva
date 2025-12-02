import { Board } from './types';
import { BoardsAPI, BoardChangeCallback, EphemeralCallback, UnsubscribeFunction } from './boards';
import { trpcClient } from './trpcClient';
import type { NoteCurrent } from '../src/notes/types';

// Map between Board (UI) and NoteCurrent (API)
const noteToBoard = (note: NoteCurrent): Board => {
  const blob = note.blob as { content?: string; excalidrawElements?: any[] };

  return {
    id: note.id,
    title: note.title || 'Untitled',
    content: blob.content || '',
    excalidrawElements: blob.excalidrawElements || [],
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    userId: note.userId,
    access: note.access,
  };
};

const boardToBlob = (board: Board) => ({
  content: board.content,
  excalidrawElements: board.excalidrawElements || [],
});

// WebSocket connection manager
class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private callbacks: Map<string, Set<BoardChangeCallback>> = new Map();
  private ephemeralCallbacks: Map<string, Set<EphemeralCallback>> = new Map();
  private sessionIds: Map<string, string> = new Map();
  private reconnectTimers: Map<string, number> = new Map();

  subscribe(id: string, callback: BoardChangeCallback): UnsubscribeFunction {
    // Add callback to the set
    if (!this.callbacks.has(id)) {
      this.callbacks.set(id, new Set());
    }
    this.callbacks.get(id)!.add(callback);

    // Create WebSocket connection if it doesn't exist
    if (!this.connections.has(id)) {
      this.connect(id);
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.callbacks.get(id);
      if (callbacks) {
        callbacks.delete(callback);

        // Close connection if no more callbacks
        const ephemeralCbs = this.ephemeralCallbacks.get(id);
        if (callbacks.size === 0 && (!ephemeralCbs || ephemeralCbs.size === 0)) {
          this.disconnect(id);
        }
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

        const normalCbs = this.callbacks.get(id);
        if (callbacks.size === 0 && (!normalCbs || normalCbs.size === 0)) {
          this.disconnect(id);
        }
      }
    };
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

  sendUpdate(id: string, data: any) {
    const ws = this.connections.get(id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'update_event',
        data
      }));
    }
  }

  private connect(id: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    const host = `127.0.0.1:8787`; // TODO use relative path on prod

    const wsUrl = `${protocol}//${window.location.host}/ws/note/${id}`;
    // const wsUrl = `${protocol}//${host}/ws/note/${id}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`WebSocket connected for board ${id}`);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'initial' || message.type === 'update' || message.type === 'revert' || message.type === 'create') {
          if (message.type === 'initial' && message.sessionId) {
            this.sessionIds.set(id, message.sessionId);
          }

          const note = message.data as NoteCurrent;
          const board = noteToBoard(note);

          // Notify all callbacks
          const callbacks = this.callbacks.get(id);
          if (callbacks) {
            callbacks.forEach(cb => cb(board));
          }
        } else if (message.type === 'ephemeral' || message.type === 'ephemeral_state') {
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
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error for board ${id}:`, error);
    };

    ws.onclose = () => {
      console.log(`WebSocket closed for board ${id}`);
      this.connections.delete(id);
      this.sessionIds.delete(id);

      // Attempt reconnection if there are still callbacks
      const callbacks = this.callbacks.get(id);
      const ephemeralCallbacks = this.ephemeralCallbacks.get(id);
      if ((callbacks && callbacks.size > 0) || (ephemeralCallbacks && ephemeralCallbacks.size > 0)) {
        this.scheduleReconnect(id);
      }
    };

    this.connections.set(id, ws);
  }

  private scheduleReconnect(id: string) {
    // Clear existing timer
    const existingTimer = this.reconnectTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Reconnect after 3 seconds
    const timer = window.setTimeout(() => {
      this.reconnectTimers.delete(id);
      const callbacks = this.callbacks.get(id);
      const ephemeralCallbacks = this.ephemeralCallbacks.get(id);
      if ((callbacks && callbacks.size > 0) || (ephemeralCallbacks && ephemeralCallbacks.size > 0)) {
        this.connect(id);
      }
    }, 3000);

    this.reconnectTimers.set(id, timer);
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

const wsManager = new WebSocketManager();

export const boardsRemote: BoardsAPI = {
  getAll: async (): Promise<Board[]> => {
    const notes = await trpcClient.listNotes.query();

    // Fetch full details for each note
    const boards = await Promise.all(
      notes.map(async (noteInfo: any) => {
        const fullNote = await trpcClient.getNote.query({ id: noteInfo.id });
        return fullNote ? noteToBoard(fullNote as NoteCurrent) : null;
      })
    );

    return boards.filter((b: Board | null): b is Board => b !== null);
  },

  getById: async (id: string): Promise<Board | null> => {
    const note = await trpcClient.getNote.query({ id });
    return note ? noteToBoard(note as NoteCurrent) : null;
  },

  create: async (title?: string, id?: string): Promise<Board> => {
    // Create new note
    const newNote = await trpcClient.createNote.mutate({
      id, // Optional: if provided, uses this ID; if undefined, server generates one
      title: title || 'Untitled',
      blob: {
        content: '',
        excalidrawElements: [],
      },
    });

    return noteToBoard(newNote as NoteCurrent);
  },

  update: async (board: Board): Promise<void> => {
    await trpcClient.updateNote.mutate({
      id: board.id,
      title: board.title,
      blob: boardToBlob(board),
    });
  },

  delete: async (id: string): Promise<void> => {
    await trpcClient.deleteNote.mutate({ id });
  },

  subscribeToChanges: (id: string, callback: BoardChangeCallback): UnsubscribeFunction => {
    return wsManager.subscribe(id, callback);
  },

  subscribeToEphemeral: (id: string, callback: EphemeralCallback): UnsubscribeFunction => {
    return wsManager.subscribeEphemeral(id, callback);
  },

  sendEphemeral: (id: string, data: any) => {
    wsManager.sendEphemeral(id, data);
  },

  toggleShare: async (id: string): Promise<Board> => {
    const note = await trpcClient.toggleShare.mutate({ id });
    return noteToBoard(note as NoteCurrent);
  },

  updateViaWS: (board: Board) => {
    wsManager.sendUpdate(board.id, {
      title: board.title,
      blob: boardToBlob(board),
    });
  },

  getHistory: async (id: string, limit?: number, cursor?: number) => {
    const result = await trpcClient.getHistory.query({ id, limit, cursor });
    return {
      items: result.items.map((item: any) => ({
        version: item.version,
        timestamp: item.timestamp,
        title: item.title,
        // We don't need full content for list, but might need it for preview if we want
        // For now, let's keep it minimal or full depending on UI needs.
        // The UI wants to render thumbnail, so we need elements.
        excalidrawElements: item.blob.excalidrawElements || [],
      })),
      nextCursor: result.nextCursor,
    };
  },

  revert: async (id: string, version: number): Promise<Board> => {
    const note = await trpcClient.revertToVersion.mutate({ id, version });
    return noteToBoard(note as NoteCurrent);
  }
};
