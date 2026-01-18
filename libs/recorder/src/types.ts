import { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { AppState } from '@excalidraw/excalidraw/types';

export interface RecordingSessionConfig {
    endpoint: string;
    onSessionStart?: (sessionId: string) => void;
    onSessionEnd?: (sessionId: string) => void;
}

export interface AudioChunk {
    sessionId: string;
    chunkId: number;
    startOffsetMs: number;
    durationMs: number;
    blob: Blob;
}

export type BoardEventType = 'add' | 'update' | 'delete';

export interface BoardEvent {
    t: number;
    type: BoardEventType;
    elements: readonly ExcalidrawElement[];
    appStateMinimal: Partial<AppState>;
    files?: Record<string, any>;
}

export interface PointerEvent {
    t: number;
    pointer: { x: number; y: number };
    button: 'down' | 'up';
    pointersMap: Record<string, Readonly<{ x: number, y: number }>>;
}

export interface Manifest {
    sessionId: string;
    startedAt: number;
    endedAt: number;
    audioChunks: number;
    boardEventCount: number;
    pointerEventCount: number;
    status: 'complete' | 'incomplete';
}
