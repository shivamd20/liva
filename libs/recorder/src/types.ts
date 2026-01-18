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
}

export interface PointerEvent {
    t: number;
    x: number;
    y: number;
    tool: string;
    buttons: number;
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
