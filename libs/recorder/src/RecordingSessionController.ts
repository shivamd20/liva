import { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { AppState } from '@excalidraw/excalidraw/types';
import { EventBuffer } from './EventBuffer';
import { UploadPipeline } from './UploadPipeline';
import { MicCaptureEngine } from './MicCaptureEngine';
import { ExcalidrawEventRecorder } from './ExcalidrawEventRecorder';
import { PointerEventRecorder } from './PointerEventRecorder';
import { RecordingSessionConfig, AudioChunk, BoardEvent, PointerEvent, Manifest } from './types';

export class RecordingSessionController {
    public sessionId: string | null = null;
    private config: RecordingSessionConfig;
    // private excalidrawAPI: any;

    private micEngine: MicCaptureEngine | null = null;
    private boardRecorder: ExcalidrawEventRecorder | null = null;
    private pointerRecorder: PointerEventRecorder | null = null;

    private uploadPipeline: UploadPipeline | null = null;

    private audioBuffer: EventBuffer<AudioChunk>;
    private boardBuffer: EventBuffer<BoardEvent>;
    private pointerBuffer: EventBuffer<PointerEvent>;

    private startTime: number = 0;
    private isRecording: boolean = false;

    // Stats for manifest
    private audioChunkCount = 0;
    private boardEventCount = 0;
    private pointerEventCount = 0;

    constructor(excalidrawAPI: any, config: RecordingSessionConfig) {
        // this.excalidrawAPI = excalidrawAPI;
        this.config = config;

        // Initialize buffers
        this.audioBuffer = new EventBuffer(5, async (events) => {
            if (!this.uploadPipeline) return;
            for (const e of events) {
                await this.uploadPipeline.uploadAudioChunk(e);
                this.audioChunkCount++;
            }
        });

        this.boardBuffer = new EventBuffer(10, async (events) => {
            if (!this.uploadPipeline) return;
            await this.uploadPipeline.uploadBoardEvents(events);
            this.boardEventCount += events.length;
        });

        this.pointerBuffer = new EventBuffer(50, async (events) => {
            if (!this.uploadPipeline) return;
            await this.uploadPipeline.uploadPointerEvents(events);
            this.pointerEventCount += events.length;
        });
    }

    async start() {
        if (this.isRecording) return;

        this.sessionId = crypto.randomUUID();
        this.startTime = Date.now();
        this.isRecording = true;

        this.uploadPipeline = new UploadPipeline(this.config.endpoint, this.sessionId);

        // Start Mic
        this.micEngine = new MicCaptureEngine(this.sessionId, this.startTime, (chunk) => {
            if (this.isRecording) this.audioBuffer.push(chunk);
        });
        await this.micEngine.start();

        // Start Board Recorder
        this.boardRecorder = new ExcalidrawEventRecorder(this.startTime, (event) => {
            if (this.isRecording) this.boardBuffer.push(event);
        });

        // Start Pointer Recorder
        // Needs a container. Excalidraw API might give us the container?
        // this.excalidrawAPI.getAppState().container? No.
        // Usually we need to look up the DOM element. 
        // For now, let's look for a class or assume body/window if not specific?
        // Or user must pass container?
        // Let's assume document.body for now for pointers, or specific selector.
        // Better: this.excalidrawAPI.getHTMLCanvasElement().parentElement
        // Assuming excalidrawAPI has getHTMLCanvasElement() or similar.
        // Actually, Excalidraw API usually has `getAppState` etc.
        // Let's try `document.querySelector('.excalidraw-container')` or similar in the playground.
        // For robustness, we might need to pass the container in constructor.
        // For now, attaching to window for pointers is simplest but captures everything.
        // Let's attach to `document.body` for simplicity in MVP.
        this.pointerRecorder = new PointerEventRecorder(this.startTime, (event) => {
            if (this.isRecording) this.pointerBuffer.push(event);
        });
        this.pointerRecorder.start(document.body);

        if (this.config.onSessionStart && this.sessionId) {
            this.config.onSessionStart(this.sessionId);
        }
    }

    async stop() {
        if (!this.isRecording || !this.sessionId) return;

        this.isRecording = false;

        // Stop engines
        if (this.micEngine) this.micEngine.stop();
        if (this.pointerRecorder) this.pointerRecorder.stop(document.body);

        // Flush buffers
        await this.audioBuffer.flush();
        await this.boardBuffer.flush();
        await this.pointerBuffer.flush();

        // Write manifest
        const manifest: Manifest = {
            sessionId: this.sessionId,
            startedAt: this.startTime,
            endedAt: Date.now(),
            audioChunks: this.audioChunkCount,
            boardEventCount: this.boardEventCount,
            pointerEventCount: this.pointerEventCount,
            status: 'complete'
        };

        if (this.uploadPipeline) {
            await this.uploadPipeline.uploadManifest(manifest);
        }

        if (this.config.onSessionEnd) {
            this.config.onSessionEnd(this.sessionId);
        }
    }

    // Hook for Excalidraw onChange
    public handleExcalidrawChange = (elements: readonly ExcalidrawElement[], appState: AppState, files: any) => {
        if (this.isRecording && this.boardRecorder) {
            this.boardRecorder.handleChange(elements, appState, files);
        }
    }
}
