
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

    async addCanvas(canvas: HTMLCanvasElement) {
        this.compositor.addCanvasSource(canvas);
        // Note: Canvas element itself doesn't provide audio tracks so we don't add to inputStreams here for audio
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

        this.mediaRecorder.start(2000); // 2 second chunks
    }

    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
            this.mediaRecorder.stop();
        }
        this.compositor.stop();
    }
}
