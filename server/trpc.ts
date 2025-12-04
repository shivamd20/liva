import { notesRouter } from "./notes/router";
import { aiRouter } from "./ai/router";
import { t } from "./trpc-config";

// Export the app router
// Merge notesRouter (top-level) with aiRouter (namespaced under 'ai')
export const appRouter = t.mergeRouters(notesRouter, t.router({ ai: aiRouter }));

export type AppRouter = typeof appRouter;
