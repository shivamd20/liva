import { DurableObject } from "cloudflare:workers";

interface Event {
    id: string;
    timestamp: number;
    type: "text_in" | "text_out" | "audio_in" | "audio_out" | "video_frame" | "summary" | "tool_result";
    payload: string; // Base64 or text
    metadata: string; // JSON string
}

interface State {
    key: string;
    value: string;
}

export class ConversationDurableObject extends DurableObject {
    private sql: any;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        this.initializeTables();
    }

    private initializeTables() {
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                timestamp INTEGER,
                type TEXT,
                payload BLOB,
                metadata TEXT
            );
            CREATE TABLE IF NOT EXISTS state (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);
    }

    async fetch(request: Request): Promise<Response> {
        const userId = request.headers.get("X-Liva-User-Id");
        if (!userId) {
            return new Response("Unauthorized", { status: 401 });
        }

        const creatorId = this.getState("creator_id");
        if (!creatorId) {
            this.setState("creator_id", userId);
        } else if (creatorId !== userId) {
            return new Response("Forbidden", { status: 403 });
        }

        const url = new URL(request.url);

        if (request.method === "POST" && url.pathname === "/append") {
            return this.append(request);
        } else if (request.method === "GET" && url.pathname === "/events") {
            return this.getEvents(request);
        } else if (request.method === "POST" && url.pathname === "/summarize") {
            return this.summarize(request);
        } else if (request.method === "GET" && url.pathname === "/history") {
            return this.getHistory(request);
        } else if (request.method === "DELETE" && url.pathname === "/conversation") {
            return this.deleteConversation(request);
        } else if (request.method === "GET" && url.pathname === "/debug/verify") {
            return this.verifyDb();
        }

        return new Response("Not Found", { status: 404 });
    }

    private async append(request: Request): Promise<Response> {
        const data = await request.json() as any;
        const id = crypto.randomUUID();
        const timestamp = Date.now();
        const { type, payload, metadata } = data;

        this.sql.exec(`
            INSERT INTO events (id, timestamp, type, payload, metadata)
            VALUES (?, ?, ?, ?, ?)
        `, id, timestamp, type, payload, JSON.stringify(metadata || {}));

        // Trigger transcription for audio events
        if (type === 'audio_in' || type === 'audio_out') {
            this.ctx.waitUntil(this.transcribeAudio(id, payload));
        }

        return Response.json({ id, timestamp });
    }

    private async transcribeAudio(id: string, base64Audio: string) {
        try {
            // Check for AI binding
            const ai = (this.env as any).AI;
            if (!ai) {
                console.warn("AI binding not found in Env");
                return;
            }

            // Simple base64 decode
            const base64 = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const response = await ai.run('@cf/openai/whisper', {
                audio: [...bytes]
            });

            if (response && response.text) {
                // Fetch latest metadata to avoid overwriting other changes
                const result = this.sql.exec("SELECT metadata FROM events WHERE id = ?", id).toArray();
                if (result.length > 0) {
                    const currentMetadata = JSON.parse(result[0].metadata);
                    currentMetadata.transcript = response.text.trim();
                    this.sql.exec("UPDATE events SET metadata = ? WHERE id = ?", JSON.stringify(currentMetadata), id);
                }
            }
        } catch (err) {
            console.error("Transcription error:", err);
        }
    }

    private async getEvents(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const from = url.searchParams.get("from");
        const limit = parseInt(url.searchParams.get("limit") || "50");

        let query = "SELECT * FROM events";
        const params: any[] = [];

        if (from) {
            // Logic to get events after a specific ID is tricky without order, 
            // assuming timestamp order for now or just simple offset if from isn't ideal.
            // Better: "SELECT * FROM events WHERE timestamp > (SELECT timestamp FROM events WHERE id = ?)"
            // But for simplicity of this version:
            query += " WHERE timestamp > (SELECT timestamp FROM events WHERE id = ?)";
            params.push(from);
        }

        query += " ORDER BY timestamp ASC LIMIT ?";
        params.push(limit);

        const events = this.sql.exec(query, ...params).toArray();
        // Decode metadata
        const results = events.map((e: any) => ({
            ...e,
            metadata: JSON.parse(e.metadata)
        }));

        return Response.json(results);
    }

    private async summarize(request: Request): Promise<Response> {
        // Stub implementation as requested
        const lastSummaryCursor = this.getState("summary_cursor");

        // 1. Load unsummarized events (mock logic: all events for now if needed, or just new ones)
        // For stub: just mark everything as summarized by creating a summary event

        const summaryId = crypto.randomUUID();
        const summaryEvent = {
            type: "summary",
            payload: "This is a mock summary of the conversation.",
            metadata: { covers: ["all_previous"] }
        };

        // Insert summary
        this.sql.exec(`INSERT INTO events (id, timestamp, type, payload, metadata) VALUES (?, ?, ?, ?, ?)`,
            summaryId, Date.now(), summaryEvent.type, summaryEvent.payload, JSON.stringify(summaryEvent.metadata));

        // Update cursor
        this.setState("summary_cursor", summaryId);

        return Response.json({ summaryId });
    }

    private async getHistory(request: Request): Promise<Response> {
        // Returns compacted history: summary + recent events
        // For now, just return all for checking
        return this.getEvents(request);
    }

    private async deleteConversation(request: Request): Promise<Response> {
        this.sql.exec("DELETE FROM events");
        this.sql.exec("DELETE FROM state");
        return new Response("Deleted", { status: 200 });
    }

    private async verifyDb(): Promise<Response> {
        const eventCount = this.sql.exec("SELECT COUNT(*) as count FROM events").one().count;
        const allEvents = this.sql.exec("SELECT * FROM events LIMIT 5").toArray();
        return Response.json({
            eventCount,
            sampleEvents: allEvents
        });
    }

    // Helper utilities
    private getState(key: string): string | null {
        const result = this.sql.exec("SELECT value FROM state WHERE key = ?", key).toArray();
        return result.length > 0 ? result[0].value : null;
    }

    private setState(key: string, value: string) {
        this.sql.exec("INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)", key, value);
    }
}
