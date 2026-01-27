
import React, { useMemo } from 'react';
import { useChat } from '@tanstack/ai-react';
import { clientTools, createChatClientOptions, fetchServerSentEvents } from '@tanstack/ai-client';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatTimeline } from './ChatTimeline';
import { InputBar } from './InputBar';
import { exportToBlob } from '@excalidraw/excalidraw';
import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Reusing definition logic here for client-side registration
// Plain JSON Schema to match server-side fix
const readBoardDef = toolDefinition({
    name: 'read_board',
    description: 'Get the current visible board state as an image.',
    inputSchema: {
        type: "object",
        properties: {},
    },
    outputSchema: z.object({
        image: z.string().describe("Base64 encoded image of the board"),
    }),
});



interface ConversationV2Props {
    conversationId: string;
    className?: string;
    excalidrawAPI: any | null;
}

export function ConversationV2({ conversationId, className, excalidrawAPI }: ConversationV2Props) {
    const queryClient = useQueryClient();

    // Infinite query for paginated history
    const {
        data: historyData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: historyLoading,
    } = useInfiniteQuery({
        queryKey: ['conversation-history', conversationId],
        queryFn: async ({ pageParam }: { pageParam?: string }) => {
            const url = new URL(`/api/conversation-v2/${conversationId}/history`, window.location.origin);
            if (pageParam) {
                url.searchParams.set('before', pageParam);
            }
            url.searchParams.set('limit', '15');

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error('Failed to fetch history');
            return res.json() as Promise<{ messages: any[]; hasMore: boolean; nextCursor: string | null }>;
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    });

    // Flatten all pages into a single array, ensuring chronological order
    // The most robust approach: flatten all pages and sort by timestamp
    const history = useMemo(() => {
        if (!historyData?.pages || historyData.pages.length === 0) return [];

        // Flatten all pages into a single array
        const allMessages = historyData.pages.flatMap(page => page.messages);

        // Sort by timestamp (most reliable for chronological order)
        // If timestamps are missing, assign fallback timestamps based on page order
        return allMessages
            .map((msg: any, index) => ({
                ...msg,
                // Ensure timestamp exists - use a fallback that maintains relative order
                timestamp: msg.timestamp || (Date.now() - 1000000 + index),
            }))
            .sort((a, b) => {
                const aTime = a.timestamp || 0;
                const bTime = b.timestamp || 0;
                return aTime - bTime; // Ascending = oldest first
            });
    }, [historyData]);

    // Clear history mutation
    const clearHistoryMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/conversation-v2/${conversationId}/clear`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to clear history');
            return res.json();
        },
        onSuccess: () => {
            // Invalidate and reset the query
            queryClient.setQueryData(['conversation-history', conversationId], undefined);
            queryClient.invalidateQueries({ queryKey: ['conversation-history', conversationId] });
            // Reset chat messages
            // We'll need to reset the useChat hook - this will be handled by clearing its state
        },
    });

    const handleClearHistory = async () => {
        if (!confirm("Are you sure you want to clear the chat history?")) return;
        clearHistoryMutation.mutate();
    };

    // Client-side tool implementation
    const readBoardTool = useMemo(() => {
        return readBoardDef.client(async () => {
            if (!excalidrawAPI) {
                return { image: "Board not available" };
            }

            try {
                const elements = excalidrawAPI.getSceneElements();
                const appState = excalidrawAPI.getAppState();
                const blob = await exportToBlob({
                    elements,
                    appState: {
                        ...appState,
                        exportWithDarkMode: false,
                        exportScale: 2, // Increase resolution
                    },
                    files: excalidrawAPI.getFiles(),
                    mimeType: "image/png",
                    quality: 0.8, // Better quality
                });

                // Convert Blob to Base64
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve({ image: reader.result as string });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error: any) {
                console.error("Failed to export board", error);
                return { image: "Error exporting board: " + error.message };
            }
        });
    }, [excalidrawAPI]);

    const chatOptions = useMemo(() => {
        const tools = clientTools(readBoardTool);
        return createChatClientOptions({
            connection: fetchServerSentEvents(`/api/conversation-v2/${conversationId}/chat`, {
                body: {
                    conversationId // send conversationId in body as backup/primary
                }
            }),
            tools,
        });
    }, [conversationId, readBoardTool]);

    const { messages, sendMessage, isLoading, setMessages, clear } = useChat(chatOptions);

    // Combine history and new messages, avoiding duplicates and ensuring chronological order
    const allMessages = useMemo(() => {
        if (historyLoading) return [];

        // Create a map of message IDs to avoid duplicates
        // Use a more robust key: id if available, otherwise content+role+timestamp
        const messageMap = new Map<string, any>();
        const seenKeys = new Set<string>();

        // Helper to generate a unique key for a message
        const getMessageKey = (msg: any): string => {
            if (msg.id) return msg.id;
            // Fallback: use content + role + timestamp for uniqueness
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
            return `${msg.role || 'unknown'}-${content}-${msg.timestamp || Date.now()}`;
        };

        // Add history messages first (they're already sorted chronologically)
        history.forEach((msg, index) => {
            const key = getMessageKey(msg);
            if (!seenKeys.has(key)) {
                messageMap.set(key, {
                    ...msg,
                    _source: 'history',
                    _order: index, // Track order for stable sorting
                });
                seenKeys.add(key);
            }
        });

        // Add new messages from useChat (they should be newer)
        // Assign timestamps if missing, using current time + small offset to ensure they're after history
        const baseTime = Date.now();
        messages.forEach((msg: any, index) => {
            const key = getMessageKey(msg);
            if (!seenKeys.has(key)) {
                // Ensure new messages have timestamps
                // useChat messages might not have timestamp, so we add one
                const timestamp = (msg as any).timestamp || baseTime + index;
                messageMap.set(key, {
                    ...msg,
                    timestamp,
                    _source: 'new',
                    _order: history.length + index, // Track order for stable sorting
                });
                seenKeys.add(key);
            }
        });

        // Convert to array and sort robustly
        return Array.from(messageMap.values()).sort((a, b) => {
            // Primary sort: by timestamp (most reliable)
            const aTime = a.timestamp || 0;
            const bTime = b.timestamp || 0;
            if (aTime !== bTime) {
                return aTime - bTime;
            }

            // Secondary sort: by source (history before new, to maintain order)
            if (a._source !== b._source) {
                if (a._source === 'history') return -1;
                if (b._source === 'history') return 1;
            }

            // Tertiary sort: by order index (maintains relative order within same timestamp)
            const aOrder = a._order ?? 0;
            const bOrder = b._order ?? 0;
            return aOrder - bOrder;
        });
    }, [history, messages, historyLoading]);

    // Reset chat when history is cleared
    React.useEffect(() => {
        if (clearHistoryMutation.isSuccess) {
            clear?.(); // Use clear method if available, otherwise fallback to setMessages
            if (!clear) setMessages([]);
            clearHistoryMutation.reset();
        }
    }, [clearHistoryMutation.isSuccess, setMessages, clearHistoryMutation, clear]);

    return (
        <div className={`flex flex-col h-full w-full bg-background ${className || ''}`}>
            <header className="px-4 py-2 border-b flex items-center justify-between bg-card/50 backdrop-blur">
                <h2 className="text-sm font-semibold">Discovery Chat</h2>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleClearHistory}
                        title="Clear Chat"
                        disabled={clearHistoryMutation.isPending}
                    >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden relative">
                {historyLoading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading history...</div>
                ) : (
                    <ChatTimeline
                        messages={allMessages}
                        isLoading={isLoading}
                        excalidrawAPI={excalidrawAPI}
                        onLoadMore={hasNextPage ? () => fetchNextPage() : undefined}
                        isLoadingMore={isFetchingNextPage}
                    />
                )}
            </div>

            <div className="p-4 border-t bg-card/50 backdrop-blur">
                <InputBar onSend={sendMessage} isLoading={isLoading} />
            </div>
        </div>
    );
}
