import { notesRouter } from "./notes/router";

// Export the app router
export const appRouter = notesRouter;

export type AppRouter = typeof appRouter;
