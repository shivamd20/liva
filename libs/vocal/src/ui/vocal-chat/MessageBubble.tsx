import { useState } from 'react';
import { Sparkles, MessageSquareText } from 'lucide-react';
import { cn } from '../Button';
import { AudioPlayer } from './AudioPlayer';
import { VocalEvent } from '../../core/types';

interface MessageBubbleProps {
    event: VocalEvent;
}

export function MessageBubble({ event }: MessageBubbleProps) {
    const isUser = event.type === 'text_in' || event.type === 'audio_in';
    const isAudio = event.type.includes('audio');
    const isSystem = event.type === 'system';
    const [showTranscript, setShowTranscript] = useState(false);

    // Helper to format timestamp
    const timeString = new Date(event.metadata?.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isSystem) {
        return (
            <div className="flex justify-center my-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-primary/5 border border-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-medium flex items-center gap-2 shadow-sm">
                    <Sparkles className="w-3 h-3" />
                    {event.payload}
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
                    <div className="flex flex-col gap-1 items-start">
                        {/* Audio Player */}
                        <AudioPlayer src={event.payload} isUser={isUser} />

                        {/* Transcript Toggle (if available) */}
                        {event.metadata?.transcript && (
                            <div className="flex flex-col items-start w-full">
                                <button
                                    onClick={() => setShowTranscript(!showTranscript)}
                                    className={cn(
                                        "text-[10px] flex items-center gap-1.5 mt-2 px-2 py-1 rounded-full transition-all border select-none",
                                        isUser
                                            ? "bg-white/10 text-white/90 hover:bg-white/20 border-white/20"
                                            : "bg-black/5 text-muted-foreground hover:bg-black/10 border-black/5 dark:bg-white/5 dark:border-white/5"
                                    )}
                                >
                                    <MessageSquareText className="w-3 h-3" />
                                    {showTranscript ? "Hide" : "Transcript"}
                                </button>
                                {showTranscript && (
                                    <div className={cn(
                                        "text-xs mt-2 p-2 rounded-md w-full text-left animate-in fade-in slide-in-from-top-1",
                                        isUser
                                            ? "bg-black/20 text-white/90"
                                            : "bg-black/5 dark:bg-white/5 text-foreground/90"
                                    )}>
                                        {event.metadata.transcript}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <span className={cn(
                    "text-[9px] opacity-0 group-hover:opacity-60 transition-opacity absolute bottom-1",
                    isUser ? "right-full mr-2 text-foreground" : "left-full ml-2 text-muted-foreground"
                )}>
                    {timeString}
                </span>
            </div>
        </div>
    );
}
