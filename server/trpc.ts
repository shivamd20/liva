import { notesRouter } from "./notes/router";
import { aiRouter } from "./ai/router";
import { conversationRouter } from "./conversation/router";
import { templatesRouter } from "./templates/router";
import { monorailRouter } from "./monorail/router";
import { videosRouter } from "./videos/router";
import { systemShotsRouter } from "./system-shots/router";
import { codePracticeRouter } from "./code-practice/router";
import { engineRouter } from "./code-practice/engine/router";
import { t } from "./trpc-config";

// Export the app router
// Merge notesRouter (top-level) with aiRouter (namespaced under 'ai')
export const appRouter = t.mergeRouters(notesRouter, t.router({
    ai: aiRouter,
    conversation: conversationRouter,
    templates: templatesRouter,
    monorail: monorailRouter,
    videos: videosRouter,
    systemShots: systemShotsRouter,
    codePractice: codePracticeRouter,
    engine: engineRouter,
}));

export type AppRouter = typeof appRouter;
