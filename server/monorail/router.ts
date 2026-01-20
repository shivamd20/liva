
import { z } from "zod";
import { publicProcedure, router } from "../trpc-config";

export const monorailRouter = router({
    createSession: publicProcedure
        .input(z.object({ sessionId: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const id = input.sessionId || crypto.randomUUID();
            const idObj = ctx.env.MONORAIL_SESSION_DO.idFromName(id);
            const stub = ctx.env.MONORAIL_SESSION_DO.get(idObj);
            return await stub.createSession(id);
        }),



    finalizeSession: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const idObj = ctx.env.MONORAIL_SESSION_DO.idFromName(input.sessionId);
            const stub = ctx.env.MONORAIL_SESSION_DO.get(idObj);
            return await stub.finalizeSession();
        }),

    getSession: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .query(async ({ ctx, input }) => {
            const idObj = ctx.env.MONORAIL_SESSION_DO.idFromName(input.sessionId);
            const stub = ctx.env.MONORAIL_SESSION_DO.get(idObj);
            return await stub.getSessionState();
        }),
});
