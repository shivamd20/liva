export interface OfflineStorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export class LocalStorageAdapter implements OfflineStorageAdapter {
    getItem(key: string): string | null {
        return window.localStorage.getItem(key);
    }

    setItem(key: string, value: string): void {
        window.localStorage.setItem(key, value);
    }

    removeItem(key: string): void {
        window.localStorage.removeItem(key);
    }
}

export class MemoryStorageAdapter implements OfflineStorageAdapter {
    private store = new Map<string, string>();

    getItem(key: string): string | null {
        return this.store.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.store.set(key, value);
    }

    removeItem(key: string): void {
        this.store.delete(key);
    }
}

export interface OfflineQueueOptions {
    storageKey?: string;
    adapter?: OfflineStorageAdapter;
}

export class OfflineUpdateQueue<T = unknown> {
    private storageKey: string;
    private adapter: OfflineStorageAdapter;

    constructor({ storageKey = 'liva.offline.queue', adapter }: OfflineQueueOptions = {}) {
        this.storageKey = storageKey;
        this.adapter = adapter ?? this.createDefaultAdapter();
    }

    enqueue(update: T): void {
        const queue = this.readQueue();
        queue.push(update);
        this.writeQueue(queue);
    }

    peekAll(): T[] {
        return this.readQueue();
    }

    size(): number {
        return this.readQueue().length;
    }

    clear(): void {
        this.adapter.removeItem(this.storageKey);
    }

    async flush(send: (update: T) => Promise<void> | void): Promise<void> {
        const queue = this.readQueue();
        if (queue.length === 0) return;

        const remaining: T[] = [];
        for (let index = 0; index < queue.length; index += 1) {
            const update = queue[index];
            try {
                await send(update);
            } catch (error) {
                remaining.push(update);
                remaining.push(...queue.slice(index + 1));
                break;
            }
        }

        if (remaining.length === 0) {
            this.clear();
        } else {
            this.writeQueue(remaining);
        }
    }

    private createDefaultAdapter(): OfflineStorageAdapter {
        if (typeof window !== 'undefined' && window.localStorage) {
            return new LocalStorageAdapter();
        }
        return new MemoryStorageAdapter();
    }

    private readQueue(): T[] {
        const raw = this.adapter.getItem(this.storageKey);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    private writeQueue(queue: T[]): void {
        this.adapter.setItem(this.storageKey, JSON.stringify(queue));
    }
}
