import { DurableObject } from "cloudflare:workers";
import { LivaAIModel } from "../ai/liva-ai-model";
import { toServerSentEventsStream } from "@tanstack/ai";
import { createTools } from "./chat-tools";

interface Event {
    id: string;
    timestamp: number;
    type: "text_in" | "text_out" | "audio_in" | "audio_out" | "video_frame" | "summary" | "tool_result";
    payload: string; // Base64 or text
    metadata: string; // JSON string
}

export class ConversationV2DurableObject extends DurableObject {
    private sql: SqlStorage;
    private aiModel: LivaAIModel;
    env: Env;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.env = env;
        this.sql = ctx.storage.sql;
        // @ts-ignore
        this.aiModel = new LivaAIModel(env);
        this.initializeTables();
    }

    private initializeTables() {
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS conversation_events (
                id TEXT PRIMARY KEY,
                timestamp INTEGER,
                type TEXT,
                payload BLOB,
                metadata TEXT
            );
            CREATE TABLE IF NOT EXISTS conversation_state (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS visualizations (
                id TEXT PRIMARY KEY,
                conversation_id TEXT,
                mermaid TEXT,
                title TEXT,
                created_at INTEGER
            );
        `);
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        // Security check placeholder
        const userId = request.headers.get("X-Liva-User-Id");

        if (url.pathname.endsWith("/chat")) {
            return this.handleChat(request);
        } else if (url.pathname.endsWith("/history")) {
            return this.getHistory(request);
        } else if (url.pathname.endsWith("/transcribe")) {
            return this.handleTranscription(request);
        }

        return new Response("Not Found", { status: 404 });
    }

    private async handleChat(request: Request): Promise<Response> {
        const requestId = crypto.randomUUID().slice(0, 8);
        console.log(`[ConversationV2] [${requestId}] handleChat called`);
        try {
            const body = await request.json() as any;
            const messages = body.messages || [];
            // We assume conversationId passed from client is the boardId
            const boardId = request.headers.get("X-Conversation-Id") || body.conversationId || body.boardId;

            // Persist User Message
            const lastUserMessage = messages[messages.length - 1];
            if (lastUserMessage && lastUserMessage.role === 'user') {
                this.persistEvent('text_in', lastUserMessage.content);
            }

            // --- Context Injection ---
            let systemContext = `Current Time: ${new Date().toLocaleString()}\n`;
            if (boardId) {
                try {
                    // Quick fetch of board title for context
                    // Re-using logic from tools, but simplified
                    let doId: DurableObjectId;
                    // @ts-ignore
                    if (boardId.length === 64 && /^[0-9a-f]{64}$/.test(boardId)) {
                        try {
                            // @ts-ignore
                            doId = this.env.NOTE_DURABLE_OBJECT.idFromString(boardId);
                        } catch {
                            // @ts-ignore
                            doId = this.env.NOTE_DURABLE_OBJECT.idFromName(boardId);
                        }
                    } else {
                        // @ts-ignore
                        doId = this.env.NOTE_DURABLE_OBJECT.idFromName(boardId);
                    }
                    // @ts-ignore
                    const stub = this.env.NOTE_DURABLE_OBJECT.get(doId);
                    const note = await stub.getNote();
                    if (note) {
                        systemContext += `Current Board Title: "${note.title || 'Untitled'}"\nBoard ID: ${boardId}\n`;
                    }
                } catch (e) {
                    console.warn(`[ConversationV2] Failed to fetch context`, e);
                }
            }

            // Prepend context to last user message or system prompt? 
            // Better to prepend to the list of messages processed by streamChat as a system message
            // But LivaAIModel handles system prompt. 
            // We'll pass it as a "system" message at the start.
            const messagesWithContext = [
                { role: 'system', content: systemContext },
                ...messages
            ];

            // --- Multimodal Transformation ---
            // Scan messages for tool results that contain images (from client tools)
            // and convert them to proper multimodal content parts for the AI adapter.
            const processedMessages = messagesWithContext.map((msg: any) => {
                if (msg.role === 'tool' && typeof msg.content === 'string') {
                    try {
                        // Check if this is a read_board result
                        // (We could check toolCallId if we had access to tool calls, but simple JSON check is robust enough for now)
                        if (msg.content.includes('"image":')) {
                            const parsed = JSON.parse(msg.content);
                            if (parsed.image && typeof parsed.image === 'string' && parsed.image.startsWith('data:')) {
                                const match = parsed.image.match(/^data:(.+);base64,(.+)$/);
                                if (match) {
                                    const mimeType = match[1];
                                    const base64Data = match[2];

                                    return {
                                        ...msg,
                                        content: [
                                            { type: 'text', content: 'Board snapshot captured:' },
                                            {
                                                type: 'image',
                                                source: {
                                                    type: 'data',
                                                    value: base64Data
                                                },
                                                metadata: {
                                                    mimeType: mimeType
                                                }
                                            }
                                        ]
                                    };
                                }
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors, keep original message
                    }
                }
                return msg;
            });

            // --- Tools Setup ---
            // @ts-ignore
            const tools = boardId ? createTools(this.env, boardId, this.persistVisualization.bind(this)) : [];

            // Stream Response
            console.log(`[ConversationV2] [${requestId}] Calling aiModel.streamChat with tools`);

            // @ts-ignore
            const stream = await this.aiModel.streamChat(processedMessages, tools);

            // Capture 'this' context for persistence
            const persistEvent = this.persistEvent.bind(this);

            // Wrapper to persist assistant response
            const streamWithPersistence = async function* () {
                let accumulatedText = "";

                try {
                    // @ts-ignore
                    for await (const chunk of stream) {
                        // console.log(`[ConversationV2] [${requestId}] Chunk received:`, JSON.stringify(chunk));
                        yield chunk;

                        if (chunk.type === 'content') {
                            const contentChunk = chunk as { content?: string; delta?: string };
                            if (contentChunk.delta) {
                                accumulatedText += contentChunk.delta;
                            } else if (contentChunk.content && !contentChunk.delta) {
                                accumulatedText = contentChunk.content;
                            }
                        }
                    }
                } catch (e) {
                    console.error(`[ConversationV2] [${requestId}] Error inside generator:`, e);
                    throw e;
                }

                if (accumulatedText) {
                    persistEvent('text_out', accumulatedText);
                }
            };

            return new Response(toServerSentEventsStream(streamWithPersistence()), {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });

        } catch (error: any) {
            console.error(`[ConversationV2] [${requestId}] Chat Error:`, error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    private persistEvent(type: string, payload: string, metadata: any = {}) {
        const id = crypto.randomUUID();
        const timestamp = Date.now();
        this.sql.exec(`
            INSERT INTO conversation_events (id, timestamp, type, payload, metadata)
            VALUES (?, ?, ?, ?, ?)
        `, id, timestamp, type, payload, JSON.stringify(metadata));
    }

    private async persistVisualization(mermaid: string, title?: string): Promise<{ id: string }> {
        const id = crypto.randomUUID();
        const timestamp = Date.now();
        this.sql.exec(`
            INSERT INTO visualizations (id, conversation_id, mermaid, title, created_at)
            VALUES (?, ?, ?, ?, ?)
        `, id, "current", mermaid, title || null, timestamp);

        // Also persist as an event so it shows in history
        this.persistEvent('tool_result', `Generated Visualization: ${title || 'Untitled'}`, { visualizationId: id, mermaid });

        return { id };
    }

    private async getHistory(request: Request): Promise<Response> {
        const events = this.sql.exec("SELECT * FROM conversation_events ORDER BY timestamp ASC").toArray();
        return Response.json(events.map((e: any) => ({
            ...e,
            metadata: JSON.parse(e.metadata)
        })));
    }

    private async handleTranscription(request: Request) {
        return new Response("Not implemented yet");
    }
}
