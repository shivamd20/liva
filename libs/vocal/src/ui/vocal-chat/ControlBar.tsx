import { useState, useRef } from 'react';
import { Mic, Send, Square, Loader2, Phone, PhoneOff, Play, Pause, MicOff, Settings } from 'lucide-react';
import { cn } from '../Button';
import { Button } from '../Button';
import { useVocal } from '../../context/VocalContext';

interface ControlBarProps {
    className?: string;
}

export function ControlBar({ className }: ControlBarProps) {
    const {
        start, stop, pause, mute,
        connected, isMuted, isPaused, volume,
        sendMessage, sendAudio
    } = useVocal();

    const [inputText, setInputText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [loading, setLoading] = useState(false);

    // Additional state to toggle between "Live Mode" and "Chat Mode"
    // If connected, we are in Live Mode. If not, we show Chat Input / Start Live Button.

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const handleSendText = async () => {
        if (!inputText.trim()) return;
        setLoading(true);
        try {
            await sendMessage(inputText);
            setInputText('');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const startRecording = async () => {
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
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    // Live Mode View
    if (connected) {
        return (
            <div className={cn("p-4 md:p-6 pt-2 bg-gradient-to-t from-background via-background to-transparent z-10 w-full max-w-3xl mx-auto", className)}>
                <div className="flex flex-col gap-4 items-center justify-center p-4 bg-muted/20 rounded-2xl border border-dashed animate-in slide-in-from-bottom-4">
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
                                variant="secondary"
                                size="icon"
                                className="rounded-full w-12 h-12"
                                onClick={pause}
                            >
                                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                            </Button>
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
                                onClick={() => stop()}
                            >
                                <PhoneOff className="w-5 h-5" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground animate-pulse">Listening...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Chat / Setup Mode View
    return (
        <div className={cn("p-4 md:p-6 pt-2 bg-gradient-to-t from-background via-background to-transparent z-10 w-full max-w-3xl mx-auto", className)}>
            <div className="flex flex-col gap-2">
                {/* Start Live Button */}
                <div className="flex justify-center mb-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-full gap-2 px-4 shadow-sm bg-background border hover:bg-muted"
                        onClick={() => start()}
                    >
                        <Phone className="w-4 h-4" /> Start Live Voice
                    </Button>
                </div>

                {/* Text/Audio Input */}
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
                        style={{
                            border: 'none',
                            outline: 'none',
                            boxShadow: 'none',
                            background: 'transparent'
                        }}
                        className="flex-1 bg-transparent px-4 py-2.5 text-sm w-full placeholder:text-muted-foreground/70"
                        disabled={loading || isRecording}
                    />

                    <div className="flex items-center gap-1 pr-1">
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
            </div>
            <div className="text-center mt-2">
                <p className="text-[10px] text-muted-foreground/50">
                    AI can update visuals and perform actions.
                </p>
            </div>
        </div>
    );
}
