import { initTRPC, TRPCError } from "@trpc/server";

export interface Context {
    env: Env;
    userId: string;
    executionCtx?: ExecutionContext; // Optional for compatibility, but populated in worker
}

export const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure;

/**
 * Procedure that requires authentication.
 * Throws UNAUTHORIZED if userId is missing or 'anonymous'.
 */
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
    if (!ctx.userId || ctx.userId === 'anonymous') {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
        });
    }
    return next({
        ctx: {
            ...ctx,
            userId: ctx.userId,
        },
    });
});
