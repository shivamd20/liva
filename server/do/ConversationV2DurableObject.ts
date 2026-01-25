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
        } else if (url.pathname.endsWith("/clear") && request.method === "DELETE") {
            return this.handleClearHistory(request);
        }

        return new Response("Not Found", { status: 404 });
    }

    private async handleChat(request: Request): Promise<Response> {
        const requestId = crypto.randomUUID().slice(0, 8);
        console.log(`[ConversationV2] [${requestId}] handleChat called`);
        try {
            const body = await request.json() as any;
            const incomingMessages = (body.messages || []) as any[];
            // We assume conversationId passed from client is the boardId
            const boardId = request.headers.get("X-Conversation-Id") || body.conversationId || body.boardId;

            // 1. Identify and Persist New Messages
            // deduplication logic: 
            let persistedCount = 0;

            for (const msg of incomingMessages) {
                // Check by ID if present
                if (msg.id && await this.eventExists(msg.id)) {
                    continue;
                }

                // Check by Content
                if (msg.role === 'user' && typeof msg.content === 'string') {
                    const exists = await this.eventExistsByContent('text_in', msg.content);
                    if (exists) continue;

                    const msgId = msg.id || crypto.randomUUID();
                    this.persistEvent('text_in', msg.content, {}, msgId);
                    persistedCount++;

                } else if (msg.role === 'tool') {
                    const exists = await this.eventExistsByContent('tool_result', msg.content);
                    if (exists) continue;

                    const msgId = msg.id || crypto.randomUUID();
                    this.persistEvent('tool_result', msg.content, {
                        toolCallId: msg.toolCallId,
                        toolName: msg.name
                    }, msgId);
                    persistedCount++;
                }
            }

            // 2. Load History for Context
            const historyResponse = await this.getHistory(new Request("http://internal/history"));
            const historyMessages = await historyResponse.json() as any[];

            // Guard: If we didn't persist anything new, and the last message in history is from Assistant,
            // we assume this is a duplicate/redundant request and should not trigger a new generation.
            // (If the last message is from User/Tool, we proceeded to generate response for it - Recovery scenario).
            const lastHistoryMsg = historyMessages[historyMessages.length - 1];
            if (persistedCount === 0 && incomingMessages.length > 0) {
                if (lastHistoryMsg && lastHistoryMsg.role === 'assistant') {
                    console.log(`[ConversationV2] [${requestId}] Skipping generation: No new messages and last history was assistant.`);
                    // Return empty stream to close connection gracefully
                    return new Response(toServerSentEventsStream((async function* () { })()), {
                        headers: {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                        },
                    });
                }
            }

            // --- Context Injection ---
            let systemContext = `Current Time: ${new Date().toLocaleString()}\n`;
            if (boardId) {
                try {
                    // @ts-ignore
                    let doId = boardId.length === 64 ? this.env.NOTE_DURABLE_OBJECT.idFromString(boardId) : this.env.NOTE_DURABLE_OBJECT.idFromName(boardId);
                    // @ts-ignore
                    const note = await this.env.NOTE_DURABLE_OBJECT.get(doId).getNote();
                    if (note) systemContext += `Current Board Title: "${note.title || 'Untitled'}"\nBoard ID: ${boardId}\n`;
                } catch (e) { }
            }

            const messagesWithContext = [
                { role: 'system', content: systemContext },
                ...historyMessages
            ];

            // --- Multimodal Transformation ---
            const processedMessages = messagesWithContext.map((msg: any) => {
                if (msg.role === 'tool' && typeof msg.content === 'string') {
                    try {
                        if (msg.content.includes('"image":')) {
                            const parsed = JSON.parse(msg.content);
                            if (parsed.image?.startsWith('data:')) {
                                const match = parsed.image.match(/^data:(.+);base64,(.+)$/);
                                if (match) {
                                    return {
                                        ...msg,
                                        content: [
                                            { type: 'text', content: 'Board snapshot captured:' },
                                            { type: 'image', source: { type: 'data', value: match[2] }, metadata: { mimeType: match[1] } }
                                        ]
                                    };
                                }
                            }
                        }
                    } catch (e) { }
                }
                return msg;
            });

            // --- Tools Setup ---
            // @ts-ignore
            const tools = boardId ? createTools(this.env, boardId, this.persistVisualization.bind(this)) : [];

            // Stream Response
            // @ts-ignore
            const stream = await this.aiModel.streamChat(processedMessages, tools);

            const persistEvent = this.persistEvent.bind(this);

            // Wrapper to persist assistant response
            const streamWithPersistence = async function* () {
                let accumulatedText = "";
                let accumulatedToolCalls: any[] = [];

                try {
                    // @ts-ignore
                    for await (const chunk of stream) {
                        yield chunk;

                        if (chunk.type === 'content') {
                            const contentChunk = chunk as { content?: string; delta?: string };
                            if (contentChunk.delta) accumulatedText += contentChunk.delta;
                            else if (contentChunk.content) accumulatedText = contentChunk.content;
                        } else if (chunk.type === 'tool_call') {
                            const toolChunk = chunk as any;
                            if (toolChunk.toolCall) {
                                accumulatedToolCalls.push(toolChunk.toolCall);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`[ConversationV2] Error in stream`, e);
                    throw e;
                }

                if (accumulatedText || accumulatedToolCalls.length > 0) {
                    const assistantMsgId = crypto.randomUUID();
                    if (accumulatedToolCalls.length > 0) {
                        persistEvent('assistant_message', accumulatedText, { toolCalls: accumulatedToolCalls }, assistantMsgId);
                    } else {
                        persistEvent('text_out', accumulatedText, {}, assistantMsgId);
                    }
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

    private async eventExists(id: string): Promise<boolean> {
        const results = this.sql.exec("SELECT 1 FROM conversation_events WHERE id = ?", id).toArray();
        return results.length > 0;
    }

    private async eventExistsByContent(type: string, payload: string): Promise<boolean> {
        const results = this.sql.exec("SELECT 1 FROM conversation_events WHERE type = ? AND payload = ?", type, payload).toArray();
        return results.length > 0;
    }

    private persistEvent(type: string, payload: string, metadata: any = {}, id?: string) {
        const eventId = id || crypto.randomUUID();
        const timestamp = Date.now();
        try {
            this.sql.exec(`
                INSERT OR IGNORE INTO conversation_events (id, timestamp, type, payload, metadata)
                VALUES (?, ?, ?, ?, ?)
            `, eventId, timestamp, type, payload, JSON.stringify(metadata));
        } catch (e) {
            console.error("Failed to persist event", e);
        }
    }

    private async persistVisualization(mermaid: string, title?: string): Promise<{ id: string }> {
        const id = crypto.randomUUID();
        const timestamp = Date.now();
        this.sql.exec(`
            INSERT INTO visualizations (id, conversation_id, mermaid, title, created_at)
            VALUES (?, ?, ?, ?, ?)
        `, id, "current", mermaid, title || null, timestamp);

        // Also persist as an event so it shows in history
        this.persistEvent('tool_result', `Generated Visualization: ${title || 'Untitled'}`, { visualizationId: id, mermaid }, id);

        return { id };
    }

    private async getHistory(request: Request): Promise<Response> {
        const events = this.sql.exec("SELECT * FROM conversation_events ORDER BY timestamp ASC").toArray();
        const messages = events.map((e: any) => {
            const metadata = JSON.parse(e.metadata);

            // Map our internal event types to Vercel/TanStack AI message format
            let role = 'user';
            if (e.type === 'text_out' || e.type === 'assistant_message') role = 'assistant';
            if (e.type === 'tool_result') role = 'tool';

            // Reconstruct tool-specific fields if needed
            return {
                id: e.id,
                role,
                content: e.payload,
                // Add specific fields if role is 'tool'
                ...(role === 'tool' ? {
                    toolCallId: metadata.toolCallId || 'unknown',
                    name: metadata.toolName || 'unknown'
                } : {}),
                // Add tool calls if assistant message
                ...(role === 'assistant' && metadata.toolCalls ? {
                    toolCalls: metadata.toolCalls
                } : {})
            };
        });
        return Response.json(messages);
    }

    private async handleClearHistory(request: Request): Promise<Response> {
        this.sql.exec("DELETE FROM conversation_events");
        this.sql.exec("DELETE FROM visualizations");
        // Also clear any other state if needed
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    private async handleTranscription(request: Request) {
        return new Response("Not implemented yet");
    }
}
