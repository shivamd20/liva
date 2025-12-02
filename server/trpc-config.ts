import { initTRPC, TRPCError } from "@trpc/server";

export interface Context {
    env: Env;
    userId: string;
}

export const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;
