import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { trpcClient } from '../trpcClient';
import { Mic, Send, Square, Play, Pause, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Event {
    id: string;
    timestamp: number;
    type: string;
    payload: string;
    metadata: any;
}

export function ConversationTest() {
    const { id: conversationId } = useParams<{ id: string }>();
    const [events, setEvents] = useState<Event[]>([]);
    const [inputText, setInputText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [loading, setLoading] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Polling for updates (simple version)
    useEffect(() => {
        if (!conversationId) return;

        fetchHistory();
        const interval = setInterval(fetchHistory, 2000);
        return () => clearInterval(interval);
    }, [conversationId]);

    async function fetchHistory() {
        if (!conversationId) return;
        try {
            const history = await trpcClient.conversation.getHistory.query({ conversationId });
            // Deduplicate by ID just in case, though state update should handle it if replaced
            setEvents(history as Event[]);
        } catch (err) {
            console.error("Failed to fetch history", err);
        }
    }

    async function handleSendText() {
        if (!conversationId || !inputText.trim()) return;

        const text = inputText;
        setInputText('');

        try {
            await trpcClient.conversation.append.mutate({
                conversationId,
                type: 'text_in',
                payload: text,
            });
            fetchHistory();
        } catch (err) {
            toast.error('Failed to send text');
            console.error(err);
            setInputText(text); // Restore text
        }
    }

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                await sendAudio(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            toast.error("Could not access microphone");
        }
    }

    function stopRecording() {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }

    async function sendAudio(blob: Blob) {
        if (!conversationId) return;

        setLoading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64Audio = reader.result as string;
                // reader.result includes "data:audio/webm;base64,..." - we might want to keep it or strip it.
                // For simplicity, keeping it allows direct playback in <audio> tag src.

                await trpcClient.conversation.append.mutate({
                    conversationId,
                    type: 'audio_in',
                    payload: base64Audio,
                });
                fetchHistory();
                setLoading(false);
            };
        } catch (err) {
            toast.error('Failed to send audio');
            console.error(err);
            setLoading(false);
        }
    }

    async function handleSummarize() {
        if (!conversationId) return;
        try {
            await trpcClient.conversation.summarize.mutate({ conversationId });
            toast.success("Summarization triggered");
            fetchHistory();
        } catch (err) {
            toast.error("Failed to summarize");
        }
    }

    async function handleVerify() {
        if (!conversationId) return;
        try {
            const res = await trpcClient.conversation.verify.query({ conversationId });
            console.log("DB Verification:", res);
            toast.info(`DB has ${res.eventCount} events. Check console.`);
        } catch (err) {
            console.error(err);
            toast.error("Verification failed");
        }
    }

    return (
        <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-bold">Conversation: {conversationId}</h1>
                <div className="flex gap-2">
                    <button
                        onClick={fetchHistory}
                        className="p-2 bg-white rounded-full shadow hover:bg-gray-100"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={handleSummarize}
                        className="px-4 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700 text-sm"
                    >
                        Summarize
                    </button>
                    <button
                        onClick={handleVerify}
                        className="px-4 py-2 bg-gray-600 text-white rounded shadow hover:bg-gray-700 text-sm"
                    >
                        Debug DB
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-white rounded-lg shadow mb-4">
                {events.length === 0 && <p className="text-center text-gray-500">No messages yet.</p>}
                {events.map((event) => (
                    <div key={event.id} className={`flex flex-col ${event.type.endsWith('_in') ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg ${event.type === 'summary' ? 'bg-yellow-100 border border-yellow-300 w-full text-center' :
                            event.type.endsWith('_in') ? 'bg-blue-100' : 'bg-gray-200'
                            }`}>
                            {event.type === 'summary' && <span className="text-xs font-bold text-yellow-800 uppercase block mb-1">Summary</span>}

                            {event.type.includes('text') && <p>{event.payload}</p>}

                            {event.type.includes('audio') && (
                                <audio controls src={event.payload} className="w-full min-w-[200px]" />
                            )}

                            <span className="text-[10px] text-gray-500 mt-1 block">
                                {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                    placeholder="Type a message..."
                    className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                />

                <button
                    onClick={handleSendText}
                    disabled={!inputText.trim() || loading}
                    className="p-2 bg-blue-600 text-white rounded-full disabled:opacity-50 hover:bg-blue-700 transition"
                >
                    <Send size={20} />
                </button>

                <div className="w-px h-8 bg-gray-300 mx-1"></div>

                <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-2 rounded-full transition ${isRecording
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    disabled={loading}
                >
                    {isRecording ? <Square size={20} /> : <Mic size={20} />}
                </button>
            </div>
        </div>
    );
}
