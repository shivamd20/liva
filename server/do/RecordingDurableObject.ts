
import { DurableObject } from "cloudflare:workers";

export class RecordingDurableObject extends DurableObject {
    private sql: any;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        this.initializeTables();
    }

    private initializeTables() {
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS audio_chunks (
                sessionId TEXT,
                chunkId INTEGER,
                startOffsetMs INTEGER,
                durationMs INTEGER,
                blob BLOB,
                PRIMARY KEY (sessionId, chunkId)
            );
            CREATE TABLE IF NOT EXISTS board_events (
                sessionId TEXT,
                t INTEGER,
                type TEXT,
                elements TEXT,
                appStateMinimal TEXT,
                files TEXT
            );
            CREATE TABLE IF NOT EXISTS pointer_events (
                sessionId TEXT,
                t INTEGER,
                pointers TEXT,
                button TEXT
            );
            CREATE TABLE IF NOT EXISTS manifest (
                sessionId TEXT PRIMARY KEY,
                startedAt INTEGER,
                endedAt INTEGER,
                audioChunks INTEGER,
                boardEventCount INTEGER,
                pointerEventCount INTEGER,
                status TEXT
            );
        `);
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method;
        const path = url.pathname;

        try {
            if (path.endsWith('/upload/audio')) {
                return this.uploadAudio(request);
            } else if (path.endsWith('/upload/board')) {
                return this.uploadBoard(request);
            } else if (path.endsWith('/upload/pointer')) {
                return this.uploadPointer(request);
            } else if (path.endsWith('/upload/manifest')) {
                return this.uploadManifest(request);
            } else if (path.includes('/download/manifest')) {
                return this.getManifest(request);
            } else if (path.includes('/download/audio')) {
                return this.getAudio(request, url);
            } else if (path.includes('/download/events')) {
                return this.getEvents(request);
            }

            return new Response("Not Found", { status: 404 });
        } catch (e: any) {
            console.error("Recording DO Error", e);
            return new Response("Internal Error: " + e.message, { status: 500 });
        }
    }

    private async uploadAudio(request: Request) {
        const formData = await request.formData();
        const sessionId = formData.get('sessionId') as string;
        const chunkId = parseInt(formData.get('chunkId') as string);
        const startOffsetMs = parseInt(formData.get('startOffsetMs') as string);
        const durationMs = parseInt(formData.get('durationMs') as string);
        const file = formData.get('file') as File;

        const arrayBuffer = await file.arrayBuffer();

        this.sql.exec(`
            INSERT OR REPLACE INTO audio_chunks (sessionId, chunkId, startOffsetMs, durationMs, blob)
            VALUES (?, ?, ?, ?, ?)
        `, sessionId, chunkId, startOffsetMs, durationMs, arrayBuffer);

        return new Response('OK');
    }

    private async uploadBoard(request: Request) {
        const body = await request.json() as any;
        const { sessionId, events } = body;

        for (const e of events) {
            this.sql.exec(`
                INSERT INTO board_events (sessionId, t, type, elements, appStateMinimal, files)
                VALUES (?, ?, ?, ?, ?, ?)
            `, sessionId, e.t, e.type, JSON.stringify(e.elements), JSON.stringify(e.appStateMinimal || {}), JSON.stringify(e.files || {}));
        }

        return new Response('OK');
    }

    private async uploadPointer(request: Request) {
        const body = await request.json() as any;
        const { sessionId, events } = body;

        for (const e of events) {
            this.sql.exec(`
                INSERT INTO pointer_events (sessionId, t, pointers, button)
                VALUES (?, ?, ?, ?)
            `, sessionId, e.t, JSON.stringify(e.pointers), e.button || 'up');
        }

        return new Response('OK');
    }

    private async uploadManifest(request: Request) {
        const manifest = await request.json() as any;
        this.sql.exec(`
            INSERT OR REPLACE INTO manifest (sessionId, startedAt, endedAt, audioChunks, boardEventCount, pointerEventCount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, manifest.sessionId, manifest.startedAt, manifest.endedAt, manifest.audioChunks, manifest.boardEventCount, manifest.pointerEventCount, manifest.status);
        return new Response('OK');
    }

    private async getManifest(request: Request) {
        // Assume session ID is derived or passed. For this DO, one DO = one session?
        // Or one DO = global recorder?
        // For scalability, one DO per session is best. But naming is tricky without coordination.
        // For MVP/Test, let's use ONE gloabl DO for all recordings, or route by ID.
        // If route by ID 'RECORDING_MANAGER', then we query by sessionId.
        // If route by ID = sessionId, then we just select * LIMIT 1.

        // Let's assume this DO instance handles *multiple* sessions for now for simplicity of not managing many DO IDs in the client.
        // Wait, `fetch` in `index.ts` determines routing. 
        // If we use `idFromName('GLOBAL_RECORDER')`, then one DO holds all. Max storage 10GB per DO? 
        // For MVP test, GLOBAL is fine.

        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) return new Response("Session ID required", { status: 400 });

        const manifest = this.sql.exec("SELECT * FROM manifest WHERE sessionId = ?", sessionId).one();
        if (!manifest) return new Response("Session not found", { status: 404 });

        return Response.json(manifest);
    }

    private async getEvents(request: Request) {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) return new Response("Session ID required", { status: 400 });

        const boardEvents = this.sql.exec("SELECT * FROM board_events WHERE sessionId = ? ORDER BY t ASC", sessionId).toArray().map((e: any) => ({
            ...e,
            elements: JSON.parse(e.elements),
            appStateMinimal: JSON.parse(e.appStateMinimal),
            files: JSON.parse(e.files)
        }));

        const pointerEvents = this.sql.exec("SELECT * FROM pointer_events WHERE sessionId = ? ORDER BY t ASC", sessionId).toArray().map((e: any) => ({
            ...e,
            pointers: JSON.parse(e.pointers)
        }));

        return Response.json({
            boardEvents,
            pointerEvents
        });
    }

    private async getAudio(request: Request, url: URL) {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) return new Response("Session ID required", { status: 400 });

        // If chunkId provided, get one. If not, maybe stream all?
        const chunkId = url.searchParams.get('chunkId');

        if (chunkId) {
            const row = this.sql.exec("SELECT blob FROM audio_chunks WHERE sessionId = ? AND chunkId = ?", sessionId, chunkId).one();
            if (!row) return new Response("Chunk not found", { status: 404 });
            return new Response(row.blob, { headers: { 'Content-Type': 'audio/webm;codecs=opus' } });
        }

        // Return list of chunks metadata
        const chunks = this.sql.exec("SELECT sessionId, chunkId, startOffsetMs, durationMs FROM audio_chunks WHERE sessionId = ? ORDER BY chunkId ASC", sessionId).toArray();
        return Response.json(chunks);
    }
}
