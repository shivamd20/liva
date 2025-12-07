import { z } from "zod";
import { t } from "../trpc-config";

export const conversationRouter = t.router({
    // Get history
    getHistory: t.procedure
        .input(z.object({
            conversationId: z.string(),
            from: z.string().optional(),
            limit: z.number().min(1).max(100).default(50),
        }))
        .query(async ({ input, ctx }) => {
            const { conversationId, from, limit } = input;
            const id = ctx.env.CONVERSATION_DURABLE_OBJECT.idFromName(conversationId);
            const stub = ctx.env.CONVERSATION_DURABLE_OBJECT.get(id);

            const url = new URL("http://internal/events"); // DO fetch URL, hostname ignored
            if (from) url.searchParams.set("from", from);
            url.searchParams.set("limit", limit.toString());

            const res = await stub.fetch(url.toString(), {
                headers: {
                    "X-Liva-User-Id": ctx.userId
                }
            });
            if (!res.ok) {
                throw new Error("Failed to fetch history");
            }
            return res.json();
        }),

    // Append event (Text/Audio)
    append: t.procedure
        .input(z.object({
            conversationId: z.string(),
            type: z.enum(["text_in", "audio_in", "text_out", "audio_out"]),
            payload: z.string(), // Text or Base64 audio
            metadata: z.record(z.any(), z.any()).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { conversationId, type, payload, metadata } = input;
            const id = ctx.env.CONVERSATION_DURABLE_OBJECT.idFromName(conversationId);
            const stub = ctx.env.CONVERSATION_DURABLE_OBJECT.get(id);

            const res = await stub.fetch("http://internal/append", {
                method: "POST",
                headers: {
                    "X-Liva-User-Id": ctx.userId
                },
                body: JSON.stringify({ type, payload, metadata }),
            });

            if (!res.ok) {
                throw new Error("Failed to append event");
            }
            return res.json();
        }),

    // Trigger summarization
    summarize: t.procedure
        .input(z.object({
            conversationId: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { conversationId } = input;
            const id = ctx.env.CONVERSATION_DURABLE_OBJECT.idFromName(conversationId);
            const stub = ctx.env.CONVERSATION_DURABLE_OBJECT.get(id);

            const res = await stub.fetch("http://internal/summarize", {
                method: "POST",
                headers: {
                    "X-Liva-User-Id": ctx.userId
                },
            });

            if (!res.ok) {
                throw new Error("Failed to summarize");
            }
            return res.json();
        }),

    // Verify DB
    verify: t.procedure
        .input(z.object({
            conversationId: z.string(),
        }))
        .query(async ({ input, ctx }) => {
            const { conversationId } = input;
            const id = ctx.env.CONVERSATION_DURABLE_OBJECT.idFromName(conversationId);
            const stub = ctx.env.CONVERSATION_DURABLE_OBJECT.get(id);

            const res = await stub.fetch("http://internal/debug/verify", {
                headers: {
                    "X-Liva-User-Id": ctx.userId
                }
            });

            if (!res.ok) {
                throw new Error("Failed to verify");
            }
            return res.json();
        }),
});
