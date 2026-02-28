import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor, type AnyActorRef } from "xstate";
import { sessionWebSocketMachine } from "../sessionWebSocket.machine";

/**
 * These tests verify the state machine logic by sending events directly.
 * The wsBridge and visibilityListener callback actors are invoked but
 * we bypass them by sending WS_OPEN, WS_CLOSE, etc. directly to the machine.
 */

function createTestActor(input?: { maxRetries?: number }) {
  const actor = createActor(sessionWebSocketMachine, {
    input: {
      buildUrl: () => "ws://localhost:8080/v2/ws/test",
      reconnect: { maxRetries: input?.maxRetries ?? 3 },
    },
  });
  actor.start();
  return actor;
}

function snap(actor: ReturnType<typeof createTestActor>) {
  return actor.getSnapshot();
}

describe("sessionWebSocket.machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock document for visibility listener
    if (typeof globalThis.document === "undefined") {
      (globalThis as any).document = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        visibilityState: "visible",
      };
    }
    // Mock WebSocket for wsBridge
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
    const actor = createTestActor();
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  it("CONNECT transitions to connecting", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    expect(snap(actor).value).toBe("connecting");
    actor.stop();
  });

  it("WS_OPEN from connecting transitions to connected", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    expect(snap(actor).value).toEqual({ connected: "idle" });
    expect(snap(actor).context.retryCount).toBe(0);
    actor.stop();
  });

  it("WS_CLOSE abnormal from connecting transitions to reconnecting when retries available", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");
    actor.stop();
  });

  it("WS_ERROR from connecting transitions to error", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_ERROR" });
    expect(snap(actor).value).toBe("error");
    actor.stop();
  });

  it("WS_CLOSE normal (1000) from connected transitions to disconnected", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    expect(snap(actor).value).toEqual({ connected: "idle" });

    actor.send({ type: "WS_CLOSE", code: 1000, reason: "normal", wasClean: true });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  it("WS_CLOSE abnormal from connected transitions to reconnecting", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");
    actor.stop();
  });

  it("reconnecting -> retryDelay -> awaitingReconnect, then WS_OPEN -> connected", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");

    vi.advanceTimersByTime(1000);
    expect(snap(actor).value).toBe("awaitingReconnect");
    expect(snap(actor).context.retryCount).toBe(1);

    actor.send({ type: "WS_OPEN" });
    expect(snap(actor).value).toEqual({ connected: "idle" });
    expect(snap(actor).context.retryCount).toBe(0);
    actor.stop();
  });

  it("exhausting retries transitions to error", () => {
    const actor = createTestActor({ maxRetries: 2 });
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    // First disconnect
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");

    // Retry 1
    vi.advanceTimersByTime(1000);
    expect(snap(actor).value).toBe("awaitingReconnect");
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");

    // Retry 2
    vi.advanceTimersByTime(2000);
    expect(snap(actor).value).toBe("awaitingReconnect");
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("error");
    actor.stop();
  });

  it("heartbeat: idle -> heartbeatPending after interval", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    expect(snap(actor).value).toEqual({ connected: "idle" });

    vi.advanceTimersByTime(15_000);
    expect(snap(actor).value).toEqual({ connected: "heartbeatPending" });
    actor.stop();
  });

  it("heartbeat: PONG_RECEIVED returns to idle", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    vi.advanceTimersByTime(15_000);
    expect(snap(actor).value).toEqual({ connected: "heartbeatPending" });

    actor.send({ type: "PONG_RECEIVED" });
    expect(snap(actor).value).toEqual({ connected: "idle" });
    expect(snap(actor).context.lastPongAt).toBeGreaterThan(0);
    actor.stop();
  });

  it("heartbeat timeout triggers reconnecting", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    vi.advanceTimersByTime(15_000);
    expect(snap(actor).value).toEqual({ connected: "heartbeatPending" });

    vi.advanceTimersByTime(5_000);
    expect(snap(actor).value).toBe("reconnecting");
    actor.stop();
  });

  it("DISCONNECT from connected transitions to disconnected", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    expect(snap(actor).value).toEqual({ connected: "idle" });

    actor.send({ type: "DISCONNECT" });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  it("DISCONNECT from connecting transitions to disconnected", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    expect(snap(actor).value).toBe("connecting");

    actor.send({ type: "DISCONNECT" });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  it("DISCONNECT from reconnecting transitions to disconnected", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");

    actor.send({ type: "DISCONNECT" });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  it("CONNECT from error transitions to connecting", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_ERROR" });
    expect(snap(actor).value).toBe("error");

    actor.send({ type: "CONNECT" });
    expect(snap(actor).value).toBe("connecting");
    actor.stop();
  });

  it("VISIBILITY_VISIBLE from error transitions to connecting", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_ERROR" });
    expect(snap(actor).value).toBe("error");

    actor.send({ type: "VISIBILITY_VISIBLE" });
    expect(snap(actor).value).toBe("connecting");
    actor.stop();
  });

  it("WS_MESSAGE_JSON in connected forwards to parent (inspected)", () => {
    const parentEvents: any[] = [];
    const actor = createActor(sessionWebSocketMachine, {
      input: {
        buildUrl: () => "ws://localhost:8080/v2/ws/test",
      },
      inspect: (evt) => {
        if (evt.type === "@xstate.event" && (evt as any).event?.type?.startsWith("SESSION_")) {
          parentEvents.push((evt as any).event);
        }
      },
    });
    actor.start();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({
      type: "WS_MESSAGE_JSON",
      msg: { type: "status", value: "thinking" },
    });

    actor.stop();
  });
});
