
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
        if (existing) {
            // Reset alarm on access/re-creation attempt? Maybe not needed, but good practice if active.
            if (existing.status === 'active') {
                await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
            }
            return existing;
        }

        const newState: SessionState = {
            id,
            createdAt: Date.now(),
            status: "active",
            chunks_uploaded: 0,
        };
        await this.state.storage.put("state", newState);
        // Set alarm for 10 minutes
        await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
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

            if (session.status !== 'active') {
                return new Response("Session is not active", { status: 403 });
            }

            const objectKey = `monorail/${session.id}/chunk-${chunkIndex.padStart(6, '0')}.webm`;

            await this.env.files.put(objectKey, request.body);

            session.chunks_uploaded++;
            await this.state.storage.put("state", session);

            // Reset alarm
            await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);

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

    async alarm() {
        // Alarm triggered: finalize session
        const session = await this.getSessionState();
        if (session && session.status === 'active') {
            session.status = "completed";
            await this.state.storage.put("state", session);
            console.log(`Session ${session.id} finalized due to inactivity alarm.`);
        }
    }

    /**
     * Signal that recording has stopped
     * Sets a short alarm (5 seconds) to allow pending uploads to complete
     * before automatic finalization
     */
    async signalStop(): Promise<SessionState> {
        const session = await this.getSessionState();
        if (!session) throw new Error("Session not found");

        // Set a short alarm (5 seconds) to finalize after pending uploads complete
        await this.state.storage.setAlarm(Date.now() + 5 * 1000);

        console.log(`Session ${session.id} stop signaled. Will auto-finalize in 5 seconds.`);
        return session;
    }

    /**
     * @deprecated Use signalStop() instead to avoid race conditions
     * Manual finalization can cause 403 errors if uploads are still pending
     */
    async finalizeSession(): Promise<SessionState> {
        const session = await this.getSessionState();
        if (!session) throw new Error("Session not found");

        session.status = "completed";
        await this.state.storage.put("state", session);
        await this.state.storage.deleteAlarm();
        return session;
    }
}
