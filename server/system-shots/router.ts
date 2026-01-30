import { t, protectedProcedure } from "../trpc-config";
import { z } from "zod";
import { LearningMemoryDO } from "../do/LearningMemoryDO";
import type { DifficultyOverride, PriorityBias } from "./types";

const LOG_PREFIX = "[systemShots]";

// Zod schemas for preferences
const difficultyOverrideSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
const priorityBiasSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

const conceptPrefSchema = z.object({
  conceptId: z.string(),
  enabled: z.boolean(),
  difficultyOverride: difficultyOverrideSchema,
  priorityBias: priorityBiasSchema,
});

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

  // ─────────────────────────────────────────────────────────────────────────────
  // User Learning Preferences
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get all user preferences (concept prefs + topic overlays). */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;
    console.log(`${LOG_PREFIX} getPreferences userId=${userId}`);

    const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
    const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
    const result = await stub.getPreferences();
    console.log(`${LOG_PREFIX} getPreferences conceptPrefs=${result.conceptPrefs.length} overlays=${result.topicOverlays.length}`);
    return result;
  }),

  /** Update a single concept's preferences. */
  updateConceptPref: protectedProcedure
    .input(conceptPrefSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      console.log(`${LOG_PREFIX} updateConceptPref userId=${userId} conceptId=${input.conceptId}`);

      const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
      const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
      await stub.updateConceptPref(
        input.conceptId,
        input.enabled,
        input.difficultyOverride as DifficultyOverride,
        input.priorityBias as PriorityBias
      );
      return { ok: true };
    }),

  /** Batch update concept preferences (for Apply Changes). */
  batchUpdateConceptPrefs: protectedProcedure
    .input(z.object({ prefs: z.array(conceptPrefSchema) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      console.log(`${LOG_PREFIX} batchUpdateConceptPrefs userId=${userId} count=${input.prefs.length}`);

      const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
      const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
      await stub.batchUpdateConceptPrefs(input.prefs.map(p => ({
        ...p,
        difficultyOverride: p.difficultyOverride as DifficultyOverride,
        priorityBias: p.priorityBias as PriorityBias,
      })));
      return { ok: true };
    }),

  /** Reset concept preferences to defaults (optionally by track). */
  resetConceptPrefs: protectedProcedure
    .input(z.object({ track: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      console.log(`${LOG_PREFIX} resetConceptPrefs userId=${userId} track=${input.track ?? "all"}`);

      const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
      const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
      await stub.resetConceptPrefs(input.track);
      return { ok: true };
    }),

  /** Add a user topic overlay. */
  addTopicOverlay: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
        mappedConceptIds: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      console.log(`${LOG_PREFIX} addTopicOverlay userId=${userId} title="${input.title}"`);

      const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
      const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
      const overlay = await stub.addTopicOverlay(
        input.title,
        input.description,
        input.mappedConceptIds
      );
      return overlay;
    }),

  /** Remove a user topic overlay. */
  removeTopicOverlay: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      console.log(`${LOG_PREFIX} removeTopicOverlay userId=${userId} id=${input.id}`);

      const doId = ctx.env.SYSTEM_SHOTS_DO.idFromName(userId);
      const stub = ctx.env.SYSTEM_SHOTS_DO.get(doId) as unknown as LearningMemoryDO;
      await stub.removeTopicOverlay(input.id);
      return { ok: true };
    }),
});
