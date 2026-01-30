import { Board } from './types';
import { BoardsAPI, BoardChangeCallback, EphemeralCallback, UnsubscribeFunction, ListBoardsOptions, ListBoardsResponse, BoardIndexEntry } from './boards';
import { trpcClient } from './trpcClient';
import type { NoteCurrent, PaginatedHistoryResponse } from '../server/notes/types';

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
    expiresAt: note.expiresAt,
    templateId: note.templateId,
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
  /**
   * List boards from user's personal index with filtering, sorting, and pagination
   */
  list: async (options: ListBoardsOptions = {}): Promise<ListBoardsResponse> => {
    const result = await trpcClient.listNotes.query({
      search: options.search,
      filter: options.filter,
      visibility: options.visibility,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      limit: options.limit,
      cursor: options.cursor,
    });

    return {
      items: result.items as BoardIndexEntry[],
      nextCursor: result.nextCursor,
      totalCount: result.totalCount,
    };
  },

  /**
   * @deprecated Use list() instead for paginated results
   */
  getAll: async (): Promise<Board[]> => {
    // Use the new list API and fetch all items (for backward compatibility)
    const result = await trpcClient.listNotes.query({ limit: 50 });

    // For each item in the index, fetch full board details
    const boards = await Promise.all(
      result.items.map(async (entry: any) => {
        const fullNote = await trpcClient.getNote.query({ id: entry.noteId });
        return fullNote ? noteToBoard(fullNote as NoteCurrent) : null;
      })
    );

    return boards.filter((b: Board | null): b is Board => b !== null);
  },

  getById: async (id: string): Promise<Board | null> => {
    const note = await trpcClient.getNote.query({ id });
    return note ? noteToBoard(note as NoteCurrent) : null;
  },

  create: async (title?: string, id?: string, expiresInHours?: number, templateId?: string): Promise<Board> => {
    // Create new note
    const newNote = await trpcClient.createNote.mutate({
      id, // Optional: if provided, uses this ID; if undefined, server generates one
      title: title || 'Untitled',
      blob: {
        content: '',
        excalidrawElements: [],
      },
      expiresInHours,
      templateId
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
    const result = (await trpcClient.getHistory.query({ id, limit, cursor })) as unknown as PaginatedHistoryResponse;
    return {
      items: result.items.map((item: any) => ({
        version: item.version,
        timestamp: item.timestamp,
        title: item.title,
        excalidrawElements: item.blob.excalidrawElements || [],
      })),
      nextCursor: result.nextCursor,
    };
  },

  revert: async (id: string, version: number): Promise<Board> => {
    const note = await trpcClient.revertToVersion.mutate({ id, version });
    return noteToBoard(note as NoteCurrent);
  },

  /**
   * Track when user accesses a board (updates lastAccessedAt or adds shared board to index)
   */
  trackAccess: async (noteId: string): Promise<void> => {
    await trpcClient.trackBoardAccess.mutate({ noteId });
  },

  /**
   * Remove a shared board from user's personal list
   */
  removeShared: async (noteId: string): Promise<void> => {
    await trpcClient.removeSharedBoard.mutate({ noteId });
  },
};
