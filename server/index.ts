import { DurableObject } from "cloudflare:workers";
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './trpc';
import { createAuth } from "./auth";

// Export Durable Objects
export { NoteDurableObject } from "./do/NoteDurableObject";
export { NoteIndexDurableObject } from "./do/NoteIndexDurableObject";
export { ConversationDurableObject } from "./do/ConversationDurableObject";

/** Example Durable Object (kept for reference) */
export class MyDurableObject extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async sayHello(name: string): Promise<string> {
		return `Hello, ${name}!`;
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle CORS preflight requests
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
					"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization, X-LIVA-USER-ID, Upgrade",
					"Access-Control-Allow-Credentials": "true",
				},
			});
		}

		try {
			const auth = createAuth(env);
			if (url.pathname.startsWith("/api/auth")) {
				const response = await auth.handler(request);
				return response;
			}
		} catch (error) {
			console.error("Auth Error:", error);
			return new Response("Internal Auth Error", { status: 500 });
		}

		// Handle WebSocket connections for real-time note updates
		if (url.pathname.startsWith("/ws/note/")) {
			const noteId = url.pathname.split("/ws/note/")[1];
			if (!noteId) {
				return new Response("Note ID required", { status: 400 });
			}

			// Resolve user session for WebSocket access control
			let userId: string | undefined;
			try {
				const auth = createAuth(env);
				const session = await auth.api.getSession({ headers: request.headers });
				userId = session?.user?.id;
			} catch (e) {
				console.error("Auth check failed for WebSocket", e);
			}

			// If no session, try extracting from query parameters or headers (for custom clients)
			if (!userId) {
				userId = url.searchParams.get("x-liva-user-id") || request.headers.get("X-LIVA-USER-ID") || undefined;
			}

			// Forward to the NoteDurableObject for this note
			let doId: DurableObjectId;
			if (noteId.length === 64 && /^[0-9a-f]{64}$/.test(noteId)) {
				try {
					doId = env.NOTE_DURABLE_OBJECT.idFromString(noteId);
				} catch {
					doId = env.NOTE_DURABLE_OBJECT.idFromName(noteId);
				}
			} else {
				doId = env.NOTE_DURABLE_OBJECT.idFromName(noteId);
			}
			const stub = env.NOTE_DURABLE_OBJECT.get(doId);

			// Create WebSocket request
			const wsUrl = new URL(request.url);
			wsUrl.pathname = "/websocket";
			const wsRequest = new Request(wsUrl.toString(), request);

			if (userId) {
				wsRequest.headers.set("X-Liva-User-Id", userId);
			}

			return stub.fetch(wsRequest);
		}

		if (url.pathname.startsWith("/api/v1")) {
			const response = await fetchRequestHandler({
				endpoint: "/api/v1",
				req: request,
				router: appRouter,
				createContext: async () => {
					const auth = createAuth(env);
					const session = await auth.api.getSession({ headers: request.headers });
					let userId = session?.user?.id;

					// TODO: remove this
					if (!userId) {
						userId = request.headers.get('X-LIVA-USER-ID') || undefined;
					}

					if (!userId) {
						throw new Error('User authentication required');
					}
					return { env, userId };
				},
			});

			// Add CORS headers to the response
			const newResponse = new Response(response.body, response);
			newResponse.headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") || "*");
			newResponse.headers.set("Access-Control-Allow-Credentials", "true");

			return newResponse;
		}

		// Example DO call (kept for reference)
		const stub = env.MY_DURABLE_OBJECT.getByName("foo");
		const greeting = await stub.sayHello("world");

		return new Response(greeting);
	},
} satisfies ExportedHandler<Env>;
