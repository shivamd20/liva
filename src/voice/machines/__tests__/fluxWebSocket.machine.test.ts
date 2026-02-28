import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor } from "xstate";
import { fluxWebSocketMachine } from "../fluxWebSocket.machine";

function createTestActor(input?: { maxRetries?: number }) {
  const actor = createActor(fluxWebSocketMachine, {
    input: {
      buildUrl: () => "ws://localhost:8080/v2/flux/test",
      reconnect: { maxRetries: input?.maxRetries ?? 3 },
    },
  });
  actor.start();
  return actor;
}

function snap(actor: ReturnType<typeof createTestActor>) {
  return actor.getSnapshot();
}

describe("fluxWebSocket.machine", () => {
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
    expect(snap(actor).value).toBe("connected");
    expect(snap(actor).context.retryCount).toBe(0);
    actor.stop();
  });

  it("WS_CLOSE abnormal from connecting transitions to reconnecting", () => {
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
    expect(snap(actor).value).toBe("connected");
    expect(snap(actor).context.retryCount).toBe(0);
    actor.stop();
  });

  it("exhausting retries transitions to error", () => {
    const actor = createTestActor({ maxRetries: 2 });
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    vi.advanceTimersByTime(1000);
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    vi.advanceTimersByTime(2000);
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("error");
    actor.stop();
  });

  it("DISCONNECT from connected transitions to disconnected", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    actor.send({ type: "DISCONNECT" });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  it("DISCONNECT from connecting transitions to disconnected", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "DISCONNECT" });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  it("DISCONNECT from reconnecting transitions to disconnected", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
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

  it("FLUX_EVENT in connected state does not change state", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({
      type: "FLUX_EVENT",
      eventType: "EndOfTurn" as any,
      payload: { event: "EndOfTurn", transcript: "hello", end_of_turn_confidence: 0.95 } as any,
    });
    expect(snap(actor).value).toBe("connected");
    actor.stop();
  });

  it("keepalive tick does not change state", () => {
    const actor = createTestActor();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({ type: "KEEPALIVE_TICK" });
    expect(snap(actor).value).toBe("connected");
    actor.stop();
  });
});
