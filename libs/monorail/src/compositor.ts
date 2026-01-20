
export class MonorailCompositor {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private rafId: number | null = null;
    private active: boolean = false;

    private mainSource: { type: 'video', element: HTMLVideoElement } | { type: 'canvas', element: HTMLCanvasElement } | null = null;
    private cameraVideo: HTMLVideoElement | null = null;

    constructor(width: number = 1920, height: number = 1080) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        const ctx = this.canvas.getContext("2d", { alpha: false }); // alpha false for performance
        if (!ctx) throw new Error("Could not get 2d context");
        this.ctx = ctx as CanvasRenderingContext2D;
    }

    addScreenStream(stream: MediaStream) {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.play();
        this.mainSource = { type: 'video', element: video };
    }

    addCanvasSource(canvas: HTMLCanvasElement) {
        this.mainSource = { type: 'canvas', element: canvas };
    }

    addCameraStream(stream: MediaStream) {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.play();
        this.cameraVideo = video;
    }

    start() {
        this.active = true;
        this.loop();
        const stream = this.canvas.captureStream(30); // 30 FPS
        return stream;
    }

    stop() {
        this.active = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);

        // Cleanup main source if it's a video
        if (this.mainSource && this.mainSource.type === 'video') {
            const video = this.mainSource.element;
            video.pause();
            video.srcObject = null;
        }
        this.mainSource = null;

        if (this.cameraVideo) {
            this.cameraVideo.pause();
            this.cameraVideo.srcObject = null;
            this.cameraVideo = null;
        }
    }

    private loop = () => {
        if (!this.active) return;

        this.draw();
        this.rafId = requestAnimationFrame(this.loop);
    };

    private draw() {
        const { width, height } = this.canvas;

        // Clear background
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, width, height);

        // Draw Main Source (Screen or Canvas)
        if (this.mainSource) {
            if (this.mainSource.type === 'video') {
                const video = this.mainSource.element;
                if (video.readyState >= 2) {
                    this.ctx.drawImage(video, 0, 0, width, height);
                }
            } else if (this.mainSource.type === 'canvas') {
                const canvas = this.mainSource.element;
                // Draw canvas directly
                this.ctx.drawImage(canvas, 0, 0, width, height);
            }
        }

        // Draw Camera (PIP - Bottom Right)
        if (this.cameraVideo && this.cameraVideo.readyState >= 2) {
            const pipWidth = width * 0.2; // 20% width
            const pipHeight = (pipWidth / (this.cameraVideo.videoWidth || 1)) * (this.cameraVideo.videoHeight || 1);

            const margin = 20;
            const x = width - pipWidth - margin;
            const y = height - pipHeight - margin;

            this.ctx.save();
            // Optional: rounded corners or border
            this.ctx.beginPath();
            this.ctx.rect(x, y, pipWidth, pipHeight);
            this.ctx.clip();

            this.ctx.drawImage(this.cameraVideo, x, y, pipWidth, pipHeight);
            this.ctx.restore();
        }
    }
}
