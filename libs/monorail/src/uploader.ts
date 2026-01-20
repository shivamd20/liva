
export interface UploadConfig {
    sessionId: string;
    apiBaseUrl: string; // Base URL of the Monorail TRPC/API
    getUploadUrl: (chunkIndex: number) => Promise<string>;
    onUploadError?: (error: Error) => void;
}

export class MonorailUploader {
    private queue: { chunk: Blob; index: number }[] = [];
    private uploading = false;
    private failed = false;

    constructor(private config: UploadConfig) { }

    queueChunk(chunk: Blob, index: number) {
        this.queue.push({ chunk, index });
        this.processQueue();
    }

    /**
     * Wait for all pending uploads to complete
     * Returns a promise that resolves when queue is empty
     */
    async waitForPendingUploads(timeoutMs: number = 30000): Promise<void> {
        const startTime = Date.now();

        while (this.queue.length > 0 || this.uploading) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Upload timeout: ${this.queue.length} chunks still pending`);
            }

            // Wait 100ms before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.failed) {
            throw new Error('Upload failed');
        }
    }

    private async processQueue() {
        if (this.uploading || this.queue.length === 0 || this.failed) return;

        this.uploading = true;
        const item = this.queue[0];

        try {
            const uploadUrl = await this.config.getUploadUrl(item.index);

            await fetch(uploadUrl, {
                method: "PUT",
                body: item.chunk,
            });

            // Success, remove from queue
            this.queue.shift();
            this.uploading = false;

            // Process next
            this.processQueue();
        } catch (e) {
            console.error("Upload failed for chunk", item.index, e);
            // Retry logic could be added here. For now we pause.
            // this.failed = true; 
            // this.config.onUploadError?.(e as Error);

            this.uploading = false;
            // Simple retry after delay
            setTimeout(() => this.processQueue(), 2000);
        }
    }
}
