import { AudioChunk } from './types';

export class MicCaptureEngine {
    private mediaRecorder: MediaRecorder | null = null;
    private stream: MediaStream | null = null;
    private sessionId: string;
    private startTime: number;
    private onChunk: (chunk: AudioChunk) => void;
    private chunkCounter = 0;

    constructor(sessionId: string, startTime: number, onChunk: (chunk: AudioChunk) => void) {
        this.sessionId = sessionId;
        this.startTime = startTime;
        this.onChunk = onChunk;
    }

    async start() {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm;codecs=opus' });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                // Estimate duration or just push blob. 
                // We can't easily get precise duration from blob without decoding.
                // For now, relies on server or just use wall clock diff? 
                // The doc says "startOffsetMs = performance.now() - sessionStartTime"

                const chunk: AudioChunk = {
                    sessionId: this.sessionId,
                    chunkId: this.chunkCounter++,
                    startOffsetMs: Date.now() - this.startTime, // Approximate
                    durationMs: 0, // Server calculates? Or we drift?
                    blob: event.data
                };
                this.onChunk(chunk);
            }
        };

        this.mediaRecorder.start(2000); // 2 seconds chunks
    }

    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    }
}
