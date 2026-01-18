import { PointerEvent as RecordedPointerEvent } from './types';

export class PointerEventRecorder {
    private onEvent: (event: RecordedPointerEvent) => void;
    private startTime: number;
    private intervalId: any;
    private lastEvent: RecordedPointerEvent | null = null;
    private currentPointer: { x: number, y: number, buttons: number } | null = null;

    constructor(startTime: number, onEvent: (event: RecordedPointerEvent) => void) {
        this.startTime = startTime;
        this.onEvent = onEvent;
    }

    start(container: HTMLElement) {
        container.addEventListener('pointermove', this.handlePointerMove);
        container.addEventListener('pointerdown', this.handlePointerMove);
        container.addEventListener('pointerup', this.handlePointerMove);

        // Sample at 30Hz
        this.intervalId = setInterval(this.tick, 33);
    }

    stop(container: HTMLElement) {
        container.removeEventListener('pointermove', this.handlePointerMove);
        container.removeEventListener('pointerdown', this.handlePointerMove);
        container.removeEventListener('pointerup', this.handlePointerMove);
        clearInterval(this.intervalId);
    }

    private handlePointerMove = (e: PointerEvent) => {
        // Just update state, don't emit yet
        // Accessing Excalidraw coordinates might be tricky if we don't transform.
        // Assuming we get clientX/Y and need to convert relative to something?
        // Or Excalidraw provides a way?
        // Doc says "Pointer events emitted by Excalidraw". Excalidraw API has onPointerUpdate?
        // Let's assume we listen to DOM for now, but really we want scene coordinates.
        // If we attach to the Excalidraw container, we get client coords.
        this.currentPointer = {
            x: e.clientX,
            y: e.clientY,
            buttons: e.buttons
        };
    };

    private tick = () => {
        if (!this.currentPointer) return;

        const event: RecordedPointerEvent = {
            t: Date.now() - this.startTime,
            x: this.currentPointer.x,
            y: this.currentPointer.y,
            tool: 'pointer', // TODO: get from AppState
            buttons: this.currentPointer.buttons
        };

        // Simple dedupe?
        if (this.lastEvent && this.lastEvent.x === event.x && this.lastEvent.y === event.y && this.lastEvent.buttons === event.buttons) {
            return;
        }

        this.lastEvent = event;
        this.onEvent(event);
    };
}
