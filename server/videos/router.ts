
import { t, protectedProcedure } from "../trpc-config";
import { z } from "zod";
import { VideosDO } from "../do/VideosDO";

export const videosRouter = t.router({
    list: protectedProcedure
        .query(async ({ ctx }) => {
            const doId = ctx.env.VIDEOS_DO.idFromName(ctx.userId);
            const stub = ctx.env.VIDEOS_DO.get(doId) as unknown as VideosDO;
            return await stub.listVideos(ctx.userId);
        }),

    listPaginated: protectedProcedure
        .input(z.object({
            limit: z.number().min(1).max(50).default(12),
            cursor: z.string().optional(),
            boardId: z.string().optional(),
            status: z.enum(['RECORDED', 'PROCESSING', 'PUBLISHED', 'FAILED']).optional(),
            search: z.string().optional()
        }))
        .query(async ({ ctx, input }) => {
            const doId = ctx.env.VIDEOS_DO.idFromName(ctx.userId);
            const stub = ctx.env.VIDEOS_DO.get(doId) as unknown as VideosDO;
            return await stub.listVideosPaginated({
                limit: input.limit,
                cursor: input.cursor,
                boardId: input.boardId,
                status: input.status,
                search: input.search
            });
        }),

    create: protectedProcedure
        .input(z.object({
            id: z.string().uuid(),
            title: z.string(),
            description: z.string().optional(),
            sessionId: z.string(),
            boardId: z.string().optional(),
            status: z.enum(['RECORDED', 'PROCESSING', 'PUBLISHED', 'FAILED']),
            thumbnailUrl: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const doId = ctx.env.VIDEOS_DO.idFromName(ctx.userId);
            const stub = ctx.env.VIDEOS_DO.get(doId) as unknown as VideosDO;

            return await stub.createVideo({
                id: input.id,
                userId: ctx.userId,
                title: input.title,
                description: input.description,
                sessionId: input.sessionId,
                boardId: input.boardId,
                status: input.status,
                thumbnailUrl: input.thumbnailUrl
            });
        }),

    get: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const doId = ctx.env.VIDEOS_DO.idFromName(ctx.userId);
            const stub = ctx.env.VIDEOS_DO.get(doId) as unknown as VideosDO;
            return await stub.getVideo(input.id);
        }),

    updateMetadata: protectedProcedure
        .input(z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const doId = ctx.env.VIDEOS_DO.idFromName(ctx.userId);
            const stub = ctx.env.VIDEOS_DO.get(doId) as unknown as VideosDO;
            return await stub.updateMetadata(input.id, input.title, input.description);
        }),

    linkToBoard: protectedProcedure
        .input(z.object({
            videoId: z.string(),
            boardId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const doId = ctx.env.VIDEOS_DO.idFromName(ctx.userId);
            const stub = ctx.env.VIDEOS_DO.get(doId) as unknown as VideosDO;
            await stub.linkToBoard(input.videoId, input.boardId);
            return { success: true };
        })
});

