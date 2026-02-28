/**
 * Cross-cutting resilience and conversation quality scenarios.
 * Tests multi-step sequences through the turnManager machine
 * to validate realistic conversation flows.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor, type InspectionEvent } from "xstate";
import { turnManagerMachine } from "../turnManager.machine";

function createTestActor() {
  const inspectedEvents: Array<{ type: string; event: any }> = [];

  const actor = createActor(turnManagerMachine, {
    inspect: (evt: InspectionEvent) => {
      if (evt.type === "@xstate.event") {
        inspectedEvents.push({ type: evt.type, event: (evt as any).event });
      }
    },
  });

  actor.start();
  return { actor, inspectedEvents };
}

function snap(actor: ReturnType<typeof createActor<typeof turnManagerMachine>>) {
  return actor.getSnapshot();
}

describe("resilience scenarios", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // R1: Rapid double-tap: user speaks, pauses briefly, speaks again
  it("R1: rapid double-tap discards first short transcript", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "uh", confidence: 0.6 });
    expect(snap(actor).value).toBe("debouncing");

    // 100ms later, user speaks again (StartOfTurn cancels debounce)
    vi.advanceTimersByTime(100);
    actor.send({ type: "FLUX_START_OF_TURN" });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.pendingTranscript).toBeNull();

    // New full utterance
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "tell me about this board", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.stop();
  });

  // R2: LLM error recovery - after error, next turn still works
  it("R2: LLM error recovery - next turn works after error", () => {
    const { actor } = createTestActor();

    // First turn ends in LLM error
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    actor.send({ type: "SERVER_LLM_ERROR", reason: "rate limited" });
    expect(snap(actor).context.llmError).toBe("rate limited");

    // Turn completes with audio_end to go back to idle
    actor.send({ type: "SERVER_AUDIO_END" });
    expect(snap(actor).value).toBe("idle");

    // Second turn works normally
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "try again", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.send({ type: "SERVER_LLM_COMPLETE", text: "Sure, here we go" });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.llmCompleteText).toBe("Sure, here we go");

    actor.stop();
  });

  // R3: TTS error accumulation capped at 10
  it("R3: TTS errors accumulate and cap at 10", () => {
    const { actor } = createTestActor();

    for (let i = 0; i < 15; i++) {
      actor.send({ type: "SERVER_TTS_ERROR", text: `tts-fail-${i}` });
    }

    expect(snap(actor).context.ttsErrors).toHaveLength(10);
    expect(snap(actor).context.ttsErrors[0]).toBe("tts-fail-5");
    expect(snap(actor).context.ttsErrors[9]).toBe("tts-fail-14");

    actor.stop();
  });

  // R4: Two consecutive tool calls both complete with history
  it("R4: two consecutive tool calls both complete and appear in history", async () => {
    const mockRunTool = vi.fn()
      .mockResolvedValueOnce({ image: "data:image/png;base64,board" })
      .mockResolvedValueOnce({ text: "Note added" });
    const { actor } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "read board and add note", confidence: 0.95 });
    vi.advanceTimersByTime(200);

    // First tool call
    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });
    await vi.advanceTimersByTimeAsync(10);
    expect(snap(actor).context.toolCallHistory).toHaveLength(1);
    expect(snap(actor).context.toolCallHistory[0].name).toBe("read_board");

    // Second tool call
    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t2", name: "add_sticky_note", args: { text: "idea" } });
    await vi.advanceTimersByTimeAsync(10);
    expect(snap(actor).context.toolCallHistory).toHaveLength(2);
    expect(snap(actor).context.toolCallHistory[1].name).toBe("add_sticky_note");

    actor.stop();
  });

  // R5: Barge-in during tool call - tool still completes
  it("R5: barge-in during tool call increments turn but tool completes", async () => {
    const mockRunTool = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 2000))
    );
    const { actor, inspectedEvents } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "read board", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });
    expect(snap(actor).value).toBe("toolCallActive");

    // User barges in during tool execution
    actor.send({ type: "FLUX_START_OF_TURN" });
    expect(snap(actor).context.turnId).toBe(1);

    // Tool still completes after 2s
    await vi.advanceTimersByTimeAsync(2000);
    expect(snap(actor).context.toolRunning).toBe(false);
    expect(snap(actor).context.toolCallHistory).toHaveLength(1);

    actor.stop();
  });
});
