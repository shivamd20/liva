
import { MonorailCompositor } from "./compositor";
import { MonorailUploader } from "./uploader";

export interface RecorderOptions {
    sessionId: string;
    getUploadUrl: (chunkIndex: number) => Promise<string>;
}

export class MonorailRecorder {
    private compositor: MonorailCompositor;
    private mediaRecorder: MediaRecorder | null = null;
    private uploader: MonorailUploader;
    private chunkIndex = 0;

    private audioStream: MediaStream | null = null;
    private inputStreams: MediaStream[] = [];

    private activeContainer: HTMLElement | null = null;
    private containerMouseHandler: ((e: MouseEvent) => void) | null = null;

    constructor(options: RecorderOptions) {
        this.compositor = new MonorailCompositor();
        this.uploader = new MonorailUploader({
            sessionId: options.sessionId,
            apiBaseUrl: "",
            getUploadUrl: options.getUploadUrl,
        });
    }

    async addScreen(stream: MediaStream) {
        this.inputStreams.push(stream);
        this.compositor.addScreenStream(stream);
    }

    async addContainer(container: HTMLElement) {
        // Cleanup previous container listener if any
        this._cleanupContainerListener();

        this.activeContainer = container;
        this.compositor.addContainerSource(container);

        // Auto-attach mouse listener for pointer tracking
        this.containerMouseHandler = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const clampedX = Math.max(0, Math.min(1, x));
            const clampedY = Math.max(0, Math.min(1, y));
            this.compositor.updateMouse(clampedX, clampedY);
        };
        container.addEventListener('mousemove', this.containerMouseHandler);
    }

    async addCamera(stream: MediaStream) {
        this.inputStreams.push(stream);
        this.compositor.addCameraStream(stream);
    }

    async addAudio(stream: MediaStream) {
        this.audioStream = stream;
    }

    // New method to get the stream being recorded (for preview)
    getStream(): MediaStream | null {
        if (this.mediaRecorder) {
            return this.mediaRecorder.stream;
        }
        return null; // or throw?
    }

    start() {
        // Start compositor to get visual stream
        const visualStream = this.compositor.start();

        // Combine with audio if present
        const tracks = [...visualStream.getVideoTracks()];

        // Add explicit audio stream
        if (this.audioStream) {
            tracks.push(...this.audioStream.getAudioTracks());
        }

        // Add audio from input streams (screen/camera)
        for (const stream of this.inputStreams) {
            tracks.push(...stream.getAudioTracks());
        }

        const combinedStream = new MediaStream(tracks);

        // Setup MediaRecorder
        // Prefer VP9/Opus, fallback to VP8
        let mimeType = "video/webm; codecs=vp9,opus";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "video/webm; codecs=vp8,opus";
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "video/webm"; // Browser default
        }

        this.mediaRecorder = new MediaRecorder(combinedStream, { mimeType });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.uploader.queueChunk(event.data, this.chunkIndex++);
            }
        };

        this.mediaRecorder.start(10000); // 10 second chunks
    }

    async stop() {
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
            this.mediaRecorder.stop();
        }
        this._cleanupContainerListener();
        this.compositor.stop();
    }

    private _cleanupContainerListener() {
        if (this.activeContainer && this.containerMouseHandler) {
            this.activeContainer.removeEventListener('mousemove', this.containerMouseHandler);
            this.containerMouseHandler = null;
            this.activeContainer = null;
        }
    }
}
