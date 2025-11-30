import { storage } from './storage';
import { Board } from './types';
import { BoardsAPI, BoardChangeCallback, UnsubscribeFunction } from './boards';

const BOARDS_KEY = 'boards';

// Simulate async delay for local storage
const delay = (ms: number = 10) => new Promise(resolve => setTimeout(resolve, ms));

export const boardsLocal: BoardsAPI = {
  getAll: async (): Promise<Board[]> => {
    await delay();
    return storage.get<Board[]>(BOARDS_KEY) || [];
  },

  getById: async (id: string): Promise<Board | null> => {
    await delay();
    const all = storage.get<Board[]>(BOARDS_KEY) || [];
    return all.find(b => b.id === id) || null;
  },

  create: async (title?: string, id?: string): Promise<Board> => {
    await delay();
    const all = storage.get<Board[]>(BOARDS_KEY) || [];
    const now = Date.now();
    const boardId = id || Math.random().toString(36).slice(2);
    
    const board: Board = {
      id: boardId,
      title: title || 'Untitled',
      content: '',
      excalidrawElements: [],
      createdAt: now,
      updatedAt: now
    };
    all.push(board);
    storage.set(BOARDS_KEY, all);
    return board;
  },

  update: async (board: Board): Promise<void> => {
    await delay();
    board.updatedAt = Date.now();
    const all = storage.get<Board[]>(BOARDS_KEY) || [];
    const index = all.findIndex(b => b.id === board.id);
    if (index !== -1) {
      all[index] = board;
      storage.set(BOARDS_KEY, all);
    }
  },

  delete: async (id: string): Promise<void> => {
    await delay();
    const all = storage.get<Board[]>(BOARDS_KEY) || [];
    const filtered = all.filter(b => b.id !== id);
    storage.set(BOARDS_KEY, filtered);
  },

  subscribeToChanges: (_id: string, _callback: BoardChangeCallback): UnsubscribeFunction => {
    // Local storage doesn't support real-time sync
    return () => { };
  }
};
