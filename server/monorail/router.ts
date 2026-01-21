
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

    /**
     * Signal that recording has stopped
     * Sets a short alarm for automatic finalization after pending uploads complete
     */
    signalStop: publicProcedure
        .input(z.object({ sessionId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const idObj = ctx.env.MONORAIL_SESSION_DO.idFromName(input.sessionId);
            const stub = ctx.env.MONORAIL_SESSION_DO.get(idObj);
            return await stub.signalStop();
        }),

    /**
     * @deprecated Use signalStop instead
     */
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

    initPublish: publicProcedure
        .input(z.object({ monorailSessionId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const publishId = crypto.randomUUID();
            const idObj = ctx.env.YOUTUBE_PUBLISH_SESSION_DO.idFromName(publishId);
            const stub = ctx.env.YOUTUBE_PUBLISH_SESSION_DO.get(idObj) as any;
            const state = await stub.init(input.monorailSessionId, ctx.userId);
            return state;
        }),

    startPublish: publicProcedure
        .input(z.object({ publishId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const idObj = ctx.env.YOUTUBE_PUBLISH_SESSION_DO.idFromString(input.publishId);
            const stub = ctx.env.YOUTUBE_PUBLISH_SESSION_DO.get(idObj) as any;
            return await stub.start();
        }),

    getPublishProgress: publicProcedure
        .input(z.object({ publishId: z.string() }))
        .query(async ({ ctx, input }) => {
            const idObj = ctx.env.YOUTUBE_PUBLISH_SESSION_DO.idFromString(input.publishId);
            const stub = ctx.env.YOUTUBE_PUBLISH_SESSION_DO.get(idObj) as any;
            return await stub.getState();
        }),
});
