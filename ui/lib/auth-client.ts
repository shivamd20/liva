import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: window.location.origin,
    plugins: [
        anonymousClient()
    ]
});

export const { signIn, signOut, useSession } = authClient;


