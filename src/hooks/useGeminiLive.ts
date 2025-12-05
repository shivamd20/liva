import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { base64ToUint8Array, decodeAudioData, createPcmBlob } from '../utils/audioUtils';

export enum ConnectionStatus {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    ERROR = 'error',
}

interface UseGeminiLiveProps {
    onAudioVolume: (volume: number) => void;
    // Removed drawing callback for now as it's read-only
}

export const useGeminiLive = ({ onAudioVolume }: UseGeminiLiveProps) => {
    const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
    const [error, setError] = useState<string | null>(null);

    // Audio Contexts
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    // Audio Processing
    const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    // Playback Scheduling
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    // Gemini Session
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const activeSessionRef = useRef<any | null>(null);

    const connect = useCallback(async (voiceName: string = 'Kore') => {
        try {
            setStatus(ConnectionStatus.CONNECTING);
            setError(null);

            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("VITE_GEMINI_API_KEY is missing");
            }

            // Initialize Audio Contexts
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            // Get Microphone Access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // Initialize Gemini Client
            const ai = new GoogleGenAI({ apiKey });

            const config = {
                model: 'gemini-2.0-flash-exp', // Updated to latest model if available, or keep specific version
                systemInstruction: `You are a helpful and creative collaborative AI assistant in Liva (a whiteboarding app).
        You are looking at a whiteboard where the user draws. 
        Collaborate with the user: analyze their drawings, answer questions, and explain concepts.
        The whiteboard is sent to you as images.
        Be concise, friendly, and encourage the user's ideas.`,
            };

            // Connect to Gemini Live
            const sessionPromise = ai.live.connect({
                model: config.model,
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: config.systemInstruction,
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                    },
                },
                callbacks: {
                    onopen: () => {
                        console.log("Gemini Live Session Opened");
                        setStatus(ConnectionStatus.CONNECTED);
                        startAudioInput();
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle Audio Output
                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const ctx = outputAudioContextRef.current;
                            // Sync playback time
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

                            const audioBuffer = await decodeAudioData(
                                base64ToUint8Array(base64Audio),
                                ctx
                            );

                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            const gainNode = ctx.createGain();

                            // Visualizer Hook
                            const analyser = ctx.createAnalyser();
                            analyser.fftSize = 32;
                            source.connect(analyser);
                            analyser.connect(ctx.destination);

                            const dataArray = new Uint8Array(analyser.frequencyBinCount);

                            // Throttle visualizer updates
                            let lastUpdate = 0;
                            const updateVolume = (timestamp: number) => {
                                if (!outputAudioContextRef.current) return;

                                if (timestamp - lastUpdate > 100) { // 100ms throttle
                                    analyser.getByteFrequencyData(dataArray);
                                    let sum = 0;
                                    for (let i = 0; i < dataArray.length; i++) {
                                        sum += dataArray[i];
                                    }
                                    onAudioVolume(sum / dataArray.length);
                                    lastUpdate = timestamp;
                                }

                                requestAnimationFrame(updateVolume);
                            };
                            requestAnimationFrame(updateVolume);

                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;

                            audioSourcesRef.current.add(source);
                            source.onended = () => {
                                audioSourcesRef.current.delete(source);
                            };
                        }

                        // Handle Interruptions
                        if (message.serverContent?.interrupted) {
                            audioSourcesRef.current.forEach(src => {
                                try { src.stop(); } catch (e) { }
                            });
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onclose: () => {
                        console.log("Gemini Live Session Closed");
                        setStatus(ConnectionStatus.DISCONNECTED);
                    },
                    onerror: (err) => {
                        console.error("Gemini Live Error:", err);
                        setError("Connection error occurred.");
                        disconnect();
                    }
                }
            });

            sessionPromiseRef.current = sessionPromise;

            // Wait for session to be usable
            const session = await sessionPromise;
            activeSessionRef.current = session;

        } catch (e: any) {
            console.error(e);
            setStatus(ConnectionStatus.ERROR);
            setError(e.message || "Failed to connect");
        }
    }, [onAudioVolume]);

    const startAudioInput = () => {
        if (!inputAudioContextRef.current || !mediaStreamRef.current || !sessionPromiseRef.current) return;

        const ctx = inputAudioContextRef.current;
        const source = ctx.createMediaStreamSource(mediaStreamRef.current);
        const processor = ctx.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createPcmBlob(inputData);

            // Use the promise to ensure we have a valid session before sending
            if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => {
                    session.sendRealtimeInput({ media: pcmBlob });
                });
            }
        };

        source.connect(processor);
        processor.connect(ctx.destination);

        inputSourceRef.current = source;
        processorRef.current = processor;
    };

    const sendVideoFrame = useCallback(async (base64Image: string) => {
        if (!sessionPromiseRef.current) return;
        const session = await sessionPromiseRef.current;
        // Gemini Live API expects 'image/jpeg' usually for video frames simulation
        session.sendRealtimeInput({
            media: {
                mimeType: 'image/jpeg',
                data: base64Image
            }
        });
    }, []);

    const disconnect = useCallback(async () => {
        setStatus(ConnectionStatus.DISCONNECTED);

        // Stop Audio Input
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (inputSourceRef.current) {
            inputSourceRef.current.disconnect();
            inputSourceRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (inputAudioContextRef.current) {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }

        // Stop Audio Output
        audioSourcesRef.current.forEach(src => {
            try { src.stop(); } catch (e) { }
        });
        audioSourcesRef.current.clear();
        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }

        // Close Session
        sessionPromiseRef.current = null;
        activeSessionRef.current = null;
        nextStartTimeRef.current = 0;

    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        status,
        error,
        connect,
        disconnect,
        sendVideoFrame
    };
};
