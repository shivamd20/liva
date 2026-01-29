import { t, protectedProcedure } from "../trpc-config";
import { z } from "zod";
import { LearningMemoryDO } from "../do/LearningMemoryDO";
import { MOCK_REELS } from "./mockReels";
import { CONCEPT_V2 } from "./concepts";
import type { ProgressItem, Mastery } from "./types";

const LOG_PREFIX = "[systemShots]";

function useSystemShotsMock(env: Env): boolean {
  return (env as unknown as Record<string, unknown>).USE_SYSTEM_SHOTS_MOCK === "true";
}

export const systemShotsRouter = t.router({
  /** Cursor-based page of unconsumed reels for useInfiniteQuery. */
  getReels: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const mock = useSystemShotsMock(ctx.env);
      console.log(`${LOG_PREFIX} getReels userId=${userId} cursor=${input.cursor ?? "none"} limit=${input.limit} mock=${mock}`);

      if (mock) {
        const limit = input.limit;
        const cursorIndex = input.cursor
          ? MOCK_REELS.findIndex((r) => r.id === input.cursor) + 1
          : 0;
        const page = MOCK_REELS.slice(cursorIndex, cursorIndex + limit);
        const nextCursor =
          cursorIndex + limit < MOCK_REELS.length
            ? page[page.length - 1]?.id ?? null
            : null;
        console.log(`${LOG_PREFIX} getReels mock return reels=${page.length} nextCursor=${nextCursor ?? "null"}`);
        return { reels: page, nextCursor };
      }

      const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
      const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
      const result = await stub.getReels(input.cursor, input.limit);
      console.log(`${LOG_PREFIX} getReels DO return reels=${result.reels.length} nextCursor=${result.nextCursor ?? "null"} reelIds=${result.reels.map((r) => r.id).join(",")}`);
      return result;
    }),

  getNextReel: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.userId;
    const mock = useSystemShotsMock(ctx.env);
    console.log(`${LOG_PREFIX} getNextReel userId=${userId} mock=${mock}`);

    if (mock) {
      const reel = MOCK_REELS[0] ?? null;
      console.log(`${LOG_PREFIX} getNextReel mock return reelId=${reel?.id ?? "null"}`);
      return reel;
    }
    const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
    const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
    const reel = await stub.getNextReel();
    console.log(`${LOG_PREFIX} getNextReel DO return reelId=${reel?.id ?? "null"}`);
    return reel;
  }),

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
      const mock = useSystemShotsMock(ctx.env);
      console.log(`${LOG_PREFIX} submitAnswer userId=${userId} reelId=${input.reelId} selectedIndex=${input.selectedIndex} correct=${input.correct} skipped=${input.skipped ?? false} mock=${mock}`);

      if (mock) {
        console.log(`${LOG_PREFIX} submitAnswer mock no-op`);
        return { ok: true };
      }

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
    const mock = useSystemShotsMock(ctx.env);
    console.log(`${LOG_PREFIX} getProgress userId=${userId} mock=${mock}`);

    if (mock) {
      const masteryOrder: Mastery[] = ["solid", "solid", "learning", "learning", "learning", "weak", "weak", "unknown", "unknown", "unknown"];
      const items: ProgressItem[] = CONCEPT_V2.map((c, i) => {
        const m = masteryOrder[i % masteryOrder.length] ?? "unknown";
        return {
          conceptId: c.id,
          name: c.name,
          difficultyTier: c.difficulty_hint === "intro" ? 1 : c.difficulty_hint === "core" ? 2 : 3,
          difficulty_hint: c.difficulty_hint,
          type: c.type,
          track: c.track,
          exposureCount: m === "unknown" ? 0 : i + 1,
          accuracyEma: m === "solid" ? 0.85 : m === "weak" ? 0.4 : 0.6,
          failureStreak: m === "weak" ? 2 : 0,
          lastAt: m === "unknown" ? 0 : Date.now() - i * 86400000,
          mastery: m,
        };
      });
      console.log(`${LOG_PREFIX} getProgress mock return items=${items.length}`);
      return { items };
    }

    const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
    const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
    const result = await stub.getProgress();
    console.log(`${LOG_PREFIX} getProgress DO return items=${result.items.length}`);
    return result;
  }),
});
