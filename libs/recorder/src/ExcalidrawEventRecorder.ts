import { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { AppState } from '@excalidraw/excalidraw/types';
import { BoardEvent } from './types';

export class ExcalidrawEventRecorder {
    private onEvent: (event: BoardEvent) => void;
    private startTime: number;

    constructor(startTime: number, onEvent: (event: BoardEvent) => void) {
        this.startTime = startTime;
        this.onEvent = onEvent;
    }

    // Called by the onChange prop wrapper
    handleChange(elements: readonly ExcalidrawElement[], appState: AppState, files: any) {
        // Naive implementation: capture full elements on change.
        // Real implementation should probably diff or only capture changed elements if possible.
        // But doc says "BoardEvent ... elements: ExcalidrawElement[]". 
        // If it's the *entire* board eveyr change, it will be huge. 
        // "type: add | update | delete" implies diffing.
        // For MVP, let's just emit 'update' with all elements. Efficient diffing is complex. 
        // Or maybe we depend on Excalidraw's history?
        // Let's stick to simple "snapshot" for now as per "elements: ExcalidrawElement[]" could mean subset or all.

        // Ideally we check what changed.

        const event: BoardEvent = {
            t: Date.now() - this.startTime,
            type: 'update',
            elements: elements,
            appStateMinimal: {
                viewBackgroundColor: appState.viewBackgroundColor,
                scrollX: appState.scrollX,
                scrollY: appState.scrollY,
                zoom: appState.zoom,
                selectedElementIds: appState.selectedElementIds,
            },
            files: files
        };
        this.onEvent(event);
    }
}
