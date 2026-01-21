
export class MonorailCompositor {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private rafId: number | null = null;
    private active: boolean = false;

    private mainSource: { type: 'video', element: HTMLVideoElement } | { type: 'container', element: HTMLElement } | null = null;
    private cameraVideo: HTMLVideoElement | null = null;
    private mousePos: { x: number, y: number } | null = null;

    constructor(width: number = 1920, height: number = 1080) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        const ctx = this.canvas.getContext("2d", { alpha: false }); // alpha false for performance
        if (!ctx) throw new Error("Could not get 2d context");
        this.ctx = ctx as CanvasRenderingContext2D;
    }

    updateMouse(x: number, y: number) {
        this.mousePos = { x, y };
    }

    addScreenStream(stream: MediaStream) {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.play();
        this.mainSource = { type: 'video', element: video };
    }

    addContainerSource(container: HTMLElement) {
        this.mainSource = { type: 'container', element: container };
    }

    addCameraStream(stream: MediaStream) {
        // Cleanup existing if any
        if (this.cameraVideo) {
            this.cameraVideo.pause();
            this.cameraVideo.srcObject = null;
        }

        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.play();
        this.cameraVideo = video;
    }

    removeCameraStream() {
        if (this.cameraVideo) {
            this.cameraVideo.pause();
            this.cameraVideo.srcObject = null;
            this.cameraVideo = null;
        }
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
        let bgColor = "#ffffff";

        if (this.mainSource && this.mainSource.type === 'container') {
            const container = this.mainSource.element;
            const containerRect = container.getBoundingClientRect();

            // 1. Dynamic Background Color
            const computedStyle = getComputedStyle(container);
            const rawBg = computedStyle.backgroundColor;

            if (rawBg && rawBg !== 'rgba(0, 0, 0, 0)' && rawBg !== 'transparent') {
                bgColor = rawBg;
            } else {
                const excalidrawBg = getComputedStyle(container).getPropertyValue('--excalidraw-view-background-color');
                if (excalidrawBg) {
                    bgColor = excalidrawBg;
                }
            }

            this.ctx.fillStyle = bgColor;
            this.ctx.fillRect(0, 0, width, height);

            const srcW = containerRect.width || 1;
            const srcH = containerRect.height || 1;

            // 2. Draw Canvases (Live Collection)
            const canvases = container.getElementsByTagName('canvas');
            for (let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                this.ctx.drawImage(canvas, 0, 0, width, height);
            }

            // 3. Draw Text Editor Overlay (Textarea)
            const textareas = container.getElementsByTagName('textarea');
            for (let i = 0; i < textareas.length; i++) {
                const ta = textareas[i];
                if (ta.style.opacity === '0' || ta.style.display === 'none' || ta.style.visibility === 'hidden') continue;

                const taRect = ta.getBoundingClientRect();

                // RelPos
                const dx = ((taRect.left - containerRect.left) / srcW) * width;
                const dy = ((taRect.top - containerRect.top) / srcH) * height;
                const dw = (taRect.width / srcW) * width;
                const dh = (taRect.height / srcH) * height;

                const taStyle = getComputedStyle(ta);

                this.ctx.save();

                // Draw Box
                if (taStyle.backgroundColor && taStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    this.ctx.fillStyle = taStyle.backgroundColor;
                    this.ctx.fillRect(dx, dy, dw, dh);
                }

                // Text
                // Simplified font parsing
                let scale = 1;
                if (taStyle.transform && taStyle.transform !== 'none') {
                    try {
                        const matrix = new DOMMatrix(taStyle.transform);
                        scale = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
                    } catch (e) {
                        // fallback
                    }
                }
                const fontSize = parseFloat(taStyle.fontSize) * scale * (height / srcH);
                this.ctx.font = `${taStyle.fontWeight} ${fontSize}px ${taStyle.fontFamily}`;
                this.ctx.fillStyle = taStyle.color;
                this.ctx.textBaseline = 'top';

                const lines = ta.value.split('\n');
                const lineHeight = fontSize * 1.2;

                this.ctx.beginPath();
                this.ctx.rect(dx, dy, dw, dh);
                this.ctx.clip();

                for (let j = 0; j < lines.length; j++) {
                    this.ctx.fillText(lines[j], dx + 2, dy + 2 + (j * lineHeight));
                }

                this.ctx.restore();
            }

        } else {
            // Video or Default
            this.ctx.fillStyle = bgColor;
            this.ctx.fillRect(0, 0, width, height);

            if (this.mainSource && this.mainSource.type === 'video') {
                const video = this.mainSource.element;
                if (video.readyState >= 2) {
                    this.ctx.drawImage(video, 0, 0, width, height);
                }
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

        // Draw Mouse Cursor Overlay
        if (this.mousePos) {
            const x = this.mousePos.x * width;
            const y = this.mousePos.y * height;

            this.ctx.save();
            this.ctx.translate(x, y);

            // Draw a nice cursor (simple arrow)
            this.ctx.shadowColor = "rgba(0,0,0,0.3)";
            this.ctx.shadowBlur = 5;
            this.ctx.shadowOffsetX = 2;
            this.ctx.shadowOffsetY = 2;

            this.ctx.fillStyle = "black";
            this.ctx.strokeStyle = "white";
            this.ctx.lineWidth = 2;

            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(0, 20);
            this.ctx.lineTo(5, 15);
            this.ctx.lineTo(12, 28); // tail
            this.ctx.lineTo(16, 26); // tail width
            this.ctx.lineTo(9, 13);
            this.ctx.lineTo(16, 13);
            this.ctx.closePath();

            this.ctx.fill();
            this.ctx.stroke();

            // Click effect? (Optional: could add state for clicking)

            this.ctx.restore();
        }
    }
}
