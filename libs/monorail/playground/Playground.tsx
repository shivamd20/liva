import React, { useState, useRef } from 'react';
import { MonorailRecorder } from '../src';
import { Inspect } from './Inspect';

export function Playground() {
    const [mode, setMode] = useState<'record' | 'inspect'>('record');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [inspectSessionId, setInspectSessionId] = useState<string | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState("Idle");

    const recorderRef = useRef<MonorailRecorder | null>(null);
    const previewVideoRef = useRef<HTMLVideoElement | null>(null);

    const [useCanvas, setUseCanvas] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawing = useRef(false);

    // Canvas drawing handlers
    const startDrawing = (e: React.MouseEvent) => {
        isDrawing.current = true;
        draw(e);
    };
    const draw = (e: React.MouseEvent) => {
        if (!isDrawing.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    };
    const stopDrawing = () => {
        isDrawing.current = false;
    };

    const startRecording = async () => {
        try {
            setStatus("Initializing...");
            // 1. Create Session
            const res = await fetch('/api/v1/monorail.createSession', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: undefined })
            });
            if (!res.ok) throw new Error("Failed to create session");
            const responseData = await res.json();
            // TRPC response format: { result: { data: ... } }
            const session = responseData.result.data;

            setSessionId(session.id);
            setInspectSessionId(session.id); // Pre-set for inspection

            // 2. Setup Recorder
            const recorder = new MonorailRecorder({
                sessionId: session.id,
                getUploadUrl: async (index) => {
                    console.log("Requesting upload URL for chunk", index);
                    // Direct upload to DO via custom endpoint
                    return `/api/monorail/session/${session.id}/upload/${index}`;
                }
            });

            // 3. Get Media Streams
            const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            if (useCanvas && canvasRef.current) {
                // Initialize canvas background
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#222';
                    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                }
                await recorder.addCanvas(canvasRef.current);
            } else {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                await recorder.addScreen(screenStream);

                // Handle screen sharing stop from browser UI
                screenStream.getVideoTracks()[0].onended = () => {
                    stopRecording();
                };
            }

            recorder.addCamera(cameraStream);
            // recorder.addAudio(micStream); // Audio is usually included in getDisplayMedia or separate

            recorder.start();
            recorderRef.current = recorder;

            // Live Preview
            if (previewVideoRef.current) {
                const stream = recorder.getStream();
                if (stream) {
                    previewVideoRef.current.srcObject = stream;
                    previewVideoRef.current.play().catch(e => console.error("Preview play failed", e));
                }
            }

            setIsRecording(true);
            setStatus("Recording...");

        } catch (e) {
            console.error(e);
            setStatus("Error: " + (e as Error).message);
        }
    };

    const stopRecording = async () => {
        if (!recorderRef.current) return;

        setStatus("Stopping...");
        recorderRef.current.stop();
        setIsRecording(false);

        if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = null;
        }

        if (sessionId) {
            await fetch('/api/v1/monorail.finalizeSession', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            setStatus("Finalized Session: " + sessionId);
            // Auto switch to inspect
            setMode('inspect');
        }
    };

    if (mode === 'inspect') {
        return (
            <Inspect
                sessionId={inspectSessionId!}
                onBack={() => setMode('record')}
            />
        );
    }

    return (
        <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
            <h1>Monorail Playground</h1>

            <div style={{ marginBottom: 20 }}>
                Status: <strong>{status}</strong>
            </div>

            <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                        type="checkbox"
                        checked={useCanvas}
                        onChange={e => setUseCanvas(e.target.checked)}
                        disabled={isRecording}
                    />
                    Use Canvas Board (instead of Screen Share)
                </label>
            </div>

            <div style={{ gap: 10, display: 'flex', marginBottom: 20 }}>
                <button
                    onClick={startRecording}
                    disabled={isRecording}
                    style={{ padding: '10px 20px', background: isRecording ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: 4 }}
                >
                    {isRecording ? "Recording..." : "Start Recording"}
                </button>

                <button
                    onClick={stopRecording}
                    disabled={!isRecording}
                    style={{ padding: '10px 20px', background: isRecording ? '#dc3545' : '#ccc', color: 'white', border: 'none', borderRadius: 4 }}
                >
                    Stop Recording
                </button>

                {inspectSessionId && (
                    <button
                        onClick={() => setMode('inspect')}
                        disabled={isRecording}
                        style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: 4 }}
                    >
                        Inspect Last Session
                    </button>
                )}
            </div>

            {/* Canvas Area */}
            {useCanvas && (
                <div style={{ marginBottom: 20 }}>
                    <h3>Drawing Canvas (Draw here!)</h3>
                    <canvas
                        ref={canvasRef}
                        width={1280}
                        height={720}
                        style={{ background: '#222', cursor: 'crosshair', maxWidth: '100%', border: '1px solid #444' }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                    />
                </div>
            )}

            {/* Live Preview Area */}
            <div style={{ marginBottom: 20 }}>
                <h3>Live Video Overlay</h3>
                <div style={{ width: 640, height: 360, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                    <video
                        ref={previewVideoRef}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        muted
                    />
                </div>
            </div>

            {sessionId && (
                <div style={{ marginTop: 40 }}>
                    <h3>Last Session ID: {sessionId}</h3>
                    <p>Check R2 bucket 'din-files' for uploads.</p>
                </div>
            )}
        </div>
    );
}
