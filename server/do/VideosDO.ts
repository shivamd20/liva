
import { DurableObject } from "cloudflare:workers";

export interface Video {
    id: string;
    userId: string;
    title: string;
    description?: string;
    sessionId: string; // The Monorail Session ID
    status: 'RECORDED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED';
    thumbnailUrl?: string; // Optional R2 URL or similar
    youtubeId?: string;
    videoUrl?: string; // YouTube URL
    createdAt: number;
    updatedAt: number;
}

export class VideosDO extends DurableObject<Env> {
    state: DurableObjectState;
    sql: SqlStorage;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.state = ctx;
        this.sql = ctx.storage.sql;
        this.initializeTables();
        this.ensureDefinitionColumn();
    }

    private ensureDefinitionColumn() {
        try {
            this.sql.exec("ALTER TABLE videos ADD COLUMN description TEXT");
        } catch (e) {
            // Check if error is because column exists, or just ignore if it's "duplicate column name"
        }
    }

    private initializeTables() {
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS videos (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT,
                description TEXT,
                session_id TEXT NOT NULL,
                status TEXT,
                thumbnail_url TEXT,
                youtube_id TEXT,
                video_url TEXT,
                created_at INTEGER,
                updated_at INTEGER
            );
        `);
    }

    async fetch(request: Request): Promise<Response> {
        // Internal RPC usage preferred, but fetch handler for basic interaction if needed
        return new Response("VideosDO Active");
    }

    async createVideo(video: Omit<Video, 'createdAt' | 'updatedAt'>): Promise<Video> {
        const now = Date.now();
        const newVideo: Video = {
            ...video,
            createdAt: now,
            updatedAt: now
        };

        this.sql.exec(`
            INSERT INTO videos (id, user_id, title, description, session_id, status, thumbnail_url, youtube_id, video_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, newVideo.id, newVideo.userId, newVideo.title, newVideo.description || null, newVideo.sessionId, newVideo.status, newVideo.thumbnailUrl || null, newVideo.youtubeId || null, newVideo.videoUrl || null, newVideo.createdAt, newVideo.updatedAt);

        return newVideo;
    }

    async updateMetadata(id: string, title: string, description?: string): Promise<void> {
        const now = Date.now();
        this.sql.exec(`
            UPDATE videos 
            SET title = ?, description = ?, updated_at = ?
            WHERE id = ?
        `, title, description || null, now, id);
    }

    async updateStatus(id: string, status: Video['status'], youtubeId?: string, videoUrl?: string): Promise<void> {
        const now = Date.now();
        if (youtubeId && videoUrl) {
            this.sql.exec(`
                UPDATE videos 
                SET status = ?, youtube_id = ?, video_url = ?, updated_at = ?
                WHERE id = ?
            `, status, youtubeId, videoUrl, now, id);
        } else {
            this.sql.exec(`
                UPDATE videos 
                SET status = ?, updated_at = ?
                WHERE id = ?
            `, status, now, id);
        }
    }

    async listVideos(userId: string): Promise<Video[]> {
        // Since VideosDO is per-user (idFromName(userId)), we actually just need everything in this DO.
        // But if we decide to make it a global DO later, the userId fliter is good practice.
        // Wait, for Scalability, per-user DO is best.

        const results = this.sql.exec("SELECT * FROM videos ORDER BY created_at DESC").toArray();
        return results.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            title: row.title,
            description: row.description,
            sessionId: row.session_id,
            status: row.status as Video['status'],
            thumbnailUrl: row.thumbnail_url,
            youtubeId: row.youtube_id,
            videoUrl: row.video_url,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    }

    async getVideo(id: string): Promise<Video | null> {
        const row = this.sql.exec("SELECT * FROM videos WHERE id = ?", id).one() as any;
        if (!row) return null;
        return {
            id: row.id,
            userId: row.user_id,
            title: row.title,
            description: row.description,
            sessionId: row.session_id,
            status: row.status as Video['status'],
            thumbnailUrl: row.thumbnail_url,
            youtubeId: row.youtube_id,
            videoUrl: row.video_url,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}
