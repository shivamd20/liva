
import React from 'react';
import { cn } from '@/lib/utils';
// import Markdown from 'react-markdown'; // Optional: Add if markdown validation passes

interface ChatBubbleProps {
    message: {
        role: 'user' | 'assistant' | 'tool';
        content?: string;
        parts?: any[];
        toolCallId?: string;
    };
}

export function ChatBubble({ message }: ChatBubbleProps) {
    const isUser = message.role === 'user';
    const isTool = message.role === 'tool';

    // Parse tool content if applicable
    let toolImage: string | null = null;
    let textContent = message.content ||
        message.parts?.filter(p => p.type === 'text').map(p => p.content).join('') || '';

    // Handle standalone tool messages
    if (isTool && message.content) {
        try {
            const parsed = JSON.parse(message.content);
            if (parsed.image && typeof parsed.image === 'string') {
                toolImage = parsed.image;
                textContent = ""; // Hide raw JSON if we have an image
            }
        } catch (e) {
            // Not JSON, keep text content
        }
    }

    // Also check parts for tool-result (handle both structures just in case)
    if (!toolImage) {
        const resultPart = message.parts?.find(p => p.type === 'tool-result' && p.result?.image);
        if (resultPart) {
            toolImage = resultPart.result.image;
        }
    }

    if (isTool && !toolImage && !textContent) return null; // Skip empty tool messages

    return (
        <div className={cn(
            "flex w-full",
            isUser ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm",
                isUser
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : isTool
                        ? "bg-transparent border-none shadow-none p-0 max-w-full w-full"
                        : "bg-white border border-border text-foreground rounded-tl-sm dark:bg-muted/40"
            )}>
                {/* Render Text if any */}
                {textContent && (
                    <div className={cn(
                        "whitespace-pre-wrap",
                        isTool ? "font-mono text-xs text-muted-foreground bg-muted p-2 rounded" : ""
                    )}>{textContent}</div>
                )}

                {/* Render Tool Image - Robust check */}
                {toolImage && (
                    <div className="mt-2 block w-full rounded-lg overflow-hidden border border-border bg-white shadow-sm">
                        <img
                            src={toolImage}
                            alt="Board Snapshot"
                            className="w-full h-auto block"
                            style={{ minHeight: '100px', objectFit: 'contain' }}
                            onError={(e) => {
                                console.error("Failed to load tool image");
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<div class="p-4 text-xs text-red-500">Failed to load image</div>');
                            }}
                        />
                        <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 border-t flex items-center gap-2">
                            <span>📷 Shared Board View</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
