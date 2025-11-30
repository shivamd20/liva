/// <reference types="./vite-env.d.ts" />
import { BoardsAPI } from './boards';
import { boardsLocal } from './boardsLocal';
import { boardsRemote } from './boardsRemote';


const USE_REMOTE_API = true;

export const boards: BoardsAPI = USE_REMOTE_API ? boardsRemote : boardsLocal;
export const boardsAPI = boards; // Alias for convenience
