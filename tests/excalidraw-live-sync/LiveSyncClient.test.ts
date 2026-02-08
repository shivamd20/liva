import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiveSyncClient, LiveSyncBoard } from '../../libs/excalidraw-live-sync/src/LiveSyncClient';

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];

  onopen: ((event?: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  send(data: string) {
    this.sent.push(data);
  }

  message(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  close(code = 1000) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  }
}

const buildBoard = (overrides: Partial<LiveSyncBoard> = {}): LiveSyncBoard => ({
  id: 'board-1',
  title: 'Board',
  excalidrawElements: [],
  files: {},
  updatedAt: 1,
  ...overrides,
});

describe('LiveSyncClient', () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      location: { protocol: 'https:', host: 'example.com' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
    vi.stubGlobal('navigator', originalNavigator);
    vi.stubGlobal('window', originalWindow);
  });

  it('connects on subscribe and emits initial updates', () => {
    const client = new LiveSyncClient();
    client.setBaseUrl('https://liva.shvm.in');
    client.setUserId('user-1');

    const handler = vi.fn();
    client.subscribe('board-1', handler);

    expect(FakeWebSocket.instances).toHaveLength(1);
    const socket = FakeWebSocket.instances[0];
    socket.open();

    socket.message({
      type: 'initial',
      sessionId: 'session-1',
      data: buildBoard(),
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'board-1' }));
  });

  it('filters ephemeral messages from the same session', () => {
    const client = new LiveSyncClient();
    client.setBaseUrl('https://liva.shvm.in');
    client.setUserId('user-1');

    const handler = vi.fn();
    client.subscribeEphemeral('board-1', handler);

    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.message({
      type: 'initial',
      sessionId: 'session-1',
      data: buildBoard(),
    });

    socket.message({
      type: 'ephemeral',
      senderId: 'session-1',
      data: { type: 'pointer' },
    });

    socket.message({
      type: 'ephemeral',
      senderId: 'session-2',
      data: { type: 'pointer' },
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('schedules a reconnect after an unexpected close', () => {
    const client = new LiveSyncClient();
    client.setBaseUrl('https://liva.shvm.in');
    client.setUserId('user-1');

    client.subscribe('board-1', vi.fn());
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.close(1006);

    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.runOnlyPendingTimers();
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('disconnects when the last subscriber unsubscribes', () => {
    const client = new LiveSyncClient();
    client.setBaseUrl('https://liva.shvm.in');
    client.setUserId('user-1');

    const unsubscribe = client.subscribe('board-1', vi.fn());
    const socket = FakeWebSocket.instances[0];
    socket.open();

    unsubscribe();
    expect(client.getConnectionStatus('board-1')).toBe('disconnected');
  });

  it('sends updates when the socket is open', () => {
    const client = new LiveSyncClient();
    client.setBaseUrl('https://liva.shvm.in');
    client.setUserId('user-1');

    client.subscribe('board-1', vi.fn());
    const socket = FakeWebSocket.instances[0];
    socket.open();

    client.sendUpdate(buildBoard({ title: 'Updated' }));
    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toContain('update_event');
  });
});
