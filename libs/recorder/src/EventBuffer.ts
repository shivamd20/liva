export class EventBuffer<T> {
    private buffer: T[] = [];
    private flushThreshold: number;
    private onFlush: (events: T[]) => Promise<void>;

    constructor(flushThreshold: number, onFlush: (events: T[]) => Promise<void>) {
        this.flushThreshold = flushThreshold;
        this.onFlush = onFlush;
    }

    push(event: T) {
        this.buffer.push(event);
        if (this.buffer.length >= this.flushThreshold) {
            this.flush();
        }
    }

    async flush() {
        if (this.buffer.length === 0) return;
        const events = [...this.buffer];
        this.buffer = [];
        try {
            await this.onFlush(events);
        } catch (error) {
            console.error('Failed to flush buffer', error);
            // Re-queue events on failure? Or dropped? 
            // Ideally we retry, but for now simple log.
        }
    }

    clear() {
        this.buffer = [];
    }
}
