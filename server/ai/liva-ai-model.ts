import { chat } from '@tanstack/ai';
import { geminiText } from '@tanstack/ai-gemini';
import type { AnyTextAdapter } from '@tanstack/ai';
import type { z } from 'zod';
import { SYSTEM_PROMPT_STUDY } from './systemPrompt';

export type Provider = 'gemini';

export const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

export class LivaAIModel {
    private geminiApiKeyPromise: Promise<string> | null = null;
    private defaultProvider: Provider = 'gemini';

    constructor(private env: Env) {
        // Initialize Gemini API key if available
        // @ts-ignore
        const geminiKey = env.GEMINI_API_KEY;
        if (geminiKey) {
            if (typeof geminiKey === 'string') {
                // @ts-ignore
                this.geminiApiKeyPromise = Promise.resolve(geminiKey);
            } else {
                // @ts-ignore
                this.geminiApiKeyPromise = geminiKey.get();
            }
        }
    }

    async getAdapter(modelId?: string, provider?: Provider): Promise<AnyTextAdapter> {
        if (!this.geminiApiKeyPromise) {
            throw new Error('GEMINI_API_KEY is not configured');
        }
        const apiKey = await this.geminiApiKeyPromise;
        // Basic mapping for now, assuming standard naming
        const model = modelId || DEFAULT_GEMINI_MODEL;
        // @ts-ignore - type mismatch in library often happens here
        return geminiText(model, { apiKey }) as AnyTextAdapter;
    }

    async streamChat(messages: Array<{ role: string; content: string }>, tools?: Array<unknown>, modelId?: string, provider?: Provider) {
        console.log(`[LivaAIModel] streamChat called. Model: ${modelId}, Provider: ${provider || 'default'}`);
        const adapter = await this.getAdapter(modelId, provider);

        // Convert messages format if needed (TanStack format is fairly standard now)
        const tanstackMessages = messages
            .map((msg) => {
                if (msg.role === 'system') return null; // handled separately ideally, or filtered
                return {
                    role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
                    content: msg.content || '',
                };
            })
            .filter((msg): msg is { role: 'user' | 'assistant'; content: string } => msg !== null);

        // System prompt injection logic (if needed globally)
        const systemPrompt = `
        ${SYSTEM_PROMPT_STUDY}
        
        Feel free to use the provided tools whenever you feel appropriate
        `;

        // Prepend system prompt
        const messagesWithSystem = [
            { role: 'user' as const, content: systemPrompt },
            ...tanstackMessages
        ];

        console.log(`[LivaAIModel] Calling chat() with ${messagesWithSystem.length} messages`);

        return chat({
            adapter,
            messages: messagesWithSystem,
            // @ts-ignore
            tools: tools || [],
        });
    }

    /**
     * Voice session: stream with optional tools and custom system prompt.
     * Messages can include role 'tool' (content + toolCallId), assistant with toolCalls,
     * and user messages with multimodal content (content as array with image parts) for Gemini vision.
     */
    async streamChatVoice(
        messages: Array<{
            role: string;
            content: string | Array<{ type: "text"; content: string } | { type: "image"; source: { type: "data"; value: string }; metadata?: { mimeType?: string } }>;
            toolCallId?: string;
            toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
        }>,
        opts: { tools?: Array<unknown>; systemPrompt?: string } = {}
    ) {
        const { tools = [], systemPrompt: customSystemPrompt } = opts;
        const adapter = await this.getAdapter();
        const systemPrompt = customSystemPrompt ?? `You are Liva, a creative whiteboard collaborator. Keep responses to 2-3 short spoken sentences. Use contractions. Never use markdown or formatting. When you see a board image, describe specific elements you notice.`;
        const tanstackMessages = messages
            .filter((m) => m.role !== "system")
            .map((m) => {
                if (m.role === "tool" && m.toolCallId != null) {
                    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
                    return { role: "tool" as const, content, toolCallId: m.toolCallId };
                }
                if (m.role === "assistant" && m.toolCalls?.length) {
                    const content = typeof m.content === "string" ? m.content : "";
                    return {
                        role: "assistant" as const,
                        content,
                        toolCalls: m.toolCalls.map((tc) => ({
                            id: tc.id ?? tc.name ?? "",
                            type: "function" as const,
                            function: {
                                name: tc.name ?? "unknown",
                                arguments: tc.arguments ?? "{}",
                            },
                        })),
                    };
                }
                if (m.role === "user" && Array.isArray(m.content)) {
                    return { role: "user" as const, content: m.content };
                }
                const content = typeof m.content === "string" ? m.content : "";
                return {
                    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
                    content,
                };
            });
        const messagesWithSystem = [
            { role: "user" as const, content: systemPrompt },
            ...tanstackMessages,
        ];
        // @ts-ignore
        return chat({
            adapter,
            messages: messagesWithSystem,
            tools: tools.length ? tools : undefined,
        });
    }
}
