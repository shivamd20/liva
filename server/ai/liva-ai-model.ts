import { chat } from '@tanstack/ai';
import { geminiText } from '@tanstack/ai-gemini';
import type { AnyTextAdapter } from '@tanstack/ai';
import type { z } from 'zod';

export type Provider = 'gemini';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

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
        const systemPrompt = `You are Liva, an intelligent assistant.
CORE RULES:
- Be concise and helpful.
- When asked to visualize, use the generateVisualization tool.
- You have access to a whiteboard.`;

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
}
