/// <reference types="./vite-env.d.ts" />
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/trpc';
import { getUserId } from './utils/userIdentity';
import { authClient } from './lib/auth-client';

const API_URL = '/api/v1';

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: API_URL,
      async headers() {
        const session = await authClient.getSession();
        const headers: Record<string, string> = {
          'X-LIVA-USER-ID': getUserId(),
        };

        if (session.data?.session?.token) {
          headers['Authorization'] = `Bearer ${session.data.session.token}`;
        }

        return headers;
      },
    }),
  ],
});
