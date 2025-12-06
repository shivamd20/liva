import { Bot, User } from 'lucide-react';
import type { ConversationMessage } from '../../lib/conversation-types';
import { isAudioMessage, isTextMessage } from '../../lib/conversation-types';
import { AudioPlaybackBar } from './AudioPlaybackBar';

interface ChatBubbleProps {
    message: ConversationMessage;
}

export const ChatBubble = ({ message }: ChatBubbleProps) => {
    const isUser = message.type === 'user';

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground border border-border/50'
                }`}>
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-4 py-3 shadow-sm ${isUser
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-secondary text-secondary-foreground rounded-bl-sm border border-border/50'
                    }`}>
                    {isAudioMessage(message) ? (
                        <div className="space-y-2 min-w-[200px]">
                            <AudioPlaybackBar
                                audioBlob={message.audioBlob}
                                duration={message.duration}
                                variant={isUser ? 'user' : 'assistant'}
                            />
                            {message.transcription && (
                                <p className={`text-sm leading-relaxed ${isUser ? 'text-primary-foreground/90' : 'text-foreground/90'}`}>
                                    {message.transcription}
                                </p>
                            )}
                        </div>
                    ) : isTextMessage(message) ? (
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'text-primary-foreground/90' : 'text-foreground/90'}`}>
                            {message.content}
                        </p>
                    ) : null}
                </div>

                {/* Timestamp */}
                <span className="text-[10px] text-muted-foreground/60 px-1">
                    {formatTime(message.timestamp)}
                </span>
            </div>
        </div>
    );
};
