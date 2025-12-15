import { useRef, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { cn } from './Button';
import { Button } from './Button';
import { MessageBubble } from './vocal-chat/MessageBubble';
import { ControlBar } from './vocal-chat/ControlBar';
import { useVocal } from '../context/VocalContext';

interface VocalChatProps {
    className?: string;
    minimal?: boolean;
    title?: string;
}

export function VocalChat({ className, minimal, title = "Conversation" }: VocalChatProps) {
    const { events, connected, refreshHistory, isLoading } = useVocal();
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    // Auto-scroll on new events
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [events.length]);

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
                            <h2 className="text-sm font-semibold">{title}</h2>
                            <p className="text-xs text-muted-foreground">
                                {connected ? (
                                    <span className="flex items-center gap-1 text-green-500">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        Voice Active
                                    </span>
                                ) : "Ready"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => refreshHistory()}>
                            <RefreshCw className={cn("w-4 h-4 opacity-70", isLoading && "animate-spin")} />
                        </Button>
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 pb-2 scroll-smooth">
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

                    <div ref={endOfMessagesRef} />
                </div>
            </div>

            {/* Input Area */}
            <ControlBar />
        </div>
    );
}
