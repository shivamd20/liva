import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export const createAuth = (env: Env) => {
  const db = drizzle(env.liva_db, { schema });
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        ...schema
      }
    }),
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
       google: {
         clientId: env.GOOGLE_CLIENT_ID,
         clientSecret: env.GOOGLE_CLIENT_SECRET,
       }
    },
    baseURL: env.AUTH_BASE_URL,
    trustedOrigins: [
        "http://localhost:5173"
    ],
    plugins: [
      anonymous({
        onLinkAccount: async ({ anonymousUser, newUser }) => {
            // TODO: Handle merging anonymous user data to the new user account
            console.log("Linking anonymous account", anonymousUser.user.id, "to new account", newUser.user.id);
        }
      })
    ]
  });
};
