
import { DurableObject } from "cloudflare:workers";


export interface SessionState {
    id: string;
    createdAt: number;
    status: "active" | "finalizing" | "completed";
    chunks_uploaded: number;
}

export class MonorailSessionDO extends DurableObject<Env> {
    state: DurableObjectState;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.state = ctx;
    }

    async getSessionState(): Promise<SessionState | null> {
        const stored = await this.state.storage.get<SessionState>("state");
        return stored || null;
    }

    async createSession(id: string): Promise<SessionState> {
        const existing = await this.getSessionState();
        if (existing) return existing;

        const newState: SessionState = {
            id,
            createdAt: Date.now(),
            status: "active",
            chunks_uploaded: 0,
        };
        await this.state.storage.put("state", newState);
        return newState;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // Handle upload: /.../upload/:chunkIndex
        if (request.method === "PUT" && url.pathname.includes("/upload/")) {
            const parts = url.pathname.split("/upload/");
            const chunkIndex = parts[1];

            if (!chunkIndex) return new Response("Chunk index missing", { status: 400 });

            const session = await this.getSessionState();
            if (!session) return new Response("Session not found", { status: 404 });

            const objectKey = `monorail/${session.id}/chunk-${chunkIndex.padStart(6, '0')}.webm`;

            await this.env.files.put(objectKey, request.body);

            session.chunks_uploaded++;
            await this.state.storage.put("state", session);

            return new Response("OK");
        }

        // Handle download manifest: /.../manifest
        if (request.method === "GET" && url.pathname.endsWith("/manifest")) {
            const session = await this.getSessionState();
            if (!session) return new Response("Session not found", { status: 404 });
            return Response.json(session);
        }

        // Handle download chunk: /.../chunk/:chunkIndex
        if (request.method === "GET" && url.pathname.includes("/chunk/")) {
            const parts = url.pathname.split("/chunk/");
            const chunkIndex = parts[1];
            if (!chunkIndex) return new Response("Chunk index missing", { status: 400 });

            const session = await this.getSessionState();
            if (!session) return new Response("Session not found", { status: 404 });

            const objectKey = `monorail/${session.id}/chunk-${chunkIndex.padStart(6, '0')}.webm`;
            const object = await this.env.files.get(objectKey);

            if (!object) return new Response("Chunk not found", { status: 404 });

            return new Response(object.body, {
                headers: { "Content-Type": "video/webm" }
            });
        }

        return new Response("Not Found", { status: 404 });
    }

    async finalizeSession(): Promise<SessionState> {
        const session = await this.getSessionState();
        if (!session) throw new Error("Session not found");

        session.status = "completed";
        await this.state.storage.put("state", session);
        return session;
    }
}
