
import { DurableObject } from "cloudflare:workers";

export interface Video {
    id: string;
    userId: string;
    title: string;
    description?: string;
    sessionId: string; // The Monorail Session ID
    boardId?: string; // Optional link to a board
    status: 'RECORDED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED';
    thumbnailUrl?: string; // Optional R2 URL or similar
    youtubeId?: string;
    videoUrl?: string; // YouTube URL
    createdAt: number;
    updatedAt: number;
}

export interface PaginatedVideosResponse {
    videos: Video[];
    nextCursor?: string;
    hasMore: boolean;
}

export class VideosDO extends DurableObject<Env> {
    state: DurableObjectState;
    sql: SqlStorage;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.state = ctx;
        this.sql = ctx.storage.sql;
        this.initializeTables();
        this.runMigrations();
    }

    private runMigrations() {
        // Add description column
        try {
            this.sql.exec("ALTER TABLE videos ADD COLUMN description TEXT");
        } catch (e) {
            // Column already exists
        }

        // Add board_id column for board linkage
        try {
            this.sql.exec("ALTER TABLE videos ADD COLUMN board_id TEXT");
        } catch (e) {
            // Column already exists
        }

        // Create index on board_id for faster filtering
        try {
            this.sql.exec("CREATE INDEX IF NOT EXISTS idx_videos_board_id ON videos(board_id)");
        } catch (e) {
            // Index already exists
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
            INSERT INTO videos (id, user_id, title, description, session_id, board_id, status, thumbnail_url, youtube_id, video_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, newVideo.id, newVideo.userId, newVideo.title, newVideo.description || null, newVideo.sessionId, newVideo.boardId || null, newVideo.status, newVideo.thumbnailUrl || null, newVideo.youtubeId || null, newVideo.videoUrl || null, newVideo.createdAt, newVideo.updatedAt);

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

    private mapRowToVideo(row: any): Video {
        return {
            id: row.id,
            userId: row.user_id,
            title: row.title,
            description: row.description,
            sessionId: row.session_id,
            boardId: row.board_id,
            status: row.status as Video['status'],
            thumbnailUrl: row.thumbnail_url,
            youtubeId: row.youtube_id,
            videoUrl: row.video_url,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    async listVideos(userId: string): Promise<Video[]> {
        const results = this.sql.exec("SELECT * FROM videos ORDER BY created_at DESC").toArray();
        return results.map((row: any) => this.mapRowToVideo(row));
    }

    async getVideo(id: string): Promise<Video | null> {
        const row = this.sql.exec("SELECT * FROM videos WHERE id = ?", id).one() as any;
        if (!row) return null;
        return this.mapRowToVideo(row);
    }

    async listVideosPaginated(options: {
        limit: number;
        cursor?: string;
        boardId?: string;
        status?: Video['status'];
        search?: string;
    }): Promise<PaginatedVideosResponse> {
        const { limit, cursor, boardId, status, search } = options;
        const conditions: string[] = [];
        const params: any[] = [];

        // Cursor-based pagination using created_at
        if (cursor) {
            conditions.push("created_at < ?");
            params.push(parseInt(cursor, 10));
        }

        if (boardId) {
            conditions.push("board_id = ?");
            params.push(boardId);
        }

        if (status) {
            conditions.push("status = ?");
            params.push(status);
        }

        if (search) {
            conditions.push("(title LIKE ? OR description LIKE ?)");
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern);
        }

        let query = "SELECT * FROM videos";
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        query += " ORDER BY created_at DESC LIMIT ?";
        params.push(limit + 1); // Fetch one extra to check for more

        const results = this.sql.exec(query, ...params).toArray();
        const hasMore = results.length > limit;

        if (hasMore) {
            results.pop(); // Remove the extra item
        }

        const videos = results.map((row: any) => this.mapRowToVideo(row));
        const nextCursor = hasMore && videos.length > 0
            ? videos[videos.length - 1].createdAt.toString()
            : undefined;

        return { videos, nextCursor, hasMore };
    }

    async linkToBoard(videoId: string, boardId: string): Promise<void> {
        const now = Date.now();
        this.sql.exec(`
            UPDATE videos 
            SET board_id = ?, updated_at = ?
            WHERE id = ?
        `, boardId, now, videoId);
    }
}
