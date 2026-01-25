import { DurableObject } from "cloudflare:workers";
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './trpc';
import { createAuth } from "./auth";

// Export Durable Objects
export { NoteDurableObject } from "./do/NoteDurableObject";
export { NoteIndexDurableObject } from "./do/NoteIndexDurableObject";
export { LegacyConversationDurableObject as ConversationDurableObject } from "./do/LegacyConversationDurableObject";
export { ConversationV2DurableObject } from "./do/ConversationV2DurableObject";
export { RecordingDurableObject } from "./do/RecordingDurableObject";
export { MonorailSessionDO } from "./monorail/session-do";
export { YouTubeIntegrationDO } from "./do/YouTubeIntegrationDO";
export { YouTubePublishSessionDO } from "./monorail/publish-do";
export { VideosDO } from "./do/VideosDO";


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
			if (url.pathname.startsWith("/api/auth") && !url.pathname.startsWith("/api/auth/youtube")) {
				return await auth.handler(request);
			}
		} catch (error) {
			console.error("Auth Error:", error);
			return new Response("Internal Auth Error", { status: 500 });
		}

		// YouTube Integrations Routing
		if (url.pathname.startsWith("/api/auth/youtube") || url.pathname.startsWith("/api/integrations/youtube")) {
			// Get User ID
			let userId: string | undefined;
			try {
				const auth = createAuth(env);
				const session = await auth.api.getSession({ headers: request.headers });
				userId = session?.user?.id;
			} catch (e) {
				console.error("Auth check failed", e);
			}

			// SECURITY: The following bypass is for testing in dev mode only.
			// if (!userId) {
			// 	userId = request.headers.get("X-Liva-User-Id") || undefined;
			// }

			if (!userId) {
				return new Response("Unauthorized", { status: 401 });
			}

			const doId = env.YOUTUBE_INTEGRATION_DO.idFromName(userId);
			const stub = env.YOUTUBE_INTEGRATION_DO.get(doId);

			const doUrl = new URL(request.url);
			if (url.pathname === "/api/auth/youtube/start") {
				doUrl.pathname = "/start-auth";
			} else if (url.pathname.startsWith("/api/auth/youtube/callback")) {
				doUrl.pathname = "/callback";
			} else if (url.pathname === "/api/integrations/youtube" && request.method === "GET") {
				doUrl.pathname = "/list";
			} else if (url.pathname.startsWith("/api/integrations/youtube/") && request.method === "DELETE") {
				const parts = url.pathname.split("/");
				const integrationId = parts[parts.length - 1];
				doUrl.pathname = `/disconnect/${integrationId}`;
			} else {
				// Pass through or 404
			}

			const newReq = new Request(doUrl, request);
			newReq.headers.set("X-Liva-User-Id", userId);
			return stub.fetch(newReq);
		}

		// Recording API Routing
		// Route all /api/recording/* to a singleton or session-based DO.
		// For now, let's use a "GLOBAL_RECORDER" singleton for MVP simplicity to hold all sessions.
		if (url.pathname.startsWith("/api/recording")) {
			// Security: Ensure user is authenticated
			let userId: string | undefined;
			try {
				const auth = createAuth(env);
				const session = await auth.api.getSession({ headers: request.headers });
				userId = session?.user?.id;
			} catch (e) {
				console.error("Auth check failed for recording", e);
			}

			// SECURITY: The following bypass is for testing in dev mode only.
			// if (!userId) {
			//     userId = request.headers.get("X-Liva-User-Id") || undefined;
			// }

			if (!userId) {
				return new Response("Unauthorized", { status: 401 });
			}

			const doId = env.RECORDING_DURABLE_OBJECT.idFromName("GLOBAL_RECORDER");
			const stub = env.RECORDING_DURABLE_OBJECT.get(doId);

			// Forward request with User ID header
			const newRequest = new Request(request);
			newRequest.headers.set("X-Liva-User-Id", userId);
			return stub.fetch(newRequest);
		}

		if (url.pathname.startsWith("/api/monorail/session/")) {
			// Security: Ensure user is authenticated
			let userId: string | undefined;
			try {
				const auth = createAuth(env);
				const session = await auth.api.getSession({ headers: request.headers });
				userId = session?.user?.id;
			} catch (e) {
				console.error("Auth check failed for monorail session", e);
			}

			// SECURITY: The following bypass is for testing in dev mode only.
			// if (!userId) {
			//     userId = request.headers.get("X-Liva-User-Id") || undefined;
			// }

			if (!userId) {
				return new Response("Unauthorized", { status: 401 });
			}

			const parts = url.pathname.split("/");
			// /api/monorail/session/:sessionId/...
			const sessionId = parts[4];
			if (!sessionId) return new Response("Session ID missing", { status: 400 });

			const idObj = env.MONORAIL_SESSION_DO.idFromName(sessionId);
			const stub = env.MONORAIL_SESSION_DO.get(idObj);

			// Forward request with User ID header
			const newRequest = new Request(request);
			newRequest.headers.set("X-Liva-User-Id", userId);
			return stub.fetch(newRequest);
		}

		// Conversation V2 API
		if (url.pathname.startsWith("/api/conversation-v2/")) {
			// Security: Ensure user is authenticated
			let userId: string | undefined;
			try {
				const auth = createAuth(env);
				const session = await auth.api.getSession({ headers: request.headers });
				userId = session?.user?.id;
			} catch (e) {
				console.error("Auth check failed for conversation-v2", e);
			}

			if (!userId) {
				return new Response("Unauthorized", { status: 401 });
			}

			const parts = url.pathname.split("/");
			// /api/conversation-v2/:conversationId/...
			const conversationId = parts[3];
			if (!conversationId) return new Response("Conversation ID missing", { status: 400 });

			// Use idFromName for persistent conversations by ID
			const idObj = env.CONVERSATION_V2_DO.idFromName(conversationId);
			const stub = env.CONVERSATION_V2_DO.get(idObj);

			// Rewrite URL to strip /api/conversation-v2/:id prefix to simplify DO routing
			const doUrl = new URL(request.url);
			// /api/conversation-v2/:id/chat -> /chat
			doUrl.pathname = "/" + parts.slice(4).join("/");

			const newRequest = new Request(doUrl.toString(), request);
			newRequest.headers.set("X-Liva-User-Id", userId);
			newRequest.headers.set("X-Conversation-Id", conversationId);

			return stub.fetch(newRequest);
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
			// SECURITY: The following bypass is for testing in dev mode only.
			// if (!userId) {
			// 	userId = url.searchParams.get("x-liva-user-id") || request.headers.get("X-LIVA-USER-ID") || undefined;
			// }

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

		// File Upload API
		if (url.pathname === "/api/files/upload" && request.method === "POST") {
			try {
				const auth = createAuth(env);
				const session = await auth.api.getSession({ headers: request.headers });
				let userId = session?.user?.id;

				// SECURITY: The following bypass is for testing in dev mode only.
				// if (!userId) {
				// 	userId = request.headers.get("X-Liva-User-Id") || undefined;
				// }

				if (!userId) {
					return new Response("Unauthorized", { status: 401 });
				}

				const formData = await request.formData();
				const file = formData.get("file");
				const boardId = formData.get("boardId");

				if (!file || !(file instanceof File) || !boardId || typeof boardId !== "string") {
					return new Response("Invalid request", { status: 400 });
				}

				const fileId = crypto.randomUUID();
				const key = `boards/${boardId}/${fileId}`;

				await env.files.put(key, file, {
					httpMetadata: {
						contentType: file.type,
					},
					customMetadata: {
						userId: userId,
						originalName: file.name,
					}
				});

				const publicUrl = `/api/files/${boardId}/${fileId}`;

				return new Response(JSON.stringify({
					url: publicUrl,
					fileId: fileId,
				}), {
					headers: { "Content-Type": "application/json" }
				});

			} catch (e) {
				console.error("Upload error:", e);
				return new Response("Upload failed", { status: 500 });
			}
		}

		// File Download API
		if (url.pathname.startsWith("/api/files/") && request.method === "GET") {
			const parts = url.pathname.split("/");
			// /api/files/:boardId/:fileId
			const boardId = parts[3];
			const fileId = parts[4];

			if (!boardId || !fileId) {
				return new Response("Invalid URL", { status: 400 });
			}

			const key = `boards/${boardId}/${fileId}`;
			const object = await env.files.get(key);

			if (!object) {
				return new Response("File not found", { status: 404 });
			}

			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set("etag", object.httpEtag);
			// Cache for 1 year immutable as files are content-addressed by ID (practically) 
			// though here ID is random, but content doesn't change for same ID.
			headers.set("Cache-Control", "public, max-age=31536000, immutable");

			return new Response(object.body, {
				headers,
			});
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

					// SECURITY: The following bypass is for testing in dev mode only.
					// if (!userId) {
					// 	userId = request.headers.get('X-LIVA-USER-ID') || undefined;
					// }

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
