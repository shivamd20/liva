import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor, createMachine, fromCallback } from "xstate";
import { voiceOrchestratorMachine } from "../voiceOrchestrator.machine";

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
      send = vi.fn();
      close = vi.fn();
    };
  }
  if (typeof globalThis.AudioContext === "undefined") {
    (globalThis as any).AudioContext = class {
      state = "running";
      currentTime = 0;
      destination = {};
      createGain = vi.fn(() => ({
        gain: { value: 1, setValueAtTime: vi.fn() },
        connect: vi.fn(),
      }));
      createBufferSource = vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      }));
      decodeAudioData = vi.fn(async () => ({}));
      resume = vi.fn();
      close = vi.fn();
    };
  }
}

const noopCallback = fromCallback(() => () => {});

const stubSessionWs = createMachine({ id: "sessionWs", initial: "idle", states: { idle: {} } });
const stubFluxWs = createMachine({ id: "fluxWs", initial: "idle", states: { idle: {} } });
const stubPlayback = createMachine({ id: "playback", initial: "idle", states: { idle: {} } });
const stubTurnMgr = createMachine({ id: "turnMgr", initial: "idle", states: { idle: {} } });

function createTestOrchestrator() {
  const machine = voiceOrchestratorMachine.provide({
    actors: {
      sessionWebSocket: stubSessionWs as any,
      fluxWebSocket: stubFluxWs as any,
      audioPlayback: stubPlayback as any,
      audioCapture: noopCallback as any,
      turnManager: stubTurnMgr as any,
    },
  });

  const actor = createActor(machine, {
    input: {
      sessionId: "test-session",
      systemPrompt: "You are Liva",
      serverBaseUrl: "http://localhost:8080",
    },
  });

  actor.start();
  return { actor };
}

function snap(a: any) {
  return a.getSnapshot();
}

describe("voiceOrchestrator.machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupGlobals();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // E1: VOICE_START transitions from idle to active
  it("E1: VOICE_START transitions to active", () => {
    const { actor } = createTestOrchestrator();
    expect(snap(actor).value).toBe("idle");

    actor.send({ type: "VOICE_START" });
    expect(snap(actor).value).toBe("active");

    actor.stop();
  });

  // E2: deriveOrbState priority ordering
  it("E2: orbState defaults to idle when all statuses are default", () => {
    const { actor } = createTestOrchestrator();
    actor.send({ type: "VOICE_START" });

    expect(snap(actor).context.orbState).toBe("idle");

    actor.stop();
  });

  it("E2b: error state has highest priority in orbState", () => {
    const { actor } = createTestOrchestrator();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "ERROR", error: "test error", source: "test" });
    expect(snap(actor).context.orbState).toBe("error");
    expect(snap(actor).context.error).toBe("test error");

    actor.stop();
  });

  // E3: VOICE_STOP transitions back to idle
  it("E3: VOICE_STOP transitions from active to idle", () => {
    const { actor } = createTestOrchestrator();
    actor.send({ type: "VOICE_START" });
    expect(snap(actor).value).toBe("active");

    actor.send({ type: "VOICE_STOP" });
    expect(snap(actor).value).toBe("idle");

    actor.stop();
  });

  // E4: SESSION_STATUS_CHANGED with connected clears error
  it("E4: SESSION_STATUS_CHANGED connected clears error", () => {
    const { actor } = createTestOrchestrator();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "SESSION_STATUS_CHANGED", status: "error", error: "Connection failed" });
    expect(snap(actor).context.error).toBe("Connection failed");

    actor.send({ type: "SESSION_STATUS_CHANGED", status: "connected" });
    expect(snap(actor).context.error).toBeNull();
    expect(snap(actor).context.sessionWsStatus).toBe("connected");

    actor.stop();
  });

  // E5: SESSION_STATUS_CHANGED error sets orbState to error
  it("E5: session error sets orbState to error", () => {
    const { actor } = createTestOrchestrator();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "SESSION_STATUS_CHANGED", status: "error", error: "Network error" });
    expect(snap(actor).context.orbState).toBe("error");

    actor.stop();
  });

  // E6: FLUX_STATUS_CHANGED updates fluxWsStatus
  it("E6: FLUX_STATUS_CHANGED updates fluxWsStatus and orbState", () => {
    const { actor } = createTestOrchestrator();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "FLUX_STATUS_CHANGED", status: "connecting" });
    expect(snap(actor).context.fluxWsStatus).toBe("connecting");
    expect(snap(actor).context.orbState).toBe("connecting");

    actor.send({ type: "FLUX_STATUS_CHANGED", status: "connected" });
    expect(snap(actor).context.fluxWsStatus).toBe("connected");
    expect(snap(actor).context.orbState).toBe("listening");

    actor.stop();
  });

  // E7: FLUX_EVENT with empty transcript EndOfTurn doesn't forward to turnMgr
  it("E7: FLUX_EVENT stores transcript in context", () => {
    const { actor } = createTestOrchestrator();
    actor.send({ type: "VOICE_START" });

    actor.send({
      type: "FLUX_EVENT",
      eventType: "EndOfTurn" as any,
      payload: { event: "EndOfTurn", transcript: "hello world", end_of_turn_confidence: 0.95 },
    });

    expect(snap(actor).context.liveTranscript).toBe("hello world");
    expect(snap(actor).context.transcriptHistory[0]).toBe("hello world");

    actor.stop();
  });

  // E8: PLAYBACK_STATE_CHANGED updates isPlaying
  it("E8: PLAYBACK_STATE_CHANGED updates isPlaying and orbState", () => {
    const { actor } = createTestOrchestrator();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "PLAYBACK_STATE_CHANGED", isPlaying: true });
    expect(snap(actor).context.isPlaying).toBe(true);
    expect(snap(actor).context.orbState).toBe("speaking");

    actor.send({ type: "PLAYBACK_STATE_CHANGED", isPlaying: false });
    expect(snap(actor).context.isPlaying).toBe(false);

    actor.stop();
  });

  // E9: TOOL_STATE_CHANGED updates toolRunning
  it("E9: TOOL_STATE_CHANGED updates toolRunning and orbState", () => {
    const { actor } = createTestOrchestrator();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "TOOL_STATE_CHANGED", running: true, name: "read_board" });
    expect(snap(actor).context.toolRunning).toBe(true);
    expect(snap(actor).context.activeToolName).toBe("read_board");
    expect(snap(actor).context.orbState).toBe("readingBoard");

    actor.send({ type: "TOOL_STATE_CHANGED", running: true, name: "add_sticky_note" });
    expect(snap(actor).context.orbState).toBe("toolRunning");

    actor.send({ type: "TOOL_STATE_CHANGED", running: false, name: null });
    expect(snap(actor).context.toolRunning).toBe(false);

    actor.stop();
  });

  // E10: LLM_TEXT_CHANGED accumulates and completes
  it("E10: LLM_TEXT_CHANGED accumulates partial and stores complete", () => {
    const { actor } = createTestOrchestrator();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "LLM_TEXT_CHANGED", text: "Hello ", complete: false });
    expect(snap(actor).context.llmText).toBe("Hello ");

    actor.send({ type: "LLM_TEXT_CHANGED", text: "Hello world", complete: true });
    expect(snap(actor).context.llmText).toBe("");
    expect(snap(actor).context.llmCompleteText).toBe("Hello world");
    expect(snap(actor).context.assistantHistory[0]).toBe("Hello world");

    actor.stop();
  });
});
