import { Board } from './types';

export type BoardChangeCallback = (board: Board) => void;
export type EphemeralCallback = (data: any) => void;
export type UnsubscribeFunction = () => void;

export interface BoardsAPI {
  getAll: () => Promise<Board[]>;
  getById: (id: string) => Promise<Board | null>;
  create: (title?: string, id?: string, expiresInHours?: number) => Promise<Board>;
  update: (board: Board) => Promise<void>;
  delete: (id: string) => Promise<void>;
  subscribeToChanges: (id: string, callback: BoardChangeCallback) => UnsubscribeFunction;
  subscribeToEphemeral: (id: string, callback: EphemeralCallback) => UnsubscribeFunction;
  sendEphemeral: (id: string, data: any) => void;
  toggleShare: (id: string) => Promise<Board>;
  updateViaWS: (board: Board) => void;
  getHistory: (id: string, limit?: number, cursor?: number) => Promise<{ items: any[], nextCursor: number | null }>;
  revert: (id: string, version: number) => Promise<Board>;
}
