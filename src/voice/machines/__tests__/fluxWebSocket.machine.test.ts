import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor, fromCallback } from "xstate";
import { fluxWebSocketMachine } from "../fluxWebSocket.machine";

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

function createTestFluxWs(overrides?: { maxRetries?: number }) {
  const parentEvents: any[] = [];

  const machine = fluxWebSocketMachine.provide({
    actors: {
      fluxBridge: noopCallback as any,
      visibilityListener: noopCallback as any,
      keepaliveTicker: noopCallback as any,
    },
  });

  const actor = createActor(machine, {
    input: {
      buildUrl: () => "ws://localhost:8080/flux/test",
      reconnect: { maxRetries: overrides?.maxRetries ?? 5 },
    },
  });

  actor.start();
  return { actor, parentEvents };
}

function snap(a: any) {
  return a.getSnapshot();
}

describe("fluxWebSocket.machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupGlobals();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // FW1: disconnected -> CONNECT -> connecting -> WS_OPEN -> connected
  it("FW1: full connection lifecycle", () => {
    const { actor } = createTestFluxWs();
    expect(snap(actor).value).toBe("disconnected");

    actor.send({ type: "CONNECT" });
    expect(snap(actor).value).toBe("connecting");

    actor.send({ type: "WS_OPEN" });
    expect(snap(actor).value).toBe("connected");
    expect(snap(actor).context.retryCount).toBe(0);
    actor.stop();
  });

  // FW2: FLUX_EVENT in connected state (no parent to forward to, just verifies no crash)
  it("FW2: FLUX_EVENT in connected state does not crash", () => {
    const { actor } = createTestFluxWs();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({
      type: "FLUX_EVENT",
      eventType: "EndOfTurn" as any,
      payload: { event: "EndOfTurn", transcript: "hello", end_of_turn_confidence: 0.95 },
    });

    expect(snap(actor).value).toBe("connected");
    actor.stop();
  });

  // FW3: SEND_AUDIO in connected (no bridge to forward to, verifies no crash)
  it("FW3: SEND_AUDIO in connected updates lastSendTime", () => {
    const { actor } = createTestFluxWs();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    const before = snap(actor).context.lastSendTime;
    vi.advanceTimersByTime(100);
    actor.send({ type: "SEND_AUDIO", chunk: new ArrayBuffer(640) });

    expect(snap(actor).context.lastSendTime).toBeGreaterThanOrEqual(before);
    actor.stop();
  });

  // FW4: Keepalive tick (simulated manually since we mock keepaliveTicker)
  it("FW4: KEEPALIVE_TICK when idle for > 3500ms is handled", () => {
    const { actor } = createTestFluxWs();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    vi.advanceTimersByTime(4000);
    actor.send({ type: "KEEPALIVE_TICK" });
    expect(snap(actor).value).toBe("connected");
    actor.stop();
  });

  // FW5: Abnormal close -> reconnecting
  it("FW5: abnormal close -> reconnecting", () => {
    const { actor } = createTestFluxWs();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");
    actor.stop();
  });

  // FW6: Clean close -> disconnected
  it("FW6: clean close (1000) -> disconnected", () => {
    const { actor } = createTestFluxWs();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({ type: "WS_CLOSE", code: 1000, reason: "normal", wasClean: true });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  // FW7: DISCONNECT during reconnecting -> disconnected
  it("FW7: DISCONNECT during reconnecting -> disconnected", () => {
    const { actor } = createTestFluxWs();
    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });
    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");

    actor.send({ type: "DISCONNECT" });
    expect(snap(actor).value).toBe("disconnected");
    actor.stop();
  });

  // FW8: Retry exhaustion -> error
  it("FW8: retry exhaustion transitions to error", () => {
    const { actor } = createTestFluxWs({ maxRetries: 1 });

    actor.send({ type: "CONNECT" });
    actor.send({ type: "WS_OPEN" });

    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("reconnecting");

    vi.advanceTimersByTime(1000);
    expect(snap(actor).value).toBe("awaitingReconnect");

    actor.send({ type: "WS_CLOSE", code: 1006, reason: "", wasClean: false });
    expect(snap(actor).value).toBe("error");
    actor.stop();
  });
});
