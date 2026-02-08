import { describe, it, expect } from 'vitest';
import { OfflineUpdateQueue, MemoryStorageAdapter } from '../../libs/excalidraw-live-sync/src/offline/OfflineQueue';

describe('OfflineUpdateQueue', () => {
  it('stores and returns queued updates', () => {
    const adapter = new MemoryStorageAdapter();
    const queue = new OfflineUpdateQueue<string>({ adapter, storageKey: 'queue' });

    queue.enqueue('first');
    queue.enqueue('second');

    expect(queue.size()).toBe(2);
    expect(queue.peekAll()).toEqual(['first', 'second']);
  });

  it('flushes updates in order', async () => {
    const adapter = new MemoryStorageAdapter();
    const queue = new OfflineUpdateQueue<number>({ adapter, storageKey: 'queue' });

    queue.enqueue(1);
    queue.enqueue(2);

    const sent: number[] = [];
    await queue.flush(async (update) => {
      sent.push(update);
    });

    expect(sent).toEqual([1, 2]);
    expect(queue.size()).toBe(0);
  });

  it('preserves remaining updates on failure', async () => {
    const adapter = new MemoryStorageAdapter();
    const queue = new OfflineUpdateQueue<number>({ adapter, storageKey: 'queue' });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    const sent: number[] = [];
    await queue.flush(async (update) => {
      sent.push(update);
      if (update === 2) {
        throw new Error('network');
      }
    });

    expect(sent).toEqual([1, 2]);
    expect(queue.peekAll()).toEqual([2, 3]);
  });
});
