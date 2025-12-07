
import { publicProcedure, router } from "../trpc-config";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { TEMPLATES } from "./data";

export const templatesRouter = router({
    list: publicProcedure.query(async () => {
        return TEMPLATES.map(({ content, ...rest }) => rest);
    }),

    get: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            const template = TEMPLATES.find(t => t.id === input.id);
            if (!template) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Template not found'
                });
            }
            return template;
        })
});
