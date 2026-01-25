import { Board } from './types';

export type BoardChangeCallback = (board: Board) => void;
export type EphemeralCallback = (data: any) => void;
export type UnsubscribeFunction = () => void;

// Represents a board entry from the user's personal index
export interface BoardIndexEntry {
  noteId: string;
  title: string | null;
  ownerUserId: string;
  isOwned: boolean;
  visibility: 'public' | 'private';
  version: number;
  thumbnailBase64: string | null;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}

export interface ListBoardsOptions {
  search?: string;
  filter?: 'all' | 'owned' | 'shared';
  visibility?: 'public' | 'private' | 'all';
  sortBy?: 'lastAccessed' | 'lastUpdated' | 'alphabetical' | 'created';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
}

export interface ListBoardsResponse {
  items: BoardIndexEntry[];
  nextCursor: string | null;
  totalCount: number;
}

export interface BoardsAPI {
  // List operations (from user's index)
  list: (options?: ListBoardsOptions) => Promise<ListBoardsResponse>;

  // Legacy - fetches full board details (deprecated, use list for index)
  getAll: () => Promise<Board[]>;
  getById: (id: string) => Promise<Board | null>;

  // CRUD
  create: (title?: string, id?: string, expiresInHours?: number, templateId?: string) => Promise<Board>;
  update: (board: Board) => Promise<void>;
  delete: (id: string) => Promise<void>;

  // Real-time
  subscribeToChanges: (id: string, callback: BoardChangeCallback) => UnsubscribeFunction;
  subscribeToEphemeral: (id: string, callback: EphemeralCallback) => UnsubscribeFunction;
  sendEphemeral: (id: string, data: any) => void;
  updateViaWS: (board: Board) => void;

  // Sharing
  toggleShare: (id: string) => Promise<Board>;

  // History
  getHistory: (id: string, limit?: number, cursor?: number) => Promise<{ items: any[], nextCursor: number | null }>;
  revert: (id: string, version: number) => Promise<Board>;

  // User-specific index operations
  trackAccess: (noteId: string) => Promise<void>;
  removeShared: (noteId: string) => Promise<void>;
  updateThumbnail: (noteId: string, thumbnailBase64: string, version: number) => Promise<void>;
}

