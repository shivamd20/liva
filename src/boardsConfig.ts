/// <reference types="./vite-env.d.ts" />
import { BoardsAPI } from './boards';
import { boardsRemote } from './boardsRemote';

export const boards: BoardsAPI = boardsRemote;
export const boardsAPI = boards; // Alias for convenience
