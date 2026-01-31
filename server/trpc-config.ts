import { initTRPC, TRPCError } from "@trpc/server";

export interface Context {
    env: Env;
    userId: string;
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
