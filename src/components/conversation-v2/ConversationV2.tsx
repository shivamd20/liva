
import { useRef, useMemo } from 'react';
import { useChat } from '@tanstack/ai-react';
import { clientTools, createChatClientOptions, fetchServerSentEvents } from '@tanstack/ai-client';
import { ChatTimeline } from './ChatTimeline';
import { InputBar } from './InputBar';
import { exportToBlob } from '@excalidraw/excalidraw';
import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

// Reusing definition logic here for client-side registration
const readBoardDef = toolDefinition({
    name: 'read_board',
    description: 'Get the current visible board state as an image.',
    inputSchema: z.object({}),
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
                body: JSON.stringify({
                    conversationId // send conversationId in body as backup/primary
                })
            }),
            tools,
        });
    }, [conversationId, readBoardTool]);

    const { messages, sendMessage, isLoading } = useChat(chatOptions);

    return (
        <div className={`flex flex-col h-full w-full bg-background ${className || ''}`}>
            <header className="px-4 py-2 border-b flex items-center justify-between bg-card/50 backdrop-blur">
                <h2 className="text-sm font-semibold">Discovery Chat</h2>
                <div className="text-xs text-muted-foreground">V2 (TanStack AI)</div>
            </header>

            <div className="flex-1 overflow-hidden relative">
                <ChatTimeline messages={messages} isLoading={isLoading} />
            </div>

            <div className="p-4 border-t bg-card/50 backdrop-blur">
                <InputBar onSend={sendMessage} isLoading={isLoading} />
            </div>
        </div>
    );
}
