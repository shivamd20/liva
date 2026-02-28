import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor } from "xstate";
import { voiceOrchestratorMachine } from "../voiceOrchestrator.machine";

const DEFAULT_INPUT = {
  sessionId: "test-session",
  systemPrompt: "You are a test assistant.",
  serverBaseUrl: "http://localhost:8080",
};

function createTestActor(input?: Partial<typeof DEFAULT_INPUT>) {
  const actor = createActor(voiceOrchestratorMachine, {
    input: { ...DEFAULT_INPUT, ...input },
  });
  actor.start();
  return actor;
}

function snap(actor: ReturnType<typeof createTestActor>) {
  return actor.getSnapshot();
}

describe("voiceOrchestrator.machine", () => {
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
    if (typeof globalThis.AudioContext === "undefined") {
      (globalThis as any).AudioContext = class MockAudioContext {
        state = "running" as AudioContextState;
        destination = {};
        createGain = vi.fn(() => ({
          connect: vi.fn(),
          gain: { setValueAtTime: vi.fn(), value: 1 },
          context: { currentTime: 0 },
        }));
        createBufferSource = vi.fn(() => ({
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
        }));
        decodeAudioData = vi.fn(async () => ({}));
        resume = vi.fn(async () => {});
        close = vi.fn(async () => {});
      };
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in idle state", () => {
    const actor = createTestActor();
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.sessionId).toBe("test-session");
    expect(snap(actor).context.systemPrompt).toBe("You are a test assistant.");
    actor.stop();
  });

  it("VOICE_START transitions to active", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });
    expect(snap(actor).value).toBe("active");
    expect(snap(actor).context.error).toBeNull();
    actor.stop();
  });

  it("VOICE_STOP transitions back to idle", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });
    expect(snap(actor).value).toBe("active");

    actor.send({ type: "VOICE_STOP" });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.sessionWsStatus).toBe("disconnected");
    expect(snap(actor).context.fluxWsStatus).toBe("disconnected");
    expect(snap(actor).context.isPlaying).toBe(false);
    actor.stop();
  });

  it("SESSION_STATUS_CHANGED updates sessionWsStatus", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "SESSION_STATUS_CHANGED", status: "connected" });
    expect(snap(actor).context.sessionWsStatus).toBe("connected");

    actor.send({ type: "SESSION_STATUS_CHANGED", status: "error", error: "timeout" });
    expect(snap(actor).context.sessionWsStatus).toBe("error");
    expect(snap(actor).context.error).toBe("timeout");
    actor.stop();
  });

  it("FLUX_STATUS_CHANGED updates fluxWsStatus", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "FLUX_STATUS_CHANGED", status: "connected" });
    expect(snap(actor).context.fluxWsStatus).toBe("connected");
    actor.stop();
  });

  it("PLAYBACK_STATE_CHANGED updates isPlaying", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "PLAYBACK_STATE_CHANGED", isPlaying: true });
    expect(snap(actor).context.isPlaying).toBe(true);

    actor.send({ type: "PLAYBACK_STATE_CHANGED", isPlaying: false });
    expect(snap(actor).context.isPlaying).toBe(false);
    actor.stop();
  });

  it("SERVER_STATUS_CHANGED updates serverStatus and orbState", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });
    actor.send({ type: "FLUX_STATUS_CHANGED", status: "connected" });

    actor.send({ type: "SERVER_STATUS_CHANGED", value: "thinking" });
    expect(snap(actor).context.serverStatus).toBe("thinking");
    expect(snap(actor).context.orbState).toBe("thinking");

    actor.send({ type: "SERVER_STATUS_CHANGED", value: "synthesizing" });
    expect(snap(actor).context.serverStatus).toBe("synthesizing");
    expect(snap(actor).context.orbState).toBe("speaking");
    actor.stop();
  });

  it("TOOL_STATE_CHANGED updates toolRunning and orbState", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });
    actor.send({ type: "FLUX_STATUS_CHANGED", status: "connected" });

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

  it("LLM_TEXT_CHANGED updates llmText and llmCompleteText", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "LLM_TEXT_CHANGED", text: "Hello ", complete: false });
    expect(snap(actor).context.llmText).toBe("Hello ");
    expect(snap(actor).context.llmCompleteText).toBeNull();

    actor.send({ type: "LLM_TEXT_CHANGED", text: "Hello world", complete: true });
    expect(snap(actor).context.llmText).toBe("");
    expect(snap(actor).context.llmCompleteText).toBe("Hello world");
    expect(snap(actor).context.assistantHistory[0]).toBe("Hello world");
    actor.stop();
  });

  it("ERROR event sets error and orbState", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "ERROR", error: "Something broke", source: "llm" });
    expect(snap(actor).context.error).toBe("Something broke");
    expect(snap(actor).context.orbState).toBe("error");
    actor.stop();
  });

  it("CAPTURE_ERROR sets error", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "CAPTURE_ERROR", error: "Mic denied" });
    expect(snap(actor).context.error).toBe("Mic denied");
    expect(snap(actor).context.captureReady).toBe(false);
    actor.stop();
  });

  it("CAPTURE_READY sets captureReady", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "CAPTURE_READY" });
    expect(snap(actor).context.captureReady).toBe(true);
    actor.stop();
  });

  it("orbState is 'connecting' when session or flux WS is connecting", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "SESSION_STATUS_CHANGED", status: "connecting" });
    expect(snap(actor).context.orbState).toBe("connecting");
    actor.stop();
  });

  it("orbState is 'listening' when flux is connected and nothing else active", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({ type: "FLUX_STATUS_CHANGED", status: "connected" });
    actor.send({ type: "SESSION_STATUS_CHANGED", status: "connected" });
    expect(snap(actor).context.orbState).toBe("listening");
    actor.stop();
  });

  it("FLUX_EVENT with EndOfTurn updates transcriptHistory", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({
      type: "FLUX_EVENT",
      eventType: "EndOfTurn" as any,
      payload: { event: "EndOfTurn", transcript: "hello world", end_of_turn_confidence: 0.95 } as any,
    });
    expect(snap(actor).context.transcriptHistory[0]).toBe("hello world");
    actor.stop();
  });

  it("FLUX_EVENT with Update updates liveTranscript", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });

    actor.send({
      type: "FLUX_EVENT",
      eventType: "Update" as any,
      payload: { event: "Update", transcript: "hel" } as any,
    });
    expect(snap(actor).context.liveTranscript).toBe("hel");
    actor.stop();
  });

  it("VOICE_START resets error and llm state", () => {
    const actor = createTestActor();
    actor.send({ type: "VOICE_START" });
    actor.send({ type: "ERROR", error: "old error", source: "test" });
    actor.send({ type: "VOICE_STOP" });

    actor.send({ type: "VOICE_START" });
    expect(snap(actor).context.error).toBeNull();
    expect(snap(actor).context.llmText).toBe("");
    expect(snap(actor).context.llmCompleteText).toBeNull();
    actor.stop();
  });
});
