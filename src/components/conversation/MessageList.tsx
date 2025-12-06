import { useEffect, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { ChatBubble } from './ChatBubble';
import type { ConversationMessage } from '../../lib/conversation-types';
import { Sparkles } from 'lucide-react';

interface MessageListProps {
    messages: ConversationMessage[];
    className?: string;
}

export const MessageList = ({ messages, className = '' }: MessageListProps) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length]);

    if (messages.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center h-full text-center p-6 ${className}`}>
                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="font-medium text-foreground mb-1">No messages yet</h3>
                <p className="text-sm text-muted-foreground max-w-[240px]">
                    Start a session regarding this board to begin.
                </p>
            </div>
        );
    }

    return (
        <ScrollArea className={`h-full w-full pr-4 ${className}`}>
            <div className="flex flex-col gap-6 p-4">
                {messages.map((message) => (
                    <ChatBubble key={message.id} message={message} />
                ))}
                <div ref={bottomRef} className="h-4" />
            </div>
        </ScrollArea>
    );
};
