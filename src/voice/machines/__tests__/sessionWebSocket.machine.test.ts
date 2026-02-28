import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor, setup, assign } from "xstate";
import { sessionWebSocketMachine } from "../sessionWebSocket.machine";

/**
 * The sessionWebSocket machine uses sendParent, so it can only run as a child.
 * We wrap it in a minimal parent machine that captures events from the child.
 */
function createParentWithSession(inputOverrides?: { maxRetries?: number }) {
  const parentEvents: any[] = [];

  const parentMachine = setup({
    types: {
      context: {} as { childState: string | null },
      events: {} as any,
    },
    actors: {
      sessionWs: sessionWebSocketMachine,
    },
  }).createMachine({
    id: "testParent",
    context: { childState: null },
    invoke: {
      id: "sessionWs",
      src: "sessionWs",
      input: {
        buildUrl: () => "ws://localhost:8080/v2/ws/test",
        reconnect: { maxRetries: inputOverrides?.maxRetries ?? 3 },
      },
    },
    on: {
      "*": {
        actions: ({ event }) => {
          parentEvents.push(event);
        },
      },
    },
  });

  const actor = createActor(parentMachine);
  actor.start();

  function getChild() {
    return (actor as any).system?.get("sessionWs");
  }

  function childSnap() {
    const child = getChild();
    return child?.getSnapshot();
  }

  return { actor, getChild, childSnap, parentEvents };
}

describe("sessionWebSocket.machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
        readyState = 1;
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in disconnected state", () => {
    const { childSnap, actor } = createParentWithSession();
    expect(childSnap().value).toBe("disconnected");
    actor.stop();
  });

  it("CONNECT transitions to connecting", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    expect(childSnap().value).toBe("connecting");
    actor.stop();
  });

  it("WS_OPEN from connecting transitions to connected", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });
    expect(childSnap().value).toEqual({ connected: "idle" });
    expect(childSnap().context.retryCount).toBe(0);
    actor.stop();
  });

  it("WS_CLOSE abnormal from connecting transitions to reconnecting", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(childSnap().value).toBe("reconnecting");
    actor.stop();
  });

  it("WS_ERROR from connecting transitions to error", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_ERROR" });
    expect(childSnap().value).toBe("error");
    actor.stop();
  });

  it("WS_CLOSE normal (1000) from connected transitions to disconnected", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });
    expect(childSnap().value).toEqual({ connected: "idle" });

    getChild().send({ type: "WS_CLOSE", code: 1000, reason: "normal", wasClean: true });
    expect(childSnap().value).toBe("disconnected");
    actor.stop();
  });

  it("WS_CLOSE abnormal from connected transitions to reconnecting", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });

    getChild().send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(childSnap().value).toBe("reconnecting");
    actor.stop();
  });

  it("reconnecting -> retryDelay -> awaitingReconnect, then WS_OPEN -> connected", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });
    getChild().send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(childSnap().value).toBe("reconnecting");

    vi.advanceTimersByTime(1000);
    expect(childSnap().value).toBe("awaitingReconnect");
    expect(childSnap().context.retryCount).toBe(1);

    getChild().send({ type: "WS_OPEN" });
    expect(childSnap().value).toEqual({ connected: "idle" });
    expect(childSnap().context.retryCount).toBe(0);
    actor.stop();
  });

  it("exhausting retries transitions to error", () => {
    const { getChild, childSnap, actor } = createParentWithSession({ maxRetries: 2 });
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });

    getChild().send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(childSnap().value).toBe("reconnecting");

    vi.advanceTimersByTime(1000);
    expect(childSnap().value).toBe("awaitingReconnect");
    getChild().send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(childSnap().value).toBe("reconnecting");

    vi.advanceTimersByTime(2000);
    expect(childSnap().value).toBe("awaitingReconnect");
    getChild().send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(childSnap().value).toBe("error");
    actor.stop();
  });

  it("heartbeat: idle -> heartbeatPending after interval", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });
    expect(childSnap().value).toEqual({ connected: "idle" });

    vi.advanceTimersByTime(15_000);
    expect(childSnap().value).toEqual({ connected: "heartbeatPending" });
    actor.stop();
  });

  it("heartbeat: PONG_RECEIVED returns to idle", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });

    vi.advanceTimersByTime(15_000);
    expect(childSnap().value).toEqual({ connected: "heartbeatPending" });

    getChild().send({ type: "PONG_RECEIVED" });
    expect(childSnap().value).toEqual({ connected: "idle" });
    expect(childSnap().context.lastPongAt).toBeGreaterThan(0);
    actor.stop();
  });

  it("heartbeat timeout triggers reconnecting", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });

    vi.advanceTimersByTime(15_000);
    expect(childSnap().value).toEqual({ connected: "heartbeatPending" });

    vi.advanceTimersByTime(5_000);
    expect(childSnap().value).toBe("reconnecting");
    actor.stop();
  });

  it("DISCONNECT from connected transitions to disconnected", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });
    expect(childSnap().value).toEqual({ connected: "idle" });

    getChild().send({ type: "DISCONNECT" });
    expect(childSnap().value).toBe("disconnected");
    actor.stop();
  });

  it("DISCONNECT from connecting transitions to disconnected", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    expect(childSnap().value).toBe("connecting");

    getChild().send({ type: "DISCONNECT" });
    expect(childSnap().value).toBe("disconnected");
    actor.stop();
  });

  it("DISCONNECT from reconnecting transitions to disconnected", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });
    getChild().send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(childSnap().value).toBe("reconnecting");

    getChild().send({ type: "DISCONNECT" });
    expect(childSnap().value).toBe("disconnected");
    actor.stop();
  });

  it("CONNECT from error transitions to connecting", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_ERROR" });
    expect(childSnap().value).toBe("error");

    getChild().send({ type: "CONNECT" });
    expect(childSnap().value).toBe("connecting");
    actor.stop();
  });

  it("VISIBILITY_VISIBLE from error transitions to connecting", () => {
    const { getChild, childSnap, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_ERROR" });
    expect(childSnap().value).toBe("error");

    getChild().send({ type: "VISIBILITY_VISIBLE" });
    expect(childSnap().value).toBe("connecting");
    actor.stop();
  });

  it("parent receives SESSION_STATUS_CHANGED events", () => {
    const { getChild, parentEvents, actor } = createParentWithSession();
    getChild().send({ type: "CONNECT" });
    getChild().send({ type: "WS_OPEN" });

    const connectedEvent = parentEvents.find(
      (e) => e.type === "SESSION_STATUS_CHANGED" && e.status === "connected"
    );
    expect(connectedEvent).toBeDefined();
    actor.stop();
  });
});
