import { DurableObject } from "cloudflare:workers";
import { YouTubeIntegrationDO } from "../do/YouTubeIntegrationDO";
import { MonorailSessionDO } from "./session-do";

export interface PublishState {
    publishId: string;
    monorailSessionId: string;
    userId: string;
    createdAt: number;

    chunks: {
        index: number;
        size: number;
        r2Key: string;
    }[];

    totalBytes: number;

    status: 'INIT' | 'READY' | 'UPLOADING_TO_YT' | 'DONE' | 'FAILED';
    error?: string;

    youtube?: {
        uploadUrl: string;
        bytesUploaded: number;
        videoId?: string;
    };
}

export class YouTubePublishSessionDO extends DurableObject<Env> {
    state: DurableObjectState;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.state = ctx;
    }

    async fetch(request: Request): Promise<Response> {
        // Internal communication via RPC is preferred, but for now we'll support fetch too if needed.
        // But mainly this DO will be controlled via RPC from router.
        return new Response("YouTubePublishSessionDO is active");
    }

    async getState(): Promise<PublishState | null> {
        return await this.state.storage.get<PublishState>("state") || null;
    }

    async init(monorailSessionId: string, userId: string): Promise<PublishState> {
        const existing = await this.getState();
        if (existing) {
            if (existing.monorailSessionId !== monorailSessionId) {
                throw new Error("Publish session already exists for a different monorail session");
            }
            return existing;
        }

        // Fetch metadata from MonorailSessionDO
        const monorailId = this.env.MONORAIL_SESSION_DO.idFromName(monorailSessionId);
        const monorailStub = this.env.MONORAIL_SESSION_DO.get(monorailId) as unknown as MonorailSessionDO;

        // We use the manifest endpoint or RPC if available. 
        // `MonorailSessionDO` has `getSessionState` but it doesn't return list of chunks.
        // It seems `MonorailSessionDO` doesn't track list of chunks explicitly in state, only `chunks_uploaded`.
        // BUT the HLD says: "Enumerate chunks and sizes".
        // Start of Selection
        // Since `MonorailSessionDO` writes to `monorail/{sid}/chunk-{index}.webm`, we can list from R2 directly.

        const chunks: PublishState['chunks'] = [];
        let totalBytes = 0;

        let truncated = true;
        let cursor: string | undefined;

        while (truncated) {
            const listed = await this.env.files.list({
                prefix: `monorail/${monorailSessionId}/chunk-`,
                cursor
            });

            for (const obj of listed.objects) {
                // Key format: monorail/{id}/chunk-{index}.webm
                const match = obj.key.match(/chunk-(\d+)\.webm$/);
                if (match) {
                    chunks.push({
                        index: parseInt(match[1]),
                        size: obj.size,
                        r2Key: obj.key
                    });
                    totalBytes += obj.size;
                }
            }

            truncated = listed.truncated;
            if (listed.truncated) {
                cursor = listed.cursor;
            } else {
                cursor = undefined;
            }
        }

        // Sort by index
        chunks.sort((a, b) => a.index - b.index);

        const newState: PublishState = {
            publishId: this.state.id.toString(),
            monorailSessionId,
            userId,
            createdAt: Date.now(),
            chunks,
            totalBytes,
            status: 'INIT',
        };

        await this.state.storage.put("state", newState);
        return newState;
    }

    async start(): Promise<PublishState> {
        const session = await this.getState();
        if (!session) throw new Error("Session not initialized");
        if (session.status === 'DONE') return session;

        session.status = 'READY'; // Transition to READY to indicate ready to start upload
        await this.state.storage.put("state", session);

        // Start upload process in background
        this.ctx.waitUntil(this.uploadLoop());

        return session;
    }

    async uploadLoop() {
        let session = await this.getState();
        if (!session) return;

        try {
            session.status = 'UPLOADING_TO_YT';
            if (!session.youtube) {
                session.youtube = {
                    uploadUrl: '',
                    bytesUploaded: 0
                };
            }
            await this.state.storage.put("state", session);

            // 1. Get Token
            const ytIntegrationId = this.env.YOUTUBE_INTEGRATION_DO.idFromName(session.userId);
            const ytStub = this.env.YOUTUBE_INTEGRATION_DO.get(ytIntegrationId);

            const listRes = await ytStub.fetch(`http://fake/list`);
            const listData = await listRes.json() as any;
            if (!listData.connected || listData.channels.length === 0) {
                throw new Error("No YouTube channel connected");
            }
            const channelId = listData.channels[0].channelId;

            const tokenRes = await ytStub.fetch(`http://fake/get-token?channelId=${channelId}`);

            // log the error if tokenRes is not ok
            if (!tokenRes.ok) {
                console.error("Failed to get token", await tokenRes.text());
                throw new Error("Failed to get token");
            }


            const { accessToken } = await tokenRes.json() as any;

            // 2. Create Resumable Upload Session if not exists
            if (!session.youtube.uploadUrl) {
                const metadata = {
                    snippet: {
                        title: `Monorail Recording ${session.monorailSessionId}`,
                        description: "Uploaded via Monorail",
                    },
                    status: {
                        privacyStatus: "private"
                    }
                };

                const initRes = await fetch(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'X-Upload-Content-Length': session.totalBytes.toString()
                    },
                    body: JSON.stringify(metadata)
                });

                if (!initRes.ok) {
                    const error = await initRes.text();
                    throw new Error(`Failed to init upload: ${error}`);
                }

                const uploadUrl = initRes.headers.get("Location");
                if (!uploadUrl) throw new Error("No upload URL returned");

                session.youtube.uploadUrl = uploadUrl;
                await this.state.storage.put("state", session);
            }

            // 3. Upload Loop
            const MIN_UPLOAD_SIZE = 256 * 1024;
            // Aim for efficient chunks (e.g. ~5MB) to reduce round trips and satisfy Google's multiple requirement
            const PREFERRED_CHUNK_SIZE = 5 * 1024 * 1024;

            while (true) {
                if ((session as PublishState).status === 'DONE' || (session as PublishState).status === 'FAILED') break;
                const startOffset = session.youtube.bytesUploaded;

                if (startOffset >= session.totalBytes) {
                    // Double check with server?
                    const statusCheck = await fetch(session.youtube.uploadUrl, {
                        method: "PUT",
                        headers: { "Content-Range": `bytes */${session.totalBytes}` }
                    });
                    if (statusCheck.status === 200 || statusCheck.status === 201) {
                        const data = await statusCheck.json() as any;
                        session.status = 'DONE';
                        session.youtube.videoId = data.id;
                        await this.state.storage.put("state", session);
                        return;
                    }
                    // If incomplete, it will return 308 with Range
                    if (statusCheck.status === 308) {
                        const range = statusCheck.headers.get("Range");
                        if (range) {
                            const match = range.match(/bytes=0-(\d+)/);
                            if (match) {
                                session.youtube.bytesUploaded = parseInt(match[1]) + 1;
                                await this.state.storage.put("state", session);
                                if (session.youtube.bytesUploaded >= session.totalBytes) continue; // Loop again to finish
                            }
                        }
                    }

                    if (startOffset >= session.totalBytes && (session as PublishState).status !== 'DONE') {
                        // Force finish check again or assume done?
                        // It's possible we uploaded everything but missed the 200 OK.
                        // But the status check above should have handled it.
                        // If we are still here, and status check was 308 with full range? Rare.
                        session.status = 'DONE';
                        await this.state.storage.put("state", session);
                        break;
                    }
                }

                // Gather Data from R2
                let buffer = new Uint8Array(0);

                let currentPos = 0;
                for (const chunk of session.chunks) {
                    const chunkStart = currentPos;
                    const chunkEnd = currentPos + chunk.size;
                    currentPos += chunk.size;

                    // If overlapping with needed range
                    if (chunkEnd <= startOffset) continue;

                    if (buffer.length >= PREFERRED_CHUNK_SIZE) break;

                    const readStart = Math.max(chunkStart, startOffset + buffer.length);
                    // R2 range usage
                    const offsetInChunk = readStart - chunkStart;
                    const len = chunk.size - offsetInChunk;

                    if (len > 0) {
                        const r2Obj = await this.env.files.get(chunk.r2Key, {
                            range: { offset: offsetInChunk }
                        });
                        if (!r2Obj) throw new Error(`Missing R2 chunk ${chunk.r2Key}`);

                        const chunkData = new Uint8Array(await r2Obj.arrayBuffer());

                        const newBuf = new Uint8Array(buffer.length + chunkData.length);
                        newBuf.set(buffer);
                        newBuf.set(chunkData, buffer.length);
                        buffer = newBuf;
                    }
                }

                if (buffer.length === 0) {
                    // No more data found, but not done?
                    if (startOffset < session.totalBytes) {
                        throw new Error(`Data starvation at ${startOffset}/${session.totalBytes}`);
                    }
                    break;
                }

                // Upload Buffer
                const uploadEnd = startOffset + buffer.length;
                const contentRange = `bytes ${startOffset}-${uploadEnd - 1}/${session.totalBytes}`;

                const uploadRes = await fetch(session.youtube.uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Length': buffer.length.toString(),
                        'Content-Range': contentRange
                    },
                    body: buffer
                });

                if (uploadRes.status === 308) {
                    // Resume / Advance
                    const range = uploadRes.headers.get("Range");
                    if (range) {
                        const match = range.match(/bytes=0-(\d+)/);
                        if (match) {
                            session.youtube.bytesUploaded = parseInt(match[1]) + 1;
                        }
                    }
                    await this.state.storage.put("state", session);
                } else if (uploadRes.status === 200 || uploadRes.status === 201) {
                    // Done
                    const data = await uploadRes.json() as any;
                    session.status = 'DONE';
                    session.youtube.videoId = data.id;
                    session.youtube.bytesUploaded = session.totalBytes;
                    await this.state.storage.put("state", session);
                    return;
                } else {
                    // Error, attempt re-sync logic next loop by checking status
                    // Query status to re-sync
                    const statusCheck = await fetch(session.youtube.uploadUrl, {
                        method: "PUT",
                        headers: { "Content-Range": `bytes */${session.totalBytes}` }
                    });

                    if (statusCheck.status === 308) {
                        const range = statusCheck.headers.get("Range");
                        if (range) {
                            const match = range.match(/bytes=0-(\d+)/);
                            if (match) {
                                session.youtube.bytesUploaded = parseInt(match[1]) + 1;
                                await this.state.storage.put("state", session);
                                continue;
                            }
                        }
                        session.youtube.bytesUploaded = 0;
                        await this.state.storage.put("state", session);
                        continue;
                    }

                    const errorText = await uploadRes.text();
                    throw new Error(`Upload failed ${uploadRes.status}: ${errorText}`);
                }
            }

        } catch (e: any) {
            console.error(e);
            session.status = 'FAILED';
            session.error = e.message;
            await this.state.storage.put("state", session);
        }
    }
}
