
import React, { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';

interface ChatTimelineProps {
    messages: any[];
    isLoading: boolean;
    excalidrawAPI?: any;
}

export function ChatTimeline({ messages, isLoading, excalidrawAPI }: ChatTimelineProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    return (
        <div
            ref={scrollRef}
            className="h-full overflow-y-auto px-4 py-4 scroll-smooth"
        >
            <div className="flex flex-col gap-6 max-w-3xl mx-auto">
                {messages.length === 0 && (
                    <div className="text-center py-20 text-muted-foreground">
                        <p>Start a new conversation...</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <ChatBubble
                        key={idx}
                        message={msg}
                        excalidrawAPI={excalidrawAPI}
                    />
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-muted/50 rounded-2xl px-4 py-2 text-sm text-muted-foreground animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
