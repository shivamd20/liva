import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { exportToCanvas } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

export interface UseSpeechToSpeechParams {
    apiKey: string;
    model?: string;
    systemInstruction?: string;
    voiceName?: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
    onMessage?: (text: string) => void;
    onError?: (error: Error) => void;
    /** Optional canvas ref to stream frames to AI for visual understanding */
    canvasRef?: React.RefObject<HTMLCanvasElement | null>;
    /** Optional Excalidraw API ref to stream frames to AI for visual understanding */
    excalidrawAPIRef?: React.RefObject<ExcalidrawImperativeAPI | null>;
    /** Frames per second for canvas streaming (default: 2) */
    frameRate?: number;
}

export interface SpeechState {
    start: (promptOverride?: string) => Promise<void>;
    stop: () => Promise<void>;
    pause: () => void;
    mute: () => void;
    system_prompt: string;
    connected: boolean;
    isMuted: boolean;
    isPaused: boolean;
    volume: number;
}

export function useSpeechToSpeech({
    apiKey,
    model = 'gemini-2.5-flash-native-audio-preview-09-2025',
    systemInstruction = 'You are a helpful assistant.',
    voiceName = 'Zephyr',
    onMessage,
    onError,
    canvasRef,
    excalidrawAPIRef,
    frameRate = 2
}: UseSpeechToSpeechParams): SpeechState {
    const [connected, setConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [volume, setVolume] = useState(0);
    const [currentSystemPrompt, setCurrentSystemPrompt] = useState(systemInstruction);

    // Audio Contexts & State
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);

    // Frame capture interval for canvas streaming
    const frameIntervalRef = useRef<number | null>(null);
    const isMutedRef = useRef(isMuted);
    const isPausedRef = useRef(isPaused);

    useEffect(() => {
        isMutedRef.current = isMuted;
    }, [isMuted]);

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    // Helper: Create Blob for Audio Input
    const createBlob = (data: Float32Array) => {
        const l = data.length;
        const int16 = new Int16Array(l);
        // Simple volume calculation for visualizer
        let sum = 0;
        for (let i = 0; i < l; i++) {
            const s = Math.max(-1, Math.min(1, data[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            sum += s * s;
        }
        setVolume(Math.sqrt(sum / l));

        // Create the blob manually as shown in documentation
        let binary = '';
        const bytes = new Uint8Array(int16.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);

        return {
            data: b64,
            mimeType: 'audio/pcm;rate=16000',
        };
    };

    // Helper: Decode Audio Output
    const decodeAudioData = async (
        base64String: string,
        ctx: AudioContext
    ): Promise<AudioBuffer> => {
        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const dataInt16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(dataInt16.length);
        for (let i = 0; i < dataInt16.length; i++) {
            float32[i] = dataInt16[i] / 32768.0;
        }

        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.copyToChannel(float32, 0);
        return buffer;
    };

    // Helper: Convert Blob to base64 for canvas frame streaming
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                // Remove the data URL prefix (data:image/jpeg;base64,)
                const base64Data = base64.split(',')[1];
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const disconnect = useCallback(async () => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => {
                try {
                    // @ts-ignore
                    if (session.close) session.close();
                } catch (e) { }
            });
            sessionPromiseRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        if (inputAudioContextRef.current) {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }

        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }

        // Clean up canvas frame streaming
        if (frameIntervalRef.current) {
            window.clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }

        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();

        setConnected(false);
        setIsPaused(false);
        setIsMuted(false);
        setVolume(0);
    }, []);

    const start = useCallback(async (promptOverride?: string) => {
        try {
            await disconnect(); // Ensure clean state

            const effectiveInstruction = promptOverride || currentSystemPrompt;
            setCurrentSystemPrompt(effectiveInstruction);

            // Initialize Audio Contexts
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
            outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

            // Ensure contexts are active (browsers often suspend them until user interaction)
            if (inputAudioContextRef.current.state === 'suspended') {
                await inputAudioContextRef.current.resume();
            }
            if (outputAudioContextRef.current.state === 'suspended') {
                await outputAudioContextRef.current.resume();
            }

            outputNodeRef.current = outputAudioContextRef.current.createGain();
            outputNodeRef.current.connect(outputAudioContextRef.current.destination);

            // Get Media Stream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const ai = new GoogleGenAI({ apiKey });

            // Connect to Gemini
            sessionPromiseRef.current = ai.live.connect({
                model,
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                    },
                    systemInstruction: { parts: [{ text: effectiveInstruction }] },
                },
                callbacks: {
                    onopen: () => {
                        setConnected(true);

                        // Setup Input Processing
                        if (!inputAudioContextRef.current || !mediaStreamRef.current) return;

                        const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (e) => {
                            if (isMutedRef.current || isPausedRef.current) return; // Mute logic

                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);

                            sessionPromiseRef.current?.then((session: any) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };

                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current.destination);

                        // Setup Canvas Frame Streaming (supports both canvasRef and excalidrawAPIRef)
                        if (canvasRef?.current || excalidrawAPIRef?.current) {
                            frameIntervalRef.current = window.setInterval(async () => {
                                if (!sessionPromiseRef.current) return;

                                let canvas: HTMLCanvasElement | null = null;

                                // Priority: excalidrawAPIRef > canvasRef
                                if (excalidrawAPIRef?.current) {
                                    const api = excalidrawAPIRef.current;
                                    const elements = api.getSceneElements();
                                    if (elements && elements.length > 0) {
                                        try {
                                            canvas = await exportToCanvas({
                                                elements,
                                                appState: api.getAppState(),
                                                files: api.getFiles(),
                                                getDimensions: () => ({ width: 512, height: 512 }),
                                            });
                                        } catch (err) {
                                            console.error('Failed to export Excalidraw canvas:', err);
                                        }
                                    }
                                } else if (canvasRef?.current) {
                                    canvas = canvasRef.current;
                                }

                                if (!canvas) return;

                                canvas.toBlob(
                                    async (blob) => {
                                        if (blob) {
                                            const base64Data = await blobToBase64(blob);
                                            sessionPromiseRef.current?.then((session: any) => {
                                                session.sendRealtimeInput({
                                                    media: {
                                                        data: base64Data,
                                                        mimeType: 'image/jpeg'
                                                    }
                                                });
                                            });
                                        }
                                    },
                                    'image/jpeg',
                                    0.6 // Quality
                                );
                            }, 1000 / frameRate);
                        }
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (onMessage && message.serverContent?.modelTurn?.parts?.[0]?.text) {
                            onMessage(message.serverContent.modelTurn.parts[0].text);
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
                            const ctx = outputAudioContextRef.current;
                            const buffer = await decodeAudioData(base64Audio, ctx);

                            // Schedule playback
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

                            const source = ctx.createBufferSource();
                            source.buffer = buffer;
                            source.connect(outputNodeRef.current);

                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                            });

                            source.start(nextStartTimeRef.current);
                            sourcesRef.current.add(source);

                            nextStartTimeRef.current += buffer.duration;
                        }

                        if (message.serverContent?.interrupted) {
                            sourcesRef.current.forEach(s => s.stop());
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onclose: () => {
                        setConnected(false);
                    },
                    onerror: (err: any) => {
                        console.error(err);
                        if (onError) onError(new Error(err.message || "Unknown error"));
                    }
                }
            });

        } catch (err) {
            console.error("Failed to start speech to speech", err);
            if (onError) onError(err as Error);
            setConnected(false);
        }
    }, [apiKey, model, voiceName, currentSystemPrompt, disconnect, onError, onMessage, canvasRef, excalidrawAPIRef, frameRate]);

    const stop = useCallback(async () => {
        await disconnect();
    }, [disconnect]);

    const mute = useCallback(() => {
        setIsMuted(prev => !prev);
    }, []);

    const pause = useCallback(() => {
        setIsPaused(prev => {
            const next = !prev;
            if (outputAudioContextRef.current) {
                if (next) {
                    outputAudioContextRef.current.suspend();
                } else {
                    outputAudioContextRef.current.resume();
                }
            }
            return next;
        });
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        start,
        stop,
        pause,
        mute,
        system_prompt: currentSystemPrompt,
        connected,
        isMuted,
        isPaused,
        volume
    };
}