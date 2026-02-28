import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor, fromCallback, type InspectionEvent } from "xstate";
import { sessionWebSocketMachine } from "../sessionWebSocket.machine";

function setupGlobals() {
  if (typeof globalThis.document === "undefined") {
    (globalThis as any).document = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: "visible",
    };
  }
  if (typeof globalThis.WebSocket === "undefined") {
    (globalThis as any).WebSocket = class MockWS {
      static OPEN = 1;
      static CLOSED = 3;
      static CLOSING = 2;
      static CONNECTING = 0;
      readyState = 3;
      binaryType = "blob";
      bufferedAmount = 0;
      onopen: (() => void) | null = null;
      onclose: ((ev: any) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((ev: any) => void) | null = null;
      send = vi.fn();
      close = vi.fn();
    };
  }
}

const noopCallback = fromCallback(() => () => {});
const noop = () => {};

function createTestSession(overrides?: { maxRetries?: number }) {
  const parentEvents: any[] = [];

  const machine = sessionWebSocketMachine.provide({
    actors: {
      wsBridge: noopCallback as any,
      visibilityListener: noopCallback as any,
    },
    actions: {
      forwardJsonToParent: noop as any,
      forwardBinaryToParent: noop as any,
      notifyConnected: ({ self }: any) => {
        parentEvents.push({ type: "SESSION_STATUS_CHANGED", status: "connected" });
      },
      notifyDisconnected: ({ self }: any) => {
        parentEvents.push({ type: "SESSION_STATUS_CHANGED", status: "disconnected" });
      },
      notifyConnecting: ({ self }: any) => {
        parentEvents.push({ type: "SESSION_STATUS_CHANGED", status: "connecting" });
      },
      notifyError: ({ self }: any) => {
        parentEvents.push({ type: "SESSION_STATUS_CHANGED", status: "error" });
      },
    },
  });

  const actor = createActor(machine, {
    input: {
      buildUrl: () => "ws://localhost:8080/test",
      reconnect: { maxRetries: overrides?.maxRetries ?? 5 },
    },
  });

  actor.start();
  return { actor, parentEvents };
}

function snap(a: any) {
  return a.getSnapshot();
}

describe("sessionWebSocket.machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupGlobals();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // B1
  it("B1: disconnected -> CONNECT -> connecting -> WS_OPEN -> connected.idle", () => {
    const { actor } = createTestSession();
    expect(snap(actor).value).toBe("disconnected");

    actor.send({ type: "CONNECT" });
    expect(snap(actor).value).toBe("connecting");

    actor.send({ type: "WS_OPEN" });
    expect(snap(actor).value).toEqual({ connected: "idle" });
    expect(snap(actor).context.retryCount).toBe(0);
    actor.stop();
  });

  // B2
  it("B2: retry exhaustion transitions to error", () => {
    const { actor } = createTestSession({ maxRetries: 2 });

    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");

    vi.advanceTimersByTime(1000);
    expect(snap(actor).value).toBe("awaitingReconnect");

    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    vi.advanceTimersByTime(2000);
    expect(snap(actor).value).toBe("awaitingReconnect");

    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("error");
    actor.stop();
  });

  // B3
  it("B3: exponential backoff: retry0=1000ms, retry1=2000ms", () => {
    const { actor } = createTestSession({ maxRetries: 5 });

    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });

    vi.advanceTimersByTime(999);
    expect(snap(actor).value).toBe("reconnecting");
    vi.advanceTimersByTime(1);
    expect(snap(actor).value).toBe("awaitingReconnect");
    expect(snap(actor).context.retryCount).toBe(1);

    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    vi.advanceTimersByTime(1999);
    expect(snap(actor).value).toBe("reconnecting");
    vi.advanceTimersByTime(1);
    expect(snap(actor).value).toBe("awaitingReconnect");
    expect(snap(actor).context.retryCount).toBe(2);
    actor.stop();
  });

  // B4
  it("B4: heartbeat: idle -> heartbeatPending -> PONG -> idle", () => {
    const { actor } = createTestSession();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    expect(snap(actor).value).toEqual({ connected: "idle" });

    vi.advanceTimersByTime(15_000);
    expect(snap(actor).value).toEqual({ connected: "heartbeatPending" });

    actor.send({ type: "PONG_RECEIVED" });
    expect(snap(actor).value).toEqual({ connected: "idle" });
    expect(snap(actor).context.lastPongAt).toBeGreaterThan(0);
    actor.stop();
  });

  // B5
  it("B5: heartbeat timeout -> reconnecting", () => {
    const { actor } = createTestSession();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    vi.advanceTimersByTime(15_000);
    vi.advanceTimersByTime(5_000);
    expect(snap(actor).value).toBe("reconnecting");
    actor.stop();
  });

  // B6
  it("B6: heartbeat timeout with maxRetries=0 -> error", () => {
    const { actor } = createTestSession({ maxRetries: 0 });
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    vi.advanceTimersByTime(15_000);
    vi.advanceTimersByTime(5_000);
    expect(snap(actor).value).toBe("error");
    actor.stop();
  });

  // B7
  it("B7: clean close (1000) -> disconnected", () => {
    const { actor } = createTestSession();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({ type: "WS_CLOSE", code: 1000, reason: "normal", wasClean: true });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  // B8
  it("B8: DISCONNECT during reconnecting -> disconnected", () => {
    const { actor } = createTestSession();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");

    actor.send({ type: "DISCONNECT" });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  // B9
  it("B9: DISCONNECT during connecting -> disconnected", () => {
    const { actor } = createTestSession();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "DISCONNECT" });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  // B10
  it("B10: CONNECT from error -> connecting", () => {
    const { actor } = createTestSession();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_ERROR" });
    expect(snap(actor).value).toBe("error");

    actor.send({ type: "CONNECT" });
    expect(snap(actor).value).toBe("connecting");
    actor.stop();
  });

  // B11
  it("B11: VISIBILITY_VISIBLE from error -> connecting", () => {
    const { actor } = createTestSession();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_ERROR" });
    expect(snap(actor).value).toBe("error");

    actor.send({ type: "VISIBILITY_VISIBLE" });
    expect(snap(actor).value).toBe("connecting");
    actor.stop();
  });

  // B12
  it("B12: parent receives status change notifications", () => {
    const { actor, parentEvents } = createTestSession();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    const connected = parentEvents.find(
      (e) => e.type === "SESSION_STATUS_CHANGED" && e.status === "connected"
    );
    expect(connected).toBeDefined();
    actor.stop();
  });
});
