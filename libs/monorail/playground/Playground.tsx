import React, { useState, useRef, useEffect } from 'react';
import { MonorailRecorder } from '../src';
import { Inspect } from './Inspect';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

type Tab = 'screen' | 'canvas' | 'excalidraw';

export function Playground() {
    const [mode, setMode] = useState<'record' | 'inspect'>('record');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [inspectSessionId, setInspectSessionId] = useState<string | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState("Idle");

    const recorderRef = useRef<MonorailRecorder | null>(null);
    const previewVideoRef = useRef<HTMLVideoElement | null>(null);

    // Tab State
    const [activeTab, setActiveTab] = useState<Tab>('screen');

    // Simple Canvas Refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawing = useRef(false);

    // Excalidraw Refs
    const excalidrawWrapperRef = useRef<HTMLDivElement>(null);

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
            const session = responseData.result.data;

            setSessionId(session.id);
            setInspectSessionId(session.id);

            // 2. Setup Recorder
            const recorder = new MonorailRecorder({
                sessionId: session.id,
                getUploadUrl: async (index) => {
                    // Direct upload to DO via custom endpoint
                    return `/api/monorail/session/${session.id}/upload/${index}`;
                }
            });

            // 3. Get Media Streams & Setup Source
            const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            if (activeTab === 'canvas' && canvasRef.current && canvasRef.current.parentElement) {
                // Initialize canvas background if needed (optional)
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    // Ensure non-transparent canvas for better recording if desired
                    // But we rely on container background mostly now.
                    // Let's keep the black background initialization for drawing contrast
                    if (canvasRef.current.width === 1280) { // Check if fresh
                        // We might want to persist drawing, so don't clear if already drawn?
                        // For now, re-init background is fine or skip.
                        // ctx.fillStyle = '#222';
                        // ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    }
                }

                // Pass the PARENT container to capture canvas + background
                await recorder.addContainer(canvasRef.current.parentElement);
            }
            else if (activeTab === 'excalidraw' && excalidrawWrapperRef.current) {
                // Pass the Excalidraw Wrapper
                await recorder.addContainer(excalidrawWrapperRef.current);
            }
            else {
                // Screen Share (Default)
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                await recorder.addScreen(screenStream);

                // Handle screen sharing stop from browser UI
                screenStream.getVideoTracks()[0].onended = () => {
                    stopRecording();
                };
            }

            recorder.addCamera(cameraStream);

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

    const tabs: { id: Tab; label: string }[] = [
        { id: 'screen', label: 'Screen Share' },
        { id: 'canvas', label: 'Simple Canvas' },
        { id: 'excalidraw', label: 'Excalidraw Board' },
    ];

    return (
        <div style={{ padding: 20, fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flexShrink: 0 }}>
                <h1>Monorail Playground</h1>

                <div style={{ marginBottom: 20 }}>
                    Status: <strong>{status}</strong>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid #ccc', paddingBottom: 10 }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            disabled={isRecording}
                            style={{
                                padding: '8px 16px',
                                cursor: isRecording ? 'not-allowed' : 'pointer',
                                background: activeTab === tab.id ? '#007bff' : 'transparent',
                                color: activeTab === tab.id ? 'white' : 'black',
                                border: 'none',
                                borderRadius: 4,
                                fontWeight: activeTab === tab.id ? 'bold' : 'normal'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{ gap: 10, display: 'flex', marginBottom: 20 }}>
                    <button
                        onClick={startRecording}
                        disabled={isRecording}
                        style={{ padding: '10px 20px', background: isRecording ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: 4 }}
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
                            style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: 4 }}
                        >
                            Inspect Last Session
                        </button>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', gap: 20, minHeight: 0 }}>
                {/* Main Content Area */}
                <div
                    style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', position: 'relative', background: '#f5f5f5' }}
                >

                    {activeTab === 'screen' && (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                            <p>Click "Start Recording" to share your screen.</p>
                        </div>
                    )}

                    {activeTab === 'canvas' && (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: 10, background: '#eee', borderBottom: '1px solid #ddd' }}>Draw something below!</div>
                            <canvas
                                ref={canvasRef}
                                width={1280}
                                height={720}
                                style={{ width: '100%', height: 'auto', background: '#222', cursor: 'crosshair', touchAction: 'none' }}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                            />
                        </div>
                    )}

                    {activeTab === 'excalidraw' && (
                        <div ref={excalidrawWrapperRef} style={{ width: '100%', height: '100%' }}>
                            <Excalidraw
                                UIOptions={{
                                    canvasActions: { loadScene: false }
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Live Preview Sidebar */}
                <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 10, fontWeight: 'bold' }}>Live Preview</div>
                    <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                        <video
                            ref={previewVideoRef}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            muted
                        />
                    </div>
                </div>
            </div>

            {sessionId && (
                <div style={{ marginTop: 20, fontSize: '0.8em', color: '#666' }}>
                    Last Session ID: {sessionId}
                </div>
            )}
        </div>
    );
}
