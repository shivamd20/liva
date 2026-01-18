import React, { useState, useEffect, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { Manifest } from '../src/types';

export function Inspect() {
    const [sessionId, setSessionId] = useState('');
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [boardEvents, setBoardEvents] = useState<any[]>([]);
    const [pointerEvents, setPointerEvents] = useState<any[]>([]);
    const [audioChunks, setAudioChunks] = useState<any[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const excalidrawAPIRef = useRef<any>(null);

    const loadSession = async () => {
        if (!sessionId) return;
        try {
            // Load Manifest
            const mRes = await fetch(`/api/recording/download/manifest?sessionId=${sessionId}`);
            if (!mRes.ok) throw new Error("Manifest not found");
            const mData = await mRes.json();
            setManifest(mData);

            // Load Events
            const eRes = await fetch(`/api/recording/download/events?sessionId=${sessionId}`);
            const eData = await eRes.json();
            setBoardEvents(eData.boardEvents || []);
            setPointerEvents(eData.pointerEvents || []);

            // Load Audio Metadata
            const aRes = await fetch(`/api/recording/download/audio?sessionId=${sessionId}`);
            const aData = await aRes.json();
            setAudioChunks(aData);

            // If chunks, construct a single blob for playback? Or play sequentially?
            // For MVP, lets try to stick them together or just play first one?
            // Better: MediaSource API or just downloading all blobs and concat.
            // Simplest: fetch all blobs, merge, create object URL.
            if (aData.length > 0) {
                const allBlobs: Blob[] = [];
                for (const chunk of aData) {
                    const cRes = await fetch(`/api/recording/download/audio?sessionId=${sessionId}&chunkId=${chunk.chunkId}`);
                    const blob = await cRes.blob();
                    allBlobs.push(blob);
                }
                const finalBlob = new Blob(allBlobs, { type: 'audio/webm;codecs=opus' });
                if (audioRef.current) {
                    audioRef.current.src = URL.createObjectURL(finalBlob);
                }
            }

        } catch (e) {
            console.error(e);
            alert("Error loading session: " + e);
        }
    };

    // Playback Loop
    useEffect(() => {
        let animationFrame: number;
        if (isPlaying) {
            const startTimestamp = Date.now() - currentTime;
            const loop = () => {
                const now = Date.now() - startTimestamp;
                if (manifest && now > (manifest.endedAt - manifest.startedAt)) {
                    setIsPlaying(false);
                    return;
                }
                setCurrentTime(now);
                animationFrame = requestAnimationFrame(loop);
            };
            animationFrame = requestAnimationFrame(loop);
            if (audioRef.current) audioRef.current.play();
        } else {
            if (audioRef.current) audioRef.current.pause();
        }
        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying]);

    // Sync UI with currentTime
    useEffect(() => {
        if (!excalidrawAPIRef.current) return;

        // Find board state at currentTime
        // Events are snapshot updates in this MVP
        // Find the last event before currentTime
        const currentBoardEvent = boardEvents.filter(e => e.t <= currentTime).pop();
        if (currentBoardEvent) {
            excalidrawAPIRef.current.updateScene({
                elements: currentBoardEvent.elements,
                appState: currentBoardEvent.appStateMinimal
            });
        }

    }, [currentTime, boardEvents]);

    const formatTime = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        return `${m}:${(s % 60).toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
                <h3>Inspector</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="Session ID"
                        value={sessionId}
                        onChange={e => setSessionId(e.target.value)}
                    />
                    <button onClick={loadSession}>Load</button>
                </div>
                {manifest && (
                    <div style={{ marginTop: '10px' }}>
                        <div>Duration: {formatTime(manifest.endedAt - manifest.startedAt)}</div>
                        <div>Events: {boardEvents.length} board, {pointerEvents.length} pointer</div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                            <button onClick={() => setIsPlaying(!isPlaying)}>
                                {isPlaying ? 'Pause' : 'Play'}
                            </button>
                            <span>{formatTime(currentTime)}</span>
                            <input
                                type="range"
                                min={0}
                                max={manifest.endedAt - manifest.startedAt}
                                value={currentTime}
                                onChange={(e) => {
                                    setCurrentTime(parseInt(e.target.value));
                                    if (audioRef.current) audioRef.current.currentTime = parseInt(e.target.value) / 1000;
                                }}
                                style={{ flex: 1 }}
                            />
                        </div>
                        <audio ref={audioRef} style={{ display: 'none' }} />
                    </div>
                )}
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                <Excalidraw
                    excalidrawAPI={(api) => excalidrawAPIRef.current = api}
                    viewModeEnabled={true}
                />
            </div>
        </div>
    );
}
