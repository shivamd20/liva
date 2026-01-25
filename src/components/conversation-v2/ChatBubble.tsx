
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

            <pre>

                {/* {JSON.stringify(message, null, 2)} */}

            </pre>

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

                {/* Render Tool Images from Parts */}
                {message.parts?.map((part, idx) => {
                    let partImage: string | null = null;

                    // Case 1: Tool Call with direct output (Client Tool)
                    if (part.type === 'tool-call' && part.output && (part.output as any).image) {
                        partImage = (part.output as any).image;
                    }

                    // Case 2: Tool Result (Server or Client Tool Result)
                    if (part.type === 'tool-result') {
                        // Check explicit result obj
                        if (part.result && (part.result as any).image) {
                            partImage = (part.result as any).image;
                        }
                        // Or parse content string
                        else if (typeof part.content === 'string') {
                            try {
                                const parsed = JSON.parse(part.content);
                                if (parsed.image) partImage = parsed.image;
                            } catch (e) { }
                        }
                    }

                    if (partImage) {
                        return (
                            <div key={idx} className="mt-2 block w-full rounded-lg overflow-hidden border border-border bg-white shadow-sm">
                                <img
                                    src={partImage}
                                    alt="Board Snapshot"
                                    className="w-full h-auto block"
                                    style={{ minHeight: '100px', maxHeight: '400px', objectFit: 'contain' }}
                                />
                                <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 border-t flex items-center gap-2">
                                    <span>📷 Shared Board View</span>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })}

                {/* Fallback for standalone tool message content (legacy/simple) */}
                {!message.parts?.length && toolImage && (
                    <div className="mt-2 block w-full rounded-lg overflow-hidden border border-border bg-white shadow-sm">
                        <img
                            src={toolImage}
                            alt="Board Snapshot"
                            className="w-full h-auto block"
                            style={{ minHeight: '100px', objectFit: 'contain' }}
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
