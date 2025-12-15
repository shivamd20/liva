import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useVocalGemini, VocalGeminiState } from '../core/gemini';
import { VocalBackendAdapter, VocalConfig, VocalEvent } from '../core/types';

export interface VocalContextType extends Omit<VocalGeminiState, 'messages'> {
    // We override messages to include persistent history
    events: VocalEvent[];
    isLoading: boolean;
    config: VocalConfig;
    sendMessage: (text: string) => Promise<void>;
    sendAudio: (blob: Blob) => Promise<void>;
    refreshHistory: () => Promise<void>;
    adapter: VocalBackendAdapter;
}

const VocalContext = createContext<VocalContextType | null>(null);

interface VocalProviderProps {
    children: ReactNode;
    adapter: VocalBackendAdapter;
    config: VocalConfig;
    /** Optional: override internal gemini params */
    geminiParams?: {
        frameRate?: number;
        getFrame?: () => Promise<string | Blob | null>;
    };
}

export const VocalProvider = ({ children, adapter, config, geminiParams }: VocalProviderProps) => {
    const [events, setEvents] = useState<VocalEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // We keep track of which local speech messages have been synced to backend
    const syncedMessageIds = useRef<Set<string>>(new Set());

    const gemini = useVocalGemini({
        apiKey: config.apiKey,
        systemInstruction: config.systemInstruction,
        voiceName: config.voiceName as any,
        model: config.model,
        onMessage: (text) => { },
        getFrame: geminiParams?.getFrame,
        frameRate: geminiParams?.frameRate
    });

    // 1. Fetch persistent history on mount and poll
    const fetchHistory = async () => {
        try {
            const history = await adapter.getHistory(config.conversationId);
            setEvents(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(history)) {
                    return history;
                }
                return prev;
            });
        } catch (err) {
            console.error("[Vocal] Failed to fetch history", err);
        }
    };

    useEffect(() => {
        if (!config.conversationId) return;
        fetchHistory();
        const interval = setInterval(fetchHistory, 2000);
        return () => clearInterval(interval);
    }, [config.conversationId]);

    // 2. Sync Local Voice Messages to Backend
    useEffect(() => {
        if (!config.conversationId) return;

        const syncMessages = async () => {
            for (const msg of gemini.messages) {
                if (syncedMessageIds.current.has(msg.id)) continue;
                syncedMessageIds.current.add(msg.id);

                try {
                    let type = "";
                    let payload = "";

                    if (msg.type === 'user' && msg.metadata?.mimeType?.startsWith('audio')) {
                        type = 'audio_in';
                        payload = msg.payload; // Already base64 from gemini hook
                    } else if (msg.type === 'ai') {
                        // Send text transcript if available
                        if (msg.metadata?.transcript) {
                            await adapter.append(config.conversationId, {
                                type: 'text_out',
                                payload: msg.metadata.transcript,
                                metadata: { timestamp: msg.timestamp }
                            });
                        }

                        // Send audio if available
                        if (msg.payload && msg.metadata?.mimeType?.startsWith('audio')) {
                            // It's base64 audio
                            await adapter.append(config.conversationId, {
                                type: 'audio_out',
                                payload: msg.payload,
                                metadata: {
                                    timestamp: msg.timestamp,
                                    duration: msg.metadata.duration
                                }
                            });
                        }

                        await fetchHistory();
                        continue; // Handled
                    }

                    if (type && payload) {
                        await adapter.append(config.conversationId, {
                            type,
                            payload,
                            metadata: { timestamp: msg.timestamp }
                        });
                        await fetchHistory();
                    }
                } catch (e) {
                    console.error("[Vocal] Failed to sync message", e);
                    syncedMessageIds.current.delete(msg.id);
                }
            }
        };

        syncMessages();
    }, [gemini.messages.length, config.conversationId]);

    // 3. Helpers for Text Input
    const sendMessage = async (text: string) => {
        if (!text.trim()) return;
        setIsLoading(true);
        try {
            await adapter.append(config.conversationId, {
                type: 'text_in',
                payload: text,
                metadata: { timestamp: Date.now() }
            });
            await fetchHistory();
            // Note: Sending text to *backend* doesn't necessarily send it to Gemini 
            // unless the backend orchestrates it, OR we are in a mode where we want Gemini to respond to text.
            // If strictly voice-to-voice, text chat might be separate.
            // But usually we want the AI to respond. 
            // Unlike existing ConversationTest, the `use-speech-to-speech` doesn't support `sendText` input yet?
            // Checking `useVocalGemini`... it only supports `start(prompt)` and streaming audio/video.
            // It uses `session.sendRealtimeInput` for media.
            // To send text to Gemini Live API? 
            // The Live API is primarily for audio/video. Text input is via `sendRealtimeInput` with text parts? - verifying gemini API.
            // Actually `use-speech-to-speech` didn't have `sendMessage` in its interface.
            // In ConversationTest: `handleSendText` does `trpcClient.conversation.append`.
            // Does the BACKEND trigger Gemini response? 
            // In Liva, `ConversationTest` has `handleSendText` -> backend -> ?
            // The `ConversationTest.tsx` doesn't seem to trigger Gemini for text input locally. 
            // It relies on `isGenerating` state but that was local.
            // If the user sends text, does the Voice AI respond?
            // In `use-speech-to-speech`, we only see microphone input.
            // So for now, `sendMessage` just stores to history.
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper for manual audio upload (e.g. file upload, not live mic)
    const sendAudio = async (blob: Blob) => {
        setIsLoading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                await adapter.append(config.conversationId, {
                    type: 'audio_in',
                    payload: base64,
                    metadata: { timestamp: Date.now() }
                });
                await fetchHistory();
                setIsLoading(false);
            };
        } catch (err) {
            setIsLoading(false);
            console.error(err);
        }
    };

    // Destructure to remove messages from gemini state
    const { messages: geminiMessages, ...geminiState } = gemini;

    const value: VocalContextType = {
        ...geminiState,
        // We hide the raw 'messages' from gemini hook and expose the full 'events' from history
        events,
        isLoading,
        config,
        sendMessage,
        sendAudio,
        refreshHistory: fetchHistory,
        adapter
    };

    return (
        <VocalContext.Provider value={value}>
            {children}
        </VocalContext.Provider>
    );
};

export const useVocal = () => {
    const context = useContext(VocalContext);
    if (!context) {
        throw new Error('useVocal must be used within a VocalProvider');
    }
    return context;
};
