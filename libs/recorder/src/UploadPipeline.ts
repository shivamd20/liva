import { AudioChunk, BoardEvent, PointerEvent, Manifest } from './types';

export class UploadPipeline {
    private endpoint: string;
    private sessionId: string;

    constructor(endpoint: string, sessionId: string) {
        this.endpoint = endpoint;
        this.sessionId = sessionId;
    }

    async uploadAudioChunk(chunk: AudioChunk) {
        const formData = new FormData();
        formData.append('sessionId', chunk.sessionId);
        formData.append('chunkId', chunk.chunkId.toString());
        formData.append('startOffsetMs', chunk.startOffsetMs.toString());
        formData.append('durationMs', chunk.durationMs.toString());
        formData.append('file', chunk.blob);

        await this.post('audio', formData);
    }

    async uploadBoardEvents(events: BoardEvent[]) {
        if (events.length === 0) return;
        await this.postJson('board', { sessionId: this.sessionId, events });
    }

    async uploadPointerEvents(events: PointerEvent[]) {
        if (events.length === 0) return;
        await this.postJson('pointer', { sessionId: this.sessionId, events });
    }

    async uploadManifest(manifest: Manifest) {
        await this.postJson('manifest', manifest);
    }

    private async postJson(type: string, data: any) {
        // Mock upload if endpoint is localhost and not 8787 (workers)
        // Actually, let's just fetch
        try {
            const res = await fetch(`${this.endpoint}/${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        } catch (e) {
            console.error(`Failed to upload ${type}`, e);
        }
    }

    private async post(type: string, body: FormData) {
        try {
            const res = await fetch(`${this.endpoint}/${type}`, {
                method: 'POST',
                body: body,
            });
            if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        } catch (e) {
            console.error(`Failed to upload ${type}`, e);
        }
    }
}
