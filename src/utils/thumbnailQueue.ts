
type Task = () => Promise<void>;

interface IdleDeadline {
    didTimeout: boolean;
    timeRemaining: () => number;
}

interface WindowWithIdle extends Window {
    requestIdleCallback: (
        callback: (deadline: IdleDeadline) => void,
        options?: { timeout: number }
    ) => number;
}

class ThumbnailQueue {
    private queue: Task[] = [];
    private isProcessing = false;

    enqueue(task: Task) {
        this.queue.push(task);
        this.processQueue();
    }

    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;

        const task = this.queue.shift();
        if (!task) {
            this.isProcessing = false;
            return;
        }

        const runTask = async () => {
            try {
                await task();
            } catch (error) {
                console.error("Error generating thumbnail:", error);
            } finally {
                this.isProcessing = false;
                // Schedule next task with a small delay to yield to main thread
                setTimeout(() => this.processQueue(), 50);
            }
        };

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as unknown as WindowWithIdle).requestIdleCallback(() => {
                runTask();
            });
        } else {
            setTimeout(runTask, 50);
        }
    }
}

export const thumbnailQueue = new ThumbnailQueue();
