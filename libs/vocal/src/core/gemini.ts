import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { VocalMessage } from './types';

export interface UseVocalGeminiParams {
    apiKey: string;
    model?: string;
    systemInstruction?: string;
    voiceName?: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
    onMessage?: (text: string) => void;
    onError?: (error: Error) => void;
    /** Optional callback to fetch a visual frame (base64 image or Blob) to stream to the model */
    getFrame?: () => Promise<string | Blob | null>;
    /** Frames per second for visual streaming (default: 1) */
    frameRate?: number;
}

export interface VocalGeminiState {
    start: (promptOverride?: string) => Promise<void>;
    stop: () => Promise<void>;
    pause: () => void;
    mute: () => void;
    clearMessages: () => void;
    systemPrompt: string;
    connected: boolean;
    isMuted: boolean;
    isPaused: boolean;
    volume: number;
    messages: VocalMessage[];
}

// Helper to generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper: Convert Int16Array to WAV Blob for playback
function int16ArrayToWavBlob(int16Data: Int16Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + int16Data.length * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + int16Data.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, 1, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(36, 'data');
    view.setUint32(40, int16Data.length * 2, true);

    // Audio data
    const int16View = new Int16Array(buffer, 44);
    int16View.set(int16Data);

    return new Blob([buffer], { type: 'audio/wav' });
}

