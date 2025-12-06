import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { trpcClient } from '../trpcClient';
import { Mic, Send, Square, Play, Pause, RefreshCw, MoreVertical, Loader2, Sparkles, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface Event {
    id: string;
    timestamp: number;
    type: string;
    payload: string;
    metadata: any;
}

// Add simplified SpeechContext if needed or just use hook directly.
import { useSpeechToSpeech } from '../lib/use-speech-to-speech';
import { Phone, PhoneOff, MicOff } from 'lucide-react';

const GEMINI_API_KEY_KEY = 'gemini_api_key_manual';

interface ConversationProps {
    id?: string;
    className?: string;
    minimal?: boolean;
}

export function ConversationTest({ id: propId, className, minimal = false }: ConversationProps) {
    const { id: paramId } = useParams<{ id: string }>();
    const conversationId = propId || paramId;

    const [events, setEvents] = useState<Event[]>([]);
    const [inputText, setInputText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_API_KEY_KEY) || import.meta.env.VITE_GEMINI_API_KEY || '');
    const syncedMessageIds = useRef<Set<string>>(new Set());

    const {
        start: startSpeech,
        stop: stopSpeech,
        connected,
        isMuted,
        mute,
        messages: speechMessages,
        volume
    } = useSpeechToSpeech({
        apiKey,
        voiceName: 'Kore',
        onMessage: (text) => {
            // Optional: Real-time transcript updates can be handled here if needed
        },
        onError: (err) => {
            toast.error("Voice Error: " + err.message);
            if (connected) stopSpeech();
        }
    });

    // Sync speech messages to backend
    useEffect(() => {
        if (!conversationId) return;
        const syncMessages = async () => {
            for (const msg of speechMessages) {
                if (syncedMessageIds.current.has(msg.id)) continue;

                syncedMessageIds.current.add(msg.id); // Mark as processing

                try {
                    let type: "text_in" | "audio_in" | "text_out" | "audio_out" | "" = "";
                    let payload = "";

                    if (msg.type === 'user' && 'audioBlob' in msg) {
                        type = 'audio_in';
                        // Convert blob to base64
                        payload = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(msg.audioBlob!);
                        });
                    } else if (msg.type === 'ai') {
                        // Send text transcript if available
                        if ('transcription' in msg && msg.transcription) {
                            await trpcClient.conversation.append.mutate({
                                conversationId,
                                type: 'text_out',
                                payload: msg.transcription,
                            });
                        }

                        // Send audio if available
                        if ('audioBlob' in msg && msg.audioBlob) {
                            const audioPayload = await new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(msg.audioBlob!);
                            });

                            await trpcClient.conversation.append.mutate({
                                conversationId,
                                type: 'audio_out',
                                payload: audioPayload,
                            });
                        }

                        await fetchHistory();
                        continue; // Handled both separately
                    }

                    if (type && payload) {
                        await trpcClient.conversation.append.mutate({
                            conversationId,
                            type: type as any,
                            payload,
                        });
                        await fetchHistory();
                    }
                } catch (e) {
                    console.error("Failed to sync message", e);
                    syncedMessageIds.current.delete(msg.id); // Retry later?
                }
            }

        };

        syncMessages();
    }, [speechMessages.length, conversationId]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    // Polling for updates
    useEffect(() => {
        if (!conversationId) return;

        fetchHistory();
        const interval = setInterval(fetchHistory, 2000);
        return () => clearInterval(interval);
    }, [conversationId]);

    // Auto-scroll on new events
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [events.length, isGenerating]);

    async function fetchHistory() {
        if (!conversationId) return;
        try {
            const history = await trpcClient.conversation.getHistory.query({ conversationId });
            setEvents(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(history)) {
                    return history as Event[];
                }
                return prev;
            });
        } catch (err) {
            console.error("Failed to fetch history", err);
        }
    }

    async function handleSendText() {
        if (!conversationId || !inputText.trim()) return;

        const text = inputText;
        setInputText('');
        setIsGenerating(true);

        try {
            await trpcClient.conversation.append.mutate({
                conversationId,
                type: 'text_in',
                payload: text,
            });
            await fetchHistory();
        } catch (err) {
            toast.error('Failed to send text');
            console.error(err);
            setInputText(text);
        } finally {
            setIsGenerating(false);
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
        setIsGenerating(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64Audio = reader.result as string;
                await trpcClient.conversation.append.mutate({
                    conversationId,
                    type: 'audio_in',
                    payload: base64Audio,
                });
                await fetchHistory();
                setLoading(false);
                setIsGenerating(false);
            };
        } catch (err) {
            toast.error('Failed to send audio');
            console.error(err);
            setLoading(false);
            setIsGenerating(false);
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

    if (!conversationId) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-muted/20 p-8">
                <div className="text-center space-y-4">
                    <div className="bg-muted inline-flex p-4 rounded-full">
                        <Sparkles className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">Select a Conversation</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Choose a conversation from the sidebar or create a new one to get started.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "flex flex-col h-full w-full bg-background relative overflow-hidden",
            className
        )}>
            {/* Header */}
            {!minimal && (
                <div className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-md z-10 sticky top-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold">Assistant Chat</h2>
                            <p className="text-xs text-muted-foreground">
                                {connected ? (
                                    <span className="flex items-center gap-1 text-green-500">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        Voice Active
                                    </span>
                                ) : "Always active"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={isVoiceMode ? (connected ? "destructive" : "secondary") : "outline"}
                                        size="icon"
                                        className={cn("mr-2 transition-all", isVoiceMode && "w-auto px-3 gap-2")}
                                        onClick={() => {
                                            if (isVoiceMode) {
                                                if (connected) stopSpeech();
                                                setIsVoiceMode(false);
                                            } else {
                                                if (!apiKey) {
                                                    const k = prompt("Please enter Gemini API Key:");
                                                    if (k) {
                                                        localStorage.setItem(GEMINI_API_KEY_KEY, k);
                                                        setApiKey(k);
                                                        setIsVoiceMode(true);
                                                        // Auto-start
                                                        setTimeout(() => {
                                                            // We need to trigger startSpeech, but updated state might not be ready in this closure?
                                                            // Actually apiKey is state, so we might need useEffect or just rely on user clicking start?
                                                            // Let's just switch mode.
                                                        }, 100);
                                                    }
                                                } else {
                                                    setIsVoiceMode(true);
                                                }
                                            }
                                        }}
                                    >
                                        {isVoiceMode ? (
                                            <>
                                                <PhoneOff className="w-4 h-4" />
                                                <span className="text-xs">End Voice</span>
                                            </>
                                        ) : (
                                            <Phone className="w-4 h-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {isVoiceMode ? "Switch to Text Mode" : "Switch to Voice Mode"}
                                </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => fetchHistory()}>
                                        <RefreshCw className="w-4 h-4 opacity-70" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Refresh</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 ml-2"
                            onClick={handleSummarize}
                        >
                            Summarize
                        </Button>
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <ScrollArea className="flex-1 min-h-0 p-4 md:p-6 pb-2" ref={scrollViewportRef}>
                <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full pb-8">
                    {events.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center rotate-3">
                                <Sparkles className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-center font-medium">No messages yet. Start the conversation!</p>
                        </div>
                    )}

                    {events.map((event) => (
                        <MessageBubble key={event.id} event={event} />
                    ))}

                    {isGenerating && (
                        <div className="flex justify-start w-full animate-in fade-in duration-300 slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 bg-muted/50 rounded-2xl rounded-bl-none px-4 py-3">
                                <span className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></span>
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} />
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 md:p-6 pt-2 bg-gradient-to-t from-background via-background to-transparent z-10 w-full max-w-3xl mx-auto">

                {isVoiceMode ? (
                    <div className="flex flex-col gap-4 items-center justify-center p-4 bg-muted/20 rounded-2xl border border-dashed animate-in slide-in-from-bottom-4">
                        {!connected ? (
                            <Button size="lg" className="w-full sm:w-auto gap-2 rounded-full" onClick={() => startSpeech()}>
                                <Phone className="w-4 h-4" /> Start Conversation
                            </Button>
                        ) : (
                            <div className="flex flex-col items-center gap-4 w-full">
                                {/* Visualizer Placeholder */}
                                <div className="h-12 flex items-center justify-center gap-1">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-1.5 bg-primary rounded-full transition-all duration-75",
                                                volume > 0.01 ? "animate-pulse" : "h-2 opacity-20"
                                            )}
                                            style={{
                                                height: volume > 0.01 ? `${Math.max(8, Math.random() * 30)}px` : '8px'
                                            }}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button
                                        variant={isMuted ? "destructive" : "secondary"}
                                        size="icon"
                                        className="rounded-full w-12 h-12"
                                        onClick={mute}
                                    >
                                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="rounded-full w-12 h-12"
                                        onClick={() => stopSpeech()}
                                    >
                                        <PhoneOff className="w-5 h-5" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground animate-pulse">Listening...</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={cn(
                        "flex items-center gap-2 p-1.5 rounded-full border bg-background shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50",
                        isRecording && "ring-2 ring-red-500/20 border-red-500/50"
                    )}>
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                            placeholder={isRecording ? "Listening..." : "Type a message..."}
                            className="flex-1 bg-transparent px-4 py-2.5 text-sm focus:outline-none placeholder:text-muted-foreground/70"
                            disabled={loading || isRecording}
                        />

                        <div className="flex items-center gap-1 pr-1">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={isRecording ? stopRecording : startRecording}
                                            size="icon"
                                            variant={isRecording ? "destructive" : "ghost"}
                                            className={cn(
                                                "h-9 w-9 rounded-full transition-all duration-300",
                                                isRecording && "animate-pulse scale-110",
                                                !isRecording && "hover:bg-muted text-muted-foreground hover:text-foreground"
                                            )}
                                            disabled={loading}
                                        >
                                            {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        {isRecording ? "Stop Recording" : "Voice Input"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <Button
                                onClick={handleSendText}
                                disabled={!inputText.trim() || loading || isRecording}
                                size="icon"
                                className={cn(
                                    "h-9 w-9 rounded-full shrink-0 transition-all",
                                    inputText.trim() ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "bg-muted text-muted-foreground opacity-50"
                                )}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 translate-x-0.5" />}
                            </Button>
                        </div>
                    </div>
                )}
                <div className="text-center mt-2">
                    <p className="text-[10px] text-muted-foreground/50">
                        AI can update visuals and perform actions.
                    </p>
                </div>
            </div>
        </div>
    );
}

function MessageBubble({ event }: { event: Event }) {
    const isUser = event.type.endsWith('_in');
    const isAudio = event.type.includes('audio');
    const isSummary = event.type === 'summary';

    if (isSummary) {
        return (
            <div className="flex justify-center my-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-primary/5 border border-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-medium flex items-center gap-2 shadow-sm">
                    <Sparkles className="w-3 h-3" />
                    Summary Generated
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
            isUser ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-3.5 shadow-sm text-sm relative group transition-all",
                isUser
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted/80 text-foreground border border-black/5 dark:border-white/5 rounded-bl-sm"
            )}>

                {event.type.includes('text') && (
                    <p className="whitespace-pre-wrap leading-relaxed">{event.payload}</p>
                )}

                {isAudio && (
                    <AudioPlayer src={event.payload} isUser={isUser} />
                )}

                <span className={cn(
                    "text-[9px] opacity-0 group-hover:opacity-60 transition-opacity absolute bottom-1",
                    isUser ? "right-full mr-2 text-foreground" : "left-full ml-2 text-muted-foreground"
                )}>
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
}

function AudioPlayer({ src, isUser }: { src: string; isUser: boolean }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleLoadedMetadata = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const formatTime = (time: number) => {
        if (!time || isNaN(time)) return "0:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-3 min-w-[200px]">
            <audio ref={audioRef} src={src} className="hidden" />

            <button
                onClick={togglePlay}
                className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0",
                    isUser ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground" : "bg-background shadow-sm hover:bg-background/80 text-primary"
                )}
            >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <div className="flex-1 space-y-1">
                <div className="h-1 bg-current/20 rounded-full overflow-hidden w-full">
                    <div
                        className="h-full bg-current transition-all duration-100 ease-linear rounded-full"
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                </div>
                <div className="flex justify-between items-center text-[10px] opacity-80 font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            <Volume2 className={cn("w-4 h-4 opacity-50 shrink-0", isPlaying && "animate-pulse")} />
        </div>
    );
}
