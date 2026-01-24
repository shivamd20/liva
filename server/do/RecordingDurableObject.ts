
import { DurableObject } from "cloudflare:workers";

export class RecordingDurableObject extends DurableObject {
    private sql: any;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        this.initializeTables();
    }

    private initializeTables() {
        // Drop old table if exists to force schema update in dev
        // In prod, use migrations. For now this is fine for dev loop.
        try {
            // check if 'pointers' column exists, if so drop table?
            // simple heuristic: drop table pointer_events to reset schema
            // or just CREATE TABLE IF NOT EXISTS with new schema (won't alter existing)
            // Let's brute force drop for this dev iteration to ensure fresh schema
            // this.sql.exec("DROP TABLE IF EXISTS pointer_events");
        } catch (e) { }

        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS audio_chunks (
                sessionId TEXT,
                chunkId INTEGER,
                startOffsetMs INTEGER,
                durationMs INTEGER,
                blob BLOB,
                PRIMARY KEY (sessionId, chunkId)
            )
        `);

        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS board_events (
                sessionId TEXT,
                t INTEGER,
                type TEXT,
                elements TEXT,
                appStateMinimal TEXT,
                files TEXT
            )
        `);

        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS pointer_events (
                sessionId TEXT,
                t INTEGER,
                pointer TEXT,
                pointersMap TEXT,
                button TEXT
            )
        `);

        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS manifest (
                sessionId TEXT PRIMARY KEY,
                userId TEXT,
                startedAt INTEGER,
                endedAt INTEGER,
                audioChunks INTEGER,
                boardEventCount INTEGER,
                pointerEventCount INTEGER,
                status TEXT
            )
        `);

        // Migration: Add userId column if missing (for existing dev tables)
        try {
            this.sql.exec("ALTER TABLE manifest ADD COLUMN userId TEXT");
        } catch (e) {
            // modifications to simple schema
        }
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method;
        const path = url.pathname;

        try {
            const userId = request.headers.get("X-Liva-User-Id");


            if (path.endsWith('/upload/audio')) {
                return this.uploadAudio(request, userId);
            } else if (path.endsWith('/upload/board')) {
                return this.uploadBoard(request, userId);
            } else if (path.endsWith('/upload/pointer')) {
                return this.uploadPointer(request, userId);
            } else if (path.endsWith('/upload/manifest')) {
                return this.uploadManifest(request, userId);
            } else if (path.includes('/download/manifest')) {
                return this.getManifest(request, userId);
            } else if (path.includes('/download/audio')) {
                return this.getAudio(request, url, userId);
            } else if (path.includes('/download/events')) {
                return this.getEvents(request, userId);
            }

            return new Response("Not Found", { status: 404 });
        } catch (e: any) {
            console.error("Recording DO Error", e);
            return new Response("Internal Error: " + e.message, { status: 500 });
        }
    }

    private async uploadAudio(request: Request, userId: string | null) {
        if (!userId) return new Response("Unauthorized", { status: 401 });

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

    private async uploadBoard(request: Request, userId: string | null) {
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const body = await request.json() as any;
        const { sessionId, events } = body;

        for (const e of events) {
            this.sql.exec(`
                INSERT INTO board_events (sessionId, t, type, elements, appStateMinimal, files)
                VALUES (?, ?, ?, ?, ?, ?)
            `, sessionId, e.t, e.type, JSON.stringify(e.elements), JSON.stringify(e.appStateMinimal || {}), JSON.stringify(e.files || null));
        }

        return new Response('OK');
    }

    private async uploadPointer(request: Request, userId: string | null) {
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const body = await request.json() as any;
        const { sessionId, events } = body;

        for (const e of events) {
            // Check if column exists, if not maybe fallback? 
            // In dev environment, table might be old.
            // Let's try inserting into new columns.
            try {
                this.sql.exec(`
                    INSERT INTO pointer_events (sessionId, t, pointer, pointersMap, button)
                    VALUES (?, ?, ?, ?, ?)
                `, sessionId, e.t, JSON.stringify(e.pointer), JSON.stringify(e.pointersMap || {}), e.button || 'up');
            } catch (err) {
                // Determine if error is due to missing column
                // If so, maybe drop table and retry?
                // This is drastic but effective for dev.
                try {
                    this.sql.exec("DROP TABLE pointer_events");
                    this.sql.exec(`
                        CREATE TABLE pointer_events (
                            sessionId TEXT,
                            t INTEGER,
                            pointer TEXT,
                            pointersMap TEXT,
                            button TEXT
                        )
                   `);
                    this.sql.exec(`
                        INSERT INTO pointer_events (sessionId, t, pointer, pointersMap, button)
                        VALUES (?, ?, ?, ?, ?)
                    `, sessionId, e.t, JSON.stringify(e.pointer), JSON.stringify(e.pointersMap || {}), e.button || 'up');
                } catch (e) {
                    console.error("Failed to migrate pointer table", e);
                }
            }
        }

        return new Response('OK');
    }

    private async uploadManifest(request: Request, userId: string | null) {
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const manifest = await request.json() as any;
        this.sql.exec(`
            INSERT OR REPLACE INTO manifest (sessionId, userId, startedAt, endedAt, audioChunks, boardEventCount, pointerEventCount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, manifest.sessionId, userId, manifest.startedAt, manifest.endedAt, manifest.audioChunks, manifest.boardEventCount, manifest.pointerEventCount, manifest.status);
        return new Response('OK');
    }

    private async checkAuth(sessionId: string, userId: string | null): Promise<boolean> {
        if (!userId) return false;
        const result = this.sql.exec("SELECT userId FROM manifest WHERE sessionId = ?", sessionId).one();
        if (!result) return false; // Session doesn't exist?
        if (!result.userId) return true; // Legacy session without owner? Allow or Deny? Deny for security.
        return result.userId === userId;
    }

    private async getManifest(request: Request, userId: string | null) {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) return new Response("Session ID required", { status: 400 });

        // Security Check
        const authorized = await this.checkAuth(sessionId, userId);
        if (!authorized) return new Response("Unauthorized", { status: 403 });

        const manifest = this.sql.exec("SELECT * FROM manifest WHERE sessionId = ?", sessionId).one();
        if (!manifest) return new Response("Session not found", { status: 404 });

        return Response.json(manifest);
    }

    private async getEvents(request: Request, userId: string | null) {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) return new Response("Session ID required", { status: 400 });

        // Security Check
        const authorized = await this.checkAuth(sessionId, userId);
        if (!authorized) return new Response("Unauthorized", { status: 403 });

        const boardEvents = this.sql.exec("SELECT * FROM board_events WHERE sessionId = ? ORDER BY t ASC", sessionId).toArray().map((e: any) => ({
            ...e,
            elements: JSON.parse(e.elements),
            appStateMinimal: JSON.parse(e.appStateMinimal),
            files: JSON.parse(e.files || 'null')
        }));

        const pointerEvents = this.sql.exec("SELECT * FROM pointer_events WHERE sessionId = ? ORDER BY t ASC", sessionId).toArray().map((e: any) => ({
            ...e,
            pointer: e.pointer ? JSON.parse(e.pointer) : { x: 0, y: 0 },
            pointersMap: e.pointersMap ? JSON.parse(e.pointersMap) : {}
        }));

        return Response.json({
            boardEvents,
            pointerEvents
        });
    }

    private async getAudio(request: Request, url: URL, userId: string | null) {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) return new Response("Session ID required", { status: 400 });

        const chunkId = url.searchParams.get('chunkId');

        // Security Check
        const authorized = await this.checkAuth(sessionId, userId);
        if (!authorized) return new Response("Unauthorized", { status: 403 });

        if (chunkId) {
            const row = this.sql.exec("SELECT blob FROM audio_chunks WHERE sessionId = ? AND chunkId = ?", sessionId, chunkId).one();
            if (!row) return new Response("Chunk not found", { status: 404 });
            return new Response(row.blob, { headers: { 'Content-Type': 'audio/webm;codecs=opus' } });
        }

        const chunks = this.sql.exec("SELECT sessionId, chunkId, startOffsetMs, durationMs FROM audio_chunks WHERE sessionId = ? ORDER BY chunkId ASC", sessionId).toArray();
        return Response.json(chunks);
    }
}