export function useVocalGemini({
    apiKey,
    model = 'gemini-2.5-flash-native-audio-preview-09-2025',
    systemInstruction,
    voiceName = 'Zephyr',
    onMessage,
    onError,
    getFrame,
    frameRate = 1
}: UseVocalGeminiParams): VocalGeminiState {

    if (!systemInstruction?.length) {
        // Warning but don't crash, provide default?
        // throw new Error('systemInstruction is required');
        systemInstruction = "You are a helpful assistant.";
    }

    const [connected, setConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [volume, setVolume] = useState(0);
    const [currentSystemPrompt, setCurrentSystemPrompt] = useState(systemInstruction);
    const [messages, setMessages] = useState<VocalMessage[]>([]);

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

    // Message buffering refs
    const userAudioBufferRef = useRef<Int16Array[]>([]);
    const aiAudioBufferRef = useRef<Int16Array[]>([]);
    const aiTextBufferRef = useRef<string>('');
    const userSilenceCountRef = useRef<number>(0);
    const userIsSpeakingRef = useRef<boolean>(false);
    const SILENCE_THRESHOLD = 0.02;
    const SILENCE_CHUNKS_REQUIRED = 10; // ~640ms of silence to end user turn

    useEffect(() => {
        isMutedRef.current = isMuted;
    }, [isMuted]);

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    // Helper: Create Blob for Audio Input (also returns raw Int16 for buffering)
    const createBlob = (data: Float32Array): { blob: { data: string; mimeType: string }; int16: Int16Array; rms: number } => {
        const l = data.length;
        const int16 = new Int16Array(l);
        // Simple volume calculation for visualizer
        let sum = 0;
        for (let i = 0; i < l; i++) {
            const s = Math.max(-1, Math.min(1, data[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            sum += s * s;
        }
        const rms = Math.sqrt(sum / l);
        setVolume(rms);

        // Create the blob manually as shown in documentation
        let binary = '';
        const bytes = new Uint8Array(int16.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);

        return {
            blob: {
                data: b64,
                mimeType: 'audio/pcm;rate=16000',
            },
            int16: int16.slice(), // Clone for buffering
            rms
        };
    };

    // Helper: Finalize user audio buffer into a message
    const finalizeUserMessage = useCallback(() => {
        if (userAudioBufferRef.current.length === 0) return;

        const totalLength = userAudioBufferRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Int16Array(totalLength);
        let offset = 0;
        for (const chunk of userAudioBufferRef.current) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }

        const audioBlob = int16ArrayToWavBlob(combined, 16000);
        const duration = totalLength / 16000;

        // Convert blob to base64 for VocalMessage payload
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            const message: VocalMessage = {
                id: generateId(),
                timestamp: Date.now(),
                type: 'user',
                payload: base64,
                metadata: {
                    duration,
                    mimeType: 'audio/wav'
                }
            };
            setMessages(prev => [...prev, message]);
        };
        reader.readAsDataURL(audioBlob);

        userAudioBufferRef.current = [];
        userSilenceCountRef.current = 0;
        userIsSpeakingRef.current = false;
    }, []);

    // Helper: Finalize AI audio buffer into a message
    const finalizeAIMessage = useCallback(() => {
        if (aiAudioBufferRef.current.length === 0 && !aiTextBufferRef.current) return;

        if (aiAudioBufferRef.current.length > 0) {
            const totalLength = aiAudioBufferRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
            const combined = new Int16Array(totalLength);
            let offset = 0;
            for (const chunk of aiAudioBufferRef.current) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }

            const audioBlob = int16ArrayToWavBlob(combined, 24000);
            const duration = totalLength / 24000;

            // Convert blob to base64 for VocalMessage payload
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                const message: VocalMessage = {
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'ai',
                    payload: base64,
                    metadata: {
                        duration,
                        mimeType: 'audio/wav',
                        transcript: aiTextBufferRef.current || undefined
                    }
                };
                setMessages(prev => [...prev, message]);
            };
            reader.readAsDataURL(audioBlob);

        } else if (aiTextBufferRef.current) {
            // Text-only message
            const message: VocalMessage = {
                id: generateId(),
                timestamp: Date.now(),
                type: 'ai',
                payload: aiTextBufferRef.current
            };
            setMessages(prev => [...prev, message]);
        }

        aiAudioBufferRef.current = [];
        aiTextBufferRef.current = '';
    }, []);

    // Helper: Decode base64 to Int16Array (for buffering AI audio)
    const base64ToInt16Array = (base64String: string): Int16Array => {
        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new Int16Array(bytes.buffer);
    };

    // Helper: Decode Audio Output for playback
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
        // Finalize any pending messages before disconnecting
        finalizeUserMessage();
        finalizeAIMessage();

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

        // Clean up visual frame streaming
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
    }, [finalizeUserMessage, finalizeAIMessage]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        userAudioBufferRef.current = [];
        aiAudioBufferRef.current = [];
        aiTextBufferRef.current = '';
        userSilenceCountRef.current = 0;
        userIsSpeakingRef.current = false;
    }, []);

    const start = useCallback(async (promptOverride?: string) => {
        console.log("[Vocal] Starting speech-to-speech session...");
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
            console.log("[Vocal] Requesting microphone access...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("[Vocal] Microphone access granted.");
            mediaStreamRef.current = stream;

            if (!apiKey) {
                console.error("No API key available");
                throw new Error("API key is missing. Please check your settings.");
            }

            const ai = new GoogleGenAI({ apiKey });

            // Connect to Gemini
            console.log("[Vocal] Connecting to Gemini Live API...");
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
                        console.log("[Vocal] Gemini Live API connected.");
                        setConnected(true);

                        // Setup Input Processing
                        if (!inputAudioContextRef.current || !mediaStreamRef.current) return;

                        const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (e) => {
                            if (isMutedRef.current || isPausedRef.current) return;

                            const inputData = e.inputBuffer.getChannelData(0);
                            const { blob: pcmBlob, int16, rms } = createBlob(inputData);

                            // Buffer user audio for message capture
                            if (rms > SILENCE_THRESHOLD) {
                                // User is speaking
                                userIsSpeakingRef.current = true;
                                userSilenceCountRef.current = 0;
                                userAudioBufferRef.current.push(int16);
                            } else if (userIsSpeakingRef.current) {
                                // User might be pausing
                                userAudioBufferRef.current.push(int16);
                                userSilenceCountRef.current++;

                                if (userSilenceCountRef.current >= SILENCE_CHUNKS_REQUIRED) {
                                    // User stopped speaking, finalize the message
                                    finalizeUserMessage();
                                }
                            }

                            sessionPromiseRef.current?.then((session: any) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };

                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current.destination);

                        // Setup Visual Frame Streaming (Generic)
                        if (getFrame) {
                            frameIntervalRef.current = window.setInterval(async () => {
                                if (!sessionPromiseRef.current) return;

                                try {
                                    const frame = await getFrame();
                                    if (!frame) return;

                                    let base64Data: string;

                                    if (typeof frame === 'string') {
                                        // Assume base64 string, remove prefix if present
                                        base64Data = frame.includes(',') ? frame.split(',')[1] : frame;
                                    } else if (frame instanceof Blob) {
                                        base64Data = await blobToBase64(frame);
                                    } else {
                                        return;
                                    }

                                    sessionPromiseRef.current?.then((session: any) => {
                                        session.sendRealtimeInput({
                                            media: {
                                                data: base64Data,
                                                mimeType: 'image/jpeg'
                                            }
                                        });
                                    });
                                } catch (err) {
                                    console.error('[Vocal] Failed to get frame:', err);
                                }
                            }, 1000 / frameRate);
                        }
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle text messages
                        if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
                            const text = message.serverContent.modelTurn.parts[0].text;
                            console.log("[Vocal] Received text message:", text);
                            aiTextBufferRef.current += text;
                            if (onMessage) onMessage(text);
                        }

                        // Handle audio data
                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
                            // Buffer AI audio for message capture
                            const int16Data = base64ToInt16Array(base64Audio);
                            aiAudioBufferRef.current.push(int16Data);

                            // Finalize any pending user message when AI starts responding
                            if (userAudioBufferRef.current.length > 0) {
                                finalizeUserMessage();
                            }

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

                        // Check for turn completion
                        if (message.serverContent?.turnComplete) {
                            console.log("[Vocal] AI turn complete, finalizing message");
                            finalizeAIMessage();
                        }

                        if (message.serverContent?.interrupted) {
                            sourcesRef.current.forEach(s => s.stop());
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                            // Finalize whatever AI audio we have so far
                            finalizeAIMessage();
                        }
                    },
                    onclose: (e) => {
                        console.log("[Vocal] Gemini Live API connection closed", e);
                        setConnected(false);
                    },
                    onerror: (err: any) => {
                        console.error("[Vocal] Gemini Live API Error:", err);
                        if (onError) onError(new Error(err.message || "Unknown error"));
                    }
                }
            });

        } catch (err) {
            console.error("[Vocal] Failed to start speech to speech", err);
            if (onError) onError(err as Error);
            setConnected(false);
        }
    }, [apiKey, model, voiceName, currentSystemPrompt, disconnect, onError, onMessage, getFrame, frameRate, finalizeUserMessage, finalizeAIMessage]);

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
        clearMessages,
        systemPrompt: currentSystemPrompt,
        connected,
        isMuted,
        isPaused,
        volume,
        messages
    };
}
