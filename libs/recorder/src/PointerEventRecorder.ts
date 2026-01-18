import { PointerEvent as RecordedPointerEvent } from './types';

interface ExcalidrawPointerPayload {
    pointer: { x: number; y: number };
    button: 'down' | 'up';
    pointersMap: Map<string, Readonly<{ x: number; y: number }>>;
}

export class PointerEventRecorder {
    private onEvent: (event: RecordedPointerEvent) => void;
    private startTime: number;
    private intervalId: any;

    private lastEmittedEvent: RecordedPointerEvent | null = null;
    private currentPayload: ExcalidrawPointerPayload | null = null;

    constructor(startTime: number, onEvent: (event: RecordedPointerEvent) => void) {
        this.startTime = startTime;
        this.onEvent = onEvent;
        // Start ticking immediately (or we could start/stop explicitly)
        // But for consistency with previous API let's keep start/stop but without args
    }

    start() {
        this.intervalId = setInterval(this.tick, 33);
    }

    stop() {
        clearInterval(this.intervalId);
    }

    // Called by Controller
    handlePointerUpdate(payload: ExcalidrawPointerPayload) {
        this.currentPayload = payload;
    }

    private tick = () => {
        if (!this.currentPayload) return;

        // Convert Map to Record
        const pointersMapRecord: Record<string, { x: number, y: number }> = {};
        this.currentPayload.pointersMap.forEach((v, k) => {
            pointersMapRecord[k] = { x: v.x, y: v.y };
        });

        const event: RecordedPointerEvent = {
            t: Date.now() - this.startTime,
            pointer: this.currentPayload.pointer,
            button: this.currentPayload.button,
            pointersMap: pointersMapRecord
        };

        // Dedupe
        if (this.lastEmittedEvent &&
            this.lastEmittedEvent.pointer.x === event.pointer.x &&
            this.lastEmittedEvent.pointer.y === event.pointer.y &&
            this.lastEmittedEvent.button === event.button
        ) {
            return;
        }

        this.lastEmittedEvent = event;
        this.onEvent(event);
    };
}
