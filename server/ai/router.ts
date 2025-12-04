import { router, publicProcedure } from "../trpc-config";
import { z } from "zod";
import { AITransformQuerySchema } from "./schemas";
import { runAI } from "./workers-adapter";

export const aiRouter = router({
    transformWithAI: publicProcedure
        .input(AITransformQuerySchema)
        .mutation(async ({ input, ctx }) => {
            return await runAI(ctx.env, input);
        }),

    listModels: publicProcedure
        .query(async () => {
            return [
                { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", capabilities: ["fast", "multimodal", "tools"] },
                { id: "gemini-2.0-pro-exp-02-05", name: "Gemini 2.0 Pro Exp", capabilities: ["smart", "reasoning", "tools"] },
            ];
        }),

    validateTransform: publicProcedure
        .input(AITransformQuerySchema)
        .query(async ({ input }) => {
            const issues: string[] = [];

            if (input.query.length < 3) {
                issues.push("Query too short");
            }

            if (input.elements.length > 1000) {
                issues.push("Too many elements (max 1000)");
            }

            return {
                valid: issues.length === 0,
                issues,
            };
        }),
});
