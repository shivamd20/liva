
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MonorailRecorder } from '@shvm/monorail';
import { trpcClient } from '../../trpcClient';
import { toast } from 'sonner';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Mic, Video as VideoIcon, Square, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSession } from '../../lib/auth-client';

interface ZeroFrictionRecorderProps {
    onClose: () => void;
    onSuccess: () => void;
}

function MonitorIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
    )
}

export function ZeroFrictionRecorder({ onClose, onSuccess }: ZeroFrictionRecorderProps) {
    const { data: session } = useSession();
    const videoPreviewRef = useRef<HTMLVideoElement>(null);
    const recorderRef = useRef<MonorailRecorder | null>(null);

    const [permissionGranted, setPermissionGranted] = useState(false);
    const [recorderMode, setRecorderMode] = useState<'video' | 'audio' | 'screen'>('video');
    const [stream, setStream] = useState<MediaStream | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
    const [duration, setDuration] = useState(0);

    const [uploadStatus, setUploadStatus] = useState<'INIT' | 'UPLOADING_TO_YT' | 'DONE' | 'FAILED' | null>(null);
    const [progress, setProgress] = useState(0);
    const [publishId, setPublishId] = useState<string | null>(null);
    const [videoId, setVideoId] = useState<string | null>(null); // Local Video ID

    const [error, setError] = useState<string | null>(null);

    // Check YouTube Status
    const { data: ytConnection } = useQuery({
        queryKey: ['youtube-status', session?.user?.id],
        queryFn: async () => {
            if (!session?.user?.id) return { connected: false };
            try {
                const res = await fetch('/api/integrations/youtube', {
                    headers: { 'X-Liva-User-Id': session.user.id }
                });
                if (!res.ok) return { connected: false };
                return (await res.json()) as { connected: boolean };
            } catch (e) {
                return { connected: false };
            }
        },
        enabled: !!session?.user?.id
    });

    // Initialize Camera / Permissions based on mode
    // Initialize Camera / Permissions based on mode
    useEffect(() => {
        let currentStream: MediaStream | null = null;

        async function initStream() {
            try {
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                }

                let newStream: MediaStream;
                if (recorderMode === 'screen') {
                    // For screen, we don't init immediately in preview, usually user clicks start.
                    // But for consistency let's just ask mic permission first?
                    // Actually, allow user to click "Start" then ask for screen.
                    // For now, just Preview Mic?
                    newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } else if (recorderMode === 'audio') {
                    newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } else {
                    newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                }

                currentStream = newStream;
                setStream(newStream);

                if (videoPreviewRef.current && recorderMode === 'video') {
                    videoPreviewRef.current.srcObject = newStream;
                    videoPreviewRef.current.muted = true;
                }
                setPermissionGranted(true);
            } catch (e) {
                console.error("Permission failed", e);
                setError("Permission denied.");
            }
        }

        if (!isRecording) {
            initStream();
        }

        return () => {
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [recorderMode]); // Re-run when mode changes

    // Timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRecording && recordingStartTime) {
            interval = setInterval(() => {
                setDuration(Math.floor((Date.now() - recordingStartTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording, recordingStartTime]);


    const startRecording = async () => {
        try {
            setError(null);
            // 1. Create Monorail Session
            const res = await fetch('/api/v1/monorail.createSession', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: undefined })
            });
            if (!res.ok) throw new Error("Failed to create session");
            const responseData = await res.json() as any;
            const sessionData = responseData.result.data;
            const newSessionId = sessionData.id;
            setSessionId(newSessionId);

            // 2. Create VideosDO record
            const newVideoId = crypto.randomUUID();
            await trpcClient.videos.create.mutate({
                id: newVideoId,
                title: `Recording ${new Date().toLocaleString()}`,
                sessionId: newSessionId,
                status: 'RECORDED'
            });
            setVideoId(newVideoId);

            // 3. Init Recorder
            // 3. Init Recorder
            const recorder = new MonorailRecorder({
                sessionId: newSessionId,
                getUploadUrl: async (index) => {
                    return `/api/monorail/session/${newSessionId}/upload/${index}`;
                }
            });

            // Handle Streams
            if (recorderMode === 'screen') {
                // Request Screen Share
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                // Also add mic from existing stream
                if (stream) {
                    await recorder.addAudio(stream);
                }
                // Add screen as "camera" (or screen if library supports it, assuming addCamera works for video track)
                // The prompt implies "Audio + Video + Screen", checking if simple screen share or combo
                // For MVP: Screen + Audio
                await recorder.addScreen(screenStream);

                // Stop recording if screen share stops
                screenStream.getVideoTracks()[0].onended = () => {
                    stopRecording();
                };

            } else if (recorderMode === 'audio') {
                if (stream) await recorder.addAudio(stream);
            } else {
                // Video
                if (stream) {
                    await recorder.addAudio(stream);
                    await recorder.addCamera(stream);
                }
            }

            await recorder.start();
            recorderRef.current = recorder;

            // Show Recorded Stream in Preview
            if (videoPreviewRef.current) {
                const recordedStream = recorder.getStream();
                if (recordedStream) {
                    videoPreviewRef.current.srcObject = recordedStream;
                    videoPreviewRef.current.play().catch(console.error);
                }
            }

            setIsRecording(true);
            setRecordingStartTime(Date.now());

        } catch (e: any) {
            console.error(e);
            setError(e.message);
        }
    };

    const stopRecording = async () => {
        if (!recorderRef.current || !videoId || !sessionId) return;

        try {
            await recorderRef.current.stop();
            recorderRef.current = null;
            setIsRecording(false);

            // Signal stop
            await trpcClient.monorail.signalStop.mutate({ sessionId });

            // If YouTube connected, Start Upload
            if (ytConnection?.connected) {
                setUploadStatus('INIT');
                const init = await trpcClient.monorail.initPublish.mutate({
                    monorailSessionId: sessionId,
                    videoId: videoId
                });
                setPublishId(init.publishId);
                await trpcClient.monorail.startPublish.mutate({ publishId: init.publishId });
            } else {
                // Just Saved
                setUploadStatus('DONE'); // Reusing DONE for success state, but simpler UI
                toast.success("Recording saved to library");
            }

        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setUploadStatus('FAILED');
        }
    };

    // Polling logic
    useQuery({
        queryKey: ['publish-progress', publishId],
        queryFn: async () => {
            if (!publishId) return null;
            const progress = await trpcClient.monorail.getPublishProgress.query({ publishId });

            setUploadStatus(progress.status as any);
            if (progress.youtube?.bytesUploaded && progress.totalBytes) {
                setProgress(progress.youtube.bytesUploaded / progress.totalBytes);
            }

            if (progress.status === 'DONE') {
                setPublishId(null);
                onSuccess(); // Parent can refresh list
            }
            if (progress.status === 'FAILED') {
                setPublishId(null);
                setError(progress.error || "Upload failed");
            }
            return progress;
        },
        enabled: !!publishId,
        refetchInterval: 1000
    });

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-background rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-border">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
                        <span className="font-semibold">{isRecording ? "Recording..." : "New Recording"}</span>
                    </div>
                    {isRecording && <span className="font-mono text-sm">{formatTime(duration)}</span>}
                    {!isRecording && !uploadStatus && (
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                            ✕
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col items-center">
                    {uploadStatus ? (
                        <div className="w-full py-12 flex flex-col items-center text-center space-y-6">
                            {uploadStatus === 'DONE' ? (
                                <>
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                        <CheckCircle className="w-8 h-8" />
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold text-foreground">
                                            {ytConnection?.connected ? "Published!" : "Saved!"}
                                        </h3>
                                        <p className="text-muted-foreground">
                                            {ytConnection?.connected ? "Your video has been uploaded to YouTube." : "Video saved to your library."}
                                        </p>
                                    </div>
                                    <button onClick={() => {
                                        onSuccess();
                                        onClose();
                                    }} className="px-6 py-2 bg-foreground text-background rounded-lg font-medium">
                                        View in Library
                                    </button>
                                </>
                            ) : uploadStatus === 'FAILED' ? (
                                <>
                                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                                        <AlertTriangle className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-foreground">Upload Failed</h3>
                                        <p className="text-muted-foreground">{error}</p>
                                    </div>
                                    <button onClick={onClose} className="px-6 py-2 bg-secondary text-foreground rounded-lg font-medium">
                                        Close
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Loader2 className="w-12 h-12 text-accent animate-spin" />
                                    <div className="w-full max-w-xs space-y-2">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Processing & Uploading...</span>
                                            <span>{Math.round(progress * 100)}%</span>
                                        </div>
                                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-accent transition-all duration-300"
                                                style={{ width: `${progress * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Mode Selection */}
                            <div className="flex bg-muted/50 p-1 rounded-lg mb-4 w-full max-w-xs">
                                <button
                                    onClick={() => setRecorderMode('video')}
                                    className={`flex-1 py-1 text-sm font-medium rounded-md transition-all ${recorderMode === 'video' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    Video
                                </button>
                                <button
                                    onClick={() => setRecorderMode('audio')}
                                    className={`flex-1 py-1 text-sm font-medium rounded-md transition-all ${recorderMode === 'audio' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    Audio
                                </button>
                                <button
                                    onClick={() => setRecorderMode('screen')}
                                    className={`flex-1 py-1 text-sm font-medium rounded-md transition-all ${recorderMode === 'screen' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    Screen
                                </button>
                            </div>

                            {/* Camera Preview */}
                            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-6 shadow-md border border-zinc-800">
                                {(recorderMode === 'video' || (isRecording && recorderMode !== 'audio')) ? (
                                    <video
                                        ref={videoPreviewRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className={`w-full h-full object-cover ${(!isRecording && recorderMode === 'video') ? "transform scale-x-[-1]" : ""}`}
                                    />
                                ) : recorderMode === 'audio' ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                        <div className="flex flex-col items-center">
                                            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center animate-pulse">
                                                <Mic className="w-10 h-10 text-zinc-400" />
                                            </div>
                                            <p className="mt-4 text-zinc-500 font-medium">Audio Only</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                        <div className="flex flex-col items-center">
                                            <MonitorIcon className="w-16 h-16 text-zinc-700" />
                                            <p className="mt-4 text-zinc-500 font-medium">Screen Share</p>
                                            <p className="text-xs text-zinc-600">Select screen after clicking start</p>
                                        </div>
                                    </div>
                                )}

                                {!permissionGranted && !error && recorderMode !== 'screen' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                                        Waiting for access...
                                    </div>
                                )}
                                {error && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-red-500 p-4 text-center">
                                        <AlertTriangle className="w-8 h-8 mb-2" />
                                        {error}
                                    </div>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="flex gap-4">
                                {isRecording ? (
                                    <button
                                        onClick={stopRecording}
                                        className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                                    >
                                        <Square className="w-6 h-6 text-white fill-white" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={startRecording}
                                        disabled={!permissionGranted}
                                        className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:grayscale"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-white border-2 border-transparent" />
                                    </button>
                                )}
                            </div>
                            <p className="mt-4 text-sm text-muted-foreground">
                                {isRecording ? "Recording in progress..." : "Click to start recording"}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
