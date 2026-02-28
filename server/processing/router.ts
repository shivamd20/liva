import { z } from "zod";
import { publicProcedure, router } from "../trpc-config";
import type { ProcessingJobDO } from "../do/ProcessingJobDO";
import type { VideosDO } from "../do/VideosDO";

/**
 * Client-facing API for video post-processing.
 * ProcessingJobDO is keyed by videoId for easy lookup by video.
 * getStatus(jobId) requires JOB_ID_TO_VIDEO KV to resolve jobId -> videoId.
 */
export const processingRouter = router({
    startProcessing: publicProcedure
        .input(z.object({ videoId: z.string(), sessionId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.userId) throw new Error("Unauthorized");

            const jobId = crypto.randomUUID();

            // Get MonorailSessionDO to read chunks_uploaded
            const monorailId = ctx.env.MONORAIL_SESSION_DO.idFromName(input.sessionId);
            const monorailStub = ctx.env.MONORAIL_SESSION_DO.get(monorailId);
            const sessionState = await monorailStub.getSessionState();
            const totalChunks = sessionState?.chunks_uploaded ?? 0;

            // ProcessingJobDO keyed by videoId
            const jobDoId = ctx.env.PROCESSING_JOB_DO.idFromName(input.videoId);
            const jobStub = ctx.env.PROCESSING_JOB_DO.get(jobDoId) as unknown as ProcessingJobDO;
            await jobStub.startProcessing({
                jobId,
                videoId: input.videoId,
                sessionId: input.sessionId,
                userId: ctx.userId,
                totalChunks,
            });

            // Store jobId -> videoId for getStatus(jobId) lookup
            const envWithKv = ctx.env as Env & { JOB_ID_TO_VIDEO?: KVNamespace };
            if (envWithKv.JOB_ID_TO_VIDEO) {
                await envWithKv.JOB_ID_TO_VIDEO.put(jobId, input.videoId);
            }

            // Update VideosDO status to PROCESSING
            const videosDoId = ctx.env.VIDEOS_DO.idFromName(ctx.userId);
            const videosStub = ctx.env.VIDEOS_DO.get(videosDoId) as unknown as VideosDO;
            await videosStub.updateStatus(input.videoId, "PROCESSING");

            return { jobId };
        }),

    getStatus: publicProcedure
        .input(z.object({ jobId: z.string() }))
        .query(async ({ ctx, input }) => {
            const envWithKv = ctx.env as Env & { JOB_ID_TO_VIDEO?: KVNamespace };
            const videoId = envWithKv.JOB_ID_TO_VIDEO
                ? await envWithKv.JOB_ID_TO_VIDEO.get(input.jobId)
                : null;

            if (!videoId) {
                return null;
            }

            const jobDoId = ctx.env.PROCESSING_JOB_DO.idFromName(videoId);
            const stub = ctx.env.PROCESSING_JOB_DO.get(jobDoId) as unknown as ProcessingJobDO;
            return await stub.getJobStatus(input.jobId);
        }),

    getStatusByVideoId: publicProcedure
        .input(z.object({ videoId: z.string() }))
        .query(async ({ ctx, input }) => {
            const jobDoId = ctx.env.PROCESSING_JOB_DO.idFromName(input.videoId);
            const stub = ctx.env.PROCESSING_JOB_DO.get(jobDoId) as unknown as ProcessingJobDO;
            return await stub.getJobByVideoId(input.videoId);
        }),

    getDownloadUrl: publicProcedure
        .input(
            z.object({
                videoId: z.string(),
                type: z.enum(["video", "audio", "thumbnail", "transcript"]),
            })
        )
        .query(async ({ ctx, input }) => {
            const jobDoId = ctx.env.PROCESSING_JOB_DO.idFromName(input.videoId);
            const stub = ctx.env.PROCESSING_JOB_DO.get(jobDoId) as unknown as ProcessingJobDO;
            const job = await stub.getJobByVideoId(input.videoId);
            if (!job || job.status !== "complete") {
                return { url: null };
            }

            const sessionId = job.session_id;
            const filename =
                input.type === "video"
                    ? "video.mp4"
                    : input.type === "audio"
                      ? "audio.wav"
                      : input.type === "thumbnail"
                        ? "thumbnail.jpg"
                        : "transcript.json";

            const url = `/api/processed/${sessionId}/${filename}`;
            return { url };
        }),

    getShareInfo: publicProcedure
        .input(z.object({ videoId: z.string() }))
        .query(async ({ ctx, input }) => {
            const videosDoId = ctx.env.VIDEOS_DO.idFromName(ctx.userId);
            const stub = ctx.env.VIDEOS_DO.get(videosDoId) as unknown as VideosDO;
            const video = await stub.getVideo(input.videoId);
            if (!video) return null;

            return {
                title: video.title,
                description: video.description,
                thumbnailUrl: video.thumbnailUrl,
                sessionId: video.sessionId,
                status: video.status,
            };
        }),

    createShare: publicProcedure
        .input(z.object({ videoId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.userId) throw new Error("Unauthorized");

            const videosDoId = ctx.env.VIDEOS_DO.idFromName(ctx.userId);
            const videosStub = ctx.env.VIDEOS_DO.get(videosDoId) as unknown as VideosDO;
            const video = await videosStub.getVideo(input.videoId);
            if (!video) throw new Error("Video not found");

            await ctx.env.liva_db.exec(
                "CREATE TABLE IF NOT EXISTS video_shares (video_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_id TEXT NOT NULL, title TEXT, description TEXT, created_at INTEGER)"
            );
            await ctx.env.liva_db.prepare(
                "INSERT OR REPLACE INTO video_shares (video_id, user_id, session_id, title, description, created_at) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(
                video.id,
                ctx.userId,
                video.sessionId,
                video.title || "Untitled Video",
                video.description || null,
                video.createdAt
            ).run();

            return { shareUrl: `/share/${video.id}` };
        }),
});
