import { useEffect, useRef, useState } from 'react';
import { Loader2, Play, Pause, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface MonorailPlayerProps {
    sessionId: string;
    autoPlay?: boolean;
}

export function MonorailPlayer({ sessionId, autoPlay = false }: MonorailPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaSourceRef = useRef<MediaSource | null>(null);
    const sourceBufferRef = useRef<SourceBuffer | null>(null);

    // State
    const [status, setStatus] = useState<'loading' | 'ready' | 'playing' | 'paused' | 'error' | 'ended'>('loading');
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [manifest, setManifest] = useState<any>(null);

    // Queue management
    const queueRef = useRef<number[]>([]);
    const processingRef = useRef(false);
    const chunksLoadedRef = useRef(0);
    const totalChunksRef = useRef(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        loadManifest();
        return () => {
            cleanup();
        };
    }, [sessionId]);

    const cleanup = () => {
        if (videoRef.current && videoRef.current.src) {
            URL.revokeObjectURL(videoRef.current.src);
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        mediaSourceRef.current = null;
        sourceBufferRef.current = null;
        processingRef.current = false;
        queueRef.current = [];
    };

    const loadManifest = async () => {
        cleanup();

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            setStatus('loading');
            setError(null);

            const res = await fetch(`/api/monorail/session/${sessionId}/manifest`, {
                signal: controller.signal
            });
            if (!res.ok) throw new Error("Failed to load recording manifest");

            const data = await res.json() as any;
            if (controller.signal.aborted) return;

            setManifest(data);
            totalChunksRef.current = data.chunks_uploaded || 0;

            if (totalChunksRef.current === 0) {
                setError("No recording chunks found");
                setStatus('error');
                return;
            }

            initializeMediaSource();

        } catch (e: any) {
            if (e.name === 'AbortError') return;
            console.error(e);
            setError((e as Error).message);
            setStatus('error');
        }
    };

    const initializeMediaSource = () => {
        if (!videoRef.current) return;

        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;
        videoRef.current.src = URL.createObjectURL(mediaSource);

        mediaSource.addEventListener('sourceopen', onSourceOpen);
    };

    const onSourceOpen = async () => {
        const mediaSource = mediaSourceRef.current;
        if (!mediaSource || mediaSource.readyState !== 'open') return;

        try {
            // Using webm/vp9 or vp8 as per recorder defaults
            const mimeType = 'video/webm; codecs="vp9,opus"';

            if (!MediaSource.isTypeSupported(mimeType)) {
                // Fallback try
                const fallback = 'video/webm; codecs="vp8,opus"';
                if (!MediaSource.isTypeSupported(fallback)) {
                    throw new Error("Browser does not support the video format");
                }
                sourceBufferRef.current = mediaSource.addSourceBuffer(fallback);
            } else {
                sourceBufferRef.current = mediaSource.addSourceBuffer(mimeType);
            }

            if (manifest && manifest.startedAt && manifest.endedAt) {
                const durationSeconds = (manifest.endedAt - manifest.startedAt) / 1000;
                if (durationSeconds > 0 && isFinite(durationSeconds)) {
                    mediaSource.duration = durationSeconds;
                }
            }

            const sourceBuffer = sourceBufferRef.current;
            sourceBuffer.mode = 'sequence';
            sourceBuffer.addEventListener('updateend', processQueue);

            // Populate queue with all chunks for now (sequential streaming)
            const initialQueue = Array.from({ length: totalChunksRef.current }, (_, i) => i);
            queueRef.current = initialQueue;

            setStatus('ready');
            processQueue();

            if (autoPlay) {
                play();
            }

        } catch (e) {
            console.error("MSE Error", e);
            setError("Playback initialization failed: " + (e as Error).message);
            setStatus('error');
        }
    };

    const processQueue = async () => {
        if (processingRef.current || queueRef.current.length === 0) return;

        // Check if aborted or cleaned up
        if (abortControllerRef.current?.signal.aborted) return;

        const mediaSource = mediaSourceRef.current;
        const sourceBuffer = sourceBufferRef.current;

        if (!mediaSource || !sourceBuffer || mediaSource.readyState !== 'open') return;
        if (sourceBuffer.updating) return;

        processingRef.current = true;

        try {
            // Check for buffer quota / eviction
            if (videoRef.current && sourceBuffer.buffered.length > 0) {
                const currentTime = videoRef.current.currentTime;
                const removeEnd = currentTime - 60; // Keep 60s window

                if (removeEnd > 0 && !sourceBuffer.updating) {
                    sourceBuffer.remove(0, removeEnd);
                    return; // Return, updateend triggers retry
                }
            }

            const chunkIndex = queueRef.current[0];
            if (chunkIndex === undefined) return;

            const res = await fetch(`/api/monorail/session/${sessionId}/chunk/${chunkIndex}`, {
                signal: abortControllerRef.current?.signal
            });
            if (!res.ok) throw new Error(`Failed to load chunk ${chunkIndex}`);

            const blob = await res.blob();
            const arrayBuffer = await blob.arrayBuffer();

            // CRITICAL CHECK: Ensure we are still valid after async fetch
            if (abortControllerRef.current?.signal.aborted) return;
            if (!sourceBufferRef.current || sourceBufferRef.current !== sourceBuffer) return;
            if (mediaSourceRef.current?.readyState !== 'open') return;

            try {
                sourceBuffer.appendBuffer(arrayBuffer);
                queueRef.current.shift();
                chunksLoadedRef.current++;
            } catch (err: any) {
                if (err.name === 'QuotaExceededError') {
                    console.warn("Buffer full, attempting eviction");
                    if (videoRef.current) {
                        const removeEnd = Math.max(0, videoRef.current.currentTime - 10);
                        if (removeEnd > 0) {
                            sourceBuffer.remove(0, removeEnd);
                            return;
                        }
                    }
                }
                throw err;
            }

        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error("Chunk load error", e);
            }
        } finally {
            processingRef.current = false;
        }
    };

    // Also listen for updateend to possibly close stream
    useEffect(() => {
        if (!sourceBufferRef.current) return;
        const handler = () => {
            if (queueRef.current.length === 0 && !sourceBufferRef.current?.updating && mediaSourceRef.current?.readyState === 'open') {
                mediaSourceRef.current.endOfStream();
            }
        }
        sourceBufferRef.current.addEventListener('updateend', handler);
        return () => sourceBufferRef.current?.removeEventListener('updateend', handler);
    }, [status]);


    const togglePlay = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                play();
            } else {
                videoRef.current.pause();
                setStatus('paused');
            }
        }
    };

    const play = () => {
        if (videoRef.current) {
            const p = videoRef.current.play();
            if (p) {
                p.then(() => {
                    setStatus('playing');
                }).catch(e => {
                    if (e.name !== 'AbortError') {
                        console.error("Play error:", e);
                    }
                });
            }
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setProgress(videoRef.current.currentTime);
            setDuration(videoRef.current.duration || 0);
        }
    };

    const handleEnded = () => {
        setStatus('ended');
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full h-full flex flex-col relative bg-black overflow-hidden group">
            {/* Video Element */}
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onClick={togglePlay}
            />

            {/* Loading State */}
            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20 pointer-events-none">
                    <Loader2 className="w-10 h-10 animate-spin text-white/70" />
                </div>
            )}

            {/* Error State */}
            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center z-20">
                    <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
                    <p className="text-red-400 font-medium">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => loadManifest()} className="mt-4 border-red-500/30 hover:bg-red-500/10 text-red-400">
                        Retry
                    </Button>
                </div>
            )}

            {/* Play/Pause Center Overlay */}
            {status === 'paused' && !error && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10">
                    <div className="p-4 rounded-full bg-black/40 backdrop-blur-sm">
                        <Play className="w-8 h-8 text-white/80 fill-white/80" />
                    </div>
                </div>
            )}

            {/* Bottom Controls Overlay */}
            <div className={cn(
                "absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 z-10",
                "bg-gradient-to-t from-black/90 via-black/50 to-transparent",
                (status === 'playing') ? "opacity-0 group-hover:opacity-100" : "opacity-100"
            )}>
                <div className="flex flex-col gap-2 max-w-3xl mx-auto w-full">
                    <Slider
                        value={[progress]}
                        max={duration || 100}
                        step={0.1}
                        onValueChange={(val: number[]) => {
                            if (videoRef.current) {
                                videoRef.current.currentTime = val[0];
                                setProgress(val[0]);
                            }
                        }}
                        className="cursor-pointer bg-white/20 rounded-full"
                    />

                    <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={togglePlay}
                                className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                                aria-label={status === 'playing' ? "Pause" : "Play"}
                            >
                                {status === 'playing' ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                            </Button>

                            <div className="text-xs font-mono font-medium text-white/90">
                                {formatTime(progress)} <span className="text-white/50">/</span> {formatTime(duration)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
