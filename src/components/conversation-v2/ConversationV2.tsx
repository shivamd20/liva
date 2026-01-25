
import React, { useEffect, useMemo } from 'react';
import { useChat } from '@tanstack/ai-react';
import { clientTools, createChatClientOptions, fetchServerSentEvents } from '@tanstack/ai-client';
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

const generateVisualizationDef = toolDefinition({
    name: 'generateVisualization',
    description: 'Generate an inline visualization/diagram using Mermaid.js. Call this when you want to show a diagram to the user.',
    inputSchema: {
        type: "object",
        properties: {
            mermaid: { type: "string", description: "Mermaid JS diagram code" },
            title: { type: "string", description: "Title of the visualization" },
        },
        required: ["mermaid"],
    },
    outputSchema: z.object({
        success: z.boolean(),
        mermaid: z.string(),
    }),
});

interface ConversationV2Props {
    conversationId: string;
    className?: string;
    excalidrawAPI: any | null;
}

export function ConversationV2({ conversationId, className, excalidrawAPI }: ConversationV2Props) {
    const [history, setHistory] = React.useState<any[]>([]);
    const [historyLoaded, setHistoryLoaded] = React.useState(false);

    useEffect(() => {
        fetch(`/api/conversation-v2/${conversationId}/history`)
            .then(res => res.json())
            .then(data => {
                setHistory(data);
                setHistoryLoaded(true);
            })
            .catch(err => {
                console.error("Failed to load history", err);
                setHistoryLoaded(true);
            });
    }, [conversationId]);

    const handleClearHistory = async () => {
        if (!confirm("Are you sure you want to clear the chat history?")) return;
        try {
            await fetch(`/api/conversation-v2/${conversationId}/clear`, { method: 'DELETE' });
            window.location.reload(); // Simple reload to reset state for now
        } catch (e) {
            console.error("Failed to clear history", e);
        }
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

    const visualizeTool = useMemo(() => {
        return generateVisualizationDef.client(async (args: unknown) => {
            const { mermaid } = args as { mermaid: string };
            // Just return the mermaid code so it can be rendered by the UI
            return { success: true, mermaid };
        });
    }, []);

    const chatOptions = useMemo(() => {
        const tools = clientTools(readBoardTool, visualizeTool);
        return createChatClientOptions({
            connection: fetchServerSentEvents(`/api/conversation-v2/${conversationId}/chat`, {
                body: JSON.stringify({
                    conversationId // send conversationId in body as backup/primary
                })
            }),
            tools,
        });
    }, [conversationId, readBoardTool, visualizeTool]);

    const { messages, sendMessage, isLoading } = useChat(chatOptions);

    const allMessages = useMemo(() => {
        if (!historyLoaded) return [];
        // Dedup logic: simply append new messages to history?
        // useChat messages start empty.
        // We might want to avoid showing duplicates if useChat somehow re-fetches history (unlikely if we just init it).
        return [...history, ...messages];
    }, [history, messages, historyLoaded]);

    return (
        <div className={`flex flex-col h-full w-full bg-background ${className || ''}`}>
            <header className="px-4 py-2 border-b flex items-center justify-between bg-card/50 backdrop-blur">
                <h2 className="text-sm font-semibold">Discovery Chat</h2>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClearHistory} title="Clear Chat">
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden relative">
                {historyLoaded ? (
                    <ChatTimeline messages={allMessages} isLoading={isLoading} excalidrawAPI={excalidrawAPI} />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading history...</div>
                )}
            </div>

            <div className="p-4 border-t bg-card/50 backdrop-blur">
                <InputBar onSend={sendMessage} isLoading={isLoading} />
            </div>
        </div>
    );
}
