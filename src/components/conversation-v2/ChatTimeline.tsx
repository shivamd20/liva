
import React, { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { ChevronUp, Loader2 } from 'lucide-react';

interface ChatTimelineProps {
    messages: any[];
    isLoading: boolean;
    excalidrawAPI?: any;
    onLoadMore?: () => void;
    isLoadingMore?: boolean;
}

export function ChatTimeline({ messages, isLoading, excalidrawAPI, onLoadMore, isLoadingMore }: ChatTimelineProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const previousScrollHeight = useRef<number>(0);
    const shouldScrollToBottom = useRef<boolean>(true);

    // Scroll to bottom on new messages (but preserve scroll position when loading more)
    useEffect(() => {
        if (scrollRef.current && shouldScrollToBottom.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Handle scroll position preservation when loading more
    useEffect(() => {
        if (scrollRef.current && !shouldScrollToBottom.current && previousScrollHeight.current > 0) {
            const newScrollHeight = scrollRef.current.scrollHeight;
            const scrollDiff = newScrollHeight - previousScrollHeight.current;
            scrollRef.current.scrollTop += scrollDiff;
            shouldScrollToBottom.current = true;
        }

        console.log({ messages })
    }, [messages]);

    const handleLoadMore = () => {
        if (!onLoadMore || isLoadingMore) return;

        if (scrollRef.current) {
            previousScrollHeight.current = scrollRef.current.scrollHeight;
            shouldScrollToBottom.current = false;
        }

        onLoadMore();
    };

    return (
        <div
            ref={scrollRef}
            className="h-full overflow-y-auto px-4 py-4 scroll-smooth"
        >
            <div className="flex flex-col gap-6 max-w-3xl mx-auto">
                {onLoadMore && (
                    <div className="flex justify-center pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleLoadMore}
                            disabled={isLoadingMore}
                            className="gap-2"
                        >
                            {isLoadingMore ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <ChevronUp className="w-4 h-4" />
                                    Load More
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {messages.length === 0 && !isLoading && (
                    <div className="text-center py-20 text-muted-foreground">
                        <p>Start a new conversation...</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <ChatBubble
                        key={msg.id || idx}
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
