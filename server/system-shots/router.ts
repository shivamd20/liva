import { t, protectedProcedure } from "../trpc-config";
import { z } from "zod";
import { LearningMemoryDO } from "../do/LearningMemoryDO";

const LOG_PREFIX = "[systemShots]";

export const systemShotsRouter = t.router({
  submitAnswer: protectedProcedure
    .input(
      z.object({
        reelId: z.string(),
        selectedIndex: z.number().nullable(),
        correct: z.boolean(),
        skipped: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      console.log(`${LOG_PREFIX} submitAnswer userId=${userId} reelId=${input.reelId} selectedIndex=${input.selectedIndex} correct=${input.correct} skipped=${input.skipped ?? false}`);

      const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
      const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
      await stub.submitAnswer(
        input.reelId,
        input.selectedIndex,
        input.correct,
        input.skipped
      );
      console.log(`${LOG_PREFIX} submitAnswer DO done reelId=${input.reelId}`);
      return { ok: true };
    }),

  /** Progress overview: concepts + topic state + derived mastery. */
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;
    console.log(`${LOG_PREFIX} getProgress userId=${userId}`);

    const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
    const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
    const result = await stub.getProgress();
    console.log(`${LOG_PREFIX} getProgress DO return items=${result.items.length}`);
    return result;
  }),
});
