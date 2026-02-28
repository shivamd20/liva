import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor, type InspectionEvent } from "xstate";
import { turnManagerMachine } from "../turnManager.machine";

/**
 * Create a test actor with event capture via inspect.
 * We capture sendTo events that would normally go to the parent.
 */
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

describe("turnManager.machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // A1: Happy path single turn
  it("A1: completes a single turn through debounce -> awaitingResponse -> idle", () => {
    const { actor } = createTestActor();
    expect(snap(actor).value).toBe("idle");

    actor.send({ type: "FLUX_START_OF_TURN" });
    expect(snap(actor).context.turnId).toBe(1);
    expect(snap(actor).value).toBe("idle");

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.95 });
    expect(snap(actor).value).toBe("debouncing");
    expect(snap(actor).context.pendingTranscript).toBe("hello");
    expect(snap(actor).context.debounceMs).toBe(200);

    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.send({ type: "SERVER_LLM_COMPLETE", text: "Hi there" });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.llmCompleteText).toBe("Hi there");
    expect(snap(actor).context.assistantHistory[0]).toBe("Hi there");

    actor.stop();
  });

  // A2: Adaptive debounce calculation
  it("A2: computes debounce correctly for various confidence levels", () => {
    const { actor } = createTestActor();

    // No confidence -> 500ms
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "a" });
    expect(snap(actor).context.debounceMs).toBe(500);
    actor.send({ type: "FLUX_START_OF_TURN" }); // reset to idle

    // Low confidence -> 500ms
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "a", confidence: 0.5 });
    expect(snap(actor).context.debounceMs).toBe(500);
    actor.send({ type: "FLUX_START_OF_TURN" });

    // At low threshold (0.75) -> 500ms
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "a", confidence: 0.75 });
    expect(snap(actor).context.debounceMs).toBe(500);
    actor.send({ type: "FLUX_START_OF_TURN" });

    // Midpoint (0.825) -> ~350ms
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "a", confidence: 0.825 });
    expect(snap(actor).context.debounceMs).toBe(350);
    actor.send({ type: "FLUX_START_OF_TURN" });

    // High confidence -> 200ms
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "a", confidence: 0.9 });
    expect(snap(actor).context.debounceMs).toBe(200);
    actor.send({ type: "FLUX_START_OF_TURN" });

    // Very high confidence -> 200ms
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "a", confidence: 0.99 });
    expect(snap(actor).context.debounceMs).toBe(200);

    actor.stop();
  });

  // A3: Transcript merging across multiple EndOfTurn during debounce
  it("A3: merges transcripts from multiple EndOfTurn events during debounce", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.95 });
    expect(snap(actor).value).toBe("debouncing");

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "world", confidence: 0.95 });
    expect(snap(actor).value).toBe("debouncing");
    expect(snap(actor).context.pendingTranscript).toBe("hello world");

    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.stop();
  });

  // A4: TurnResumed cancels pending transcript
  it("A4: TurnResumed during debounce clears pending transcript and returns to idle", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "uh", confidence: 0.6 });
    expect(snap(actor).value).toBe("debouncing");

    actor.send({ type: "FLUX_TURN_RESUMED" });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.pendingTranscript).toBeNull();

    actor.stop();
  });

  // A5: StartOfTurn during debouncing resets
  it("A5: StartOfTurn during debouncing resets transcript and increments turnId", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.8 });
    expect(snap(actor).value).toBe("debouncing");

    actor.send({ type: "FLUX_START_OF_TURN" });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.pendingTranscript).toBeNull();
    expect(snap(actor).context.turnId).toBe(1);

    actor.stop();
  });

  // A6: Barge-in during awaitingResponse
  it("A6: StartOfTurn during awaitingResponse increments turnId", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    const prevTurnId = snap(actor).context.turnId;
    actor.send({ type: "FLUX_START_OF_TURN" });
    expect(snap(actor).context.turnId).toBe(prevTurnId + 1);

    actor.stop();
  });

  // A7: Barge-in with new transcript during awaitingResponse
  it("A7: EndOfTurn during awaitingResponse sets transcript and transitions to awaitingResponse after debounce", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "actually wait", confidence: 0.9 });
    expect(snap(actor).value).toBe("debouncing");
    expect(snap(actor).context.pendingTranscript).toBe("actually wait");

    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.stop();
  });

  // A8: Tool call happy path
  it("A8: tool call transitions to toolCallActive and back on completion", async () => {
    const mockRunTool = vi.fn().mockResolvedValue({ image: "data:image/png;base64,abc" });
    const { actor } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "read my board", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board", args: {} });
    expect(snap(actor).value).toBe("toolCallActive");
    expect(snap(actor).context.toolRunning).toBe(true);
    expect(snap(actor).context.activeToolName).toBe("read_board");

    await vi.advanceTimersByTimeAsync(10);

    expect(snap(actor).value).toBe("awaitingResponse");
    expect(snap(actor).context.toolRunning).toBe(false);
    expect(snap(actor).context.toolCallHistory).toHaveLength(1);
    expect(snap(actor).context.toolCallHistory[0].name).toBe("read_board");

    actor.stop();
  });

  // A9: Tool call without runTool set
  it("A9: tool request without runTool set enters toolCallActive state", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "check board", confidence: 0.95 });
    vi.advanceTimersByTime(200);

    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });
    expect(snap(actor).value).toBe("toolCallActive");

    actor.stop();
  });

  // A10: Tool throws error
  it("A10: tool rejection transitions back to awaitingResponse with error in history", async () => {
    const mockRunTool = vi.fn().mockRejectedValue(new Error("Board not available"));
    const { actor } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "read board", confidence: 0.95 });
    vi.advanceTimersByTime(200);

    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });
    await vi.advanceTimersByTimeAsync(10);

    expect(snap(actor).value).toBe("awaitingResponse");
    expect(snap(actor).context.toolRunning).toBe(false);
    const lastTool = snap(actor).context.toolCallHistory[0];
    expect((lastTool.result as any).error).toBe("Board not available");

    actor.stop();
  });

  // A11: User speaks during tool execution
  it("A11: StartOfTurn during toolCallActive increments turnId", () => {
    const mockRunTool = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ image: "data:..." }), 5000))
    );
    const { actor } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "read", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });

    expect(snap(actor).value).toBe("toolCallActive");
    const prevTurnId = snap(actor).context.turnId;
    actor.send({ type: "FLUX_START_OF_TURN" });

    expect(snap(actor).context.turnId).toBe(prevTurnId + 1);

    actor.stop();
  });

  // A12: RESET clears all state
  it("A12: RESET clears all context and returns to idle", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    actor.send({ type: "SERVER_LLM_PARTIAL", text: "Hi" });

    expect(snap(actor).context.llmText).toBe("Hi");

    actor.send({ type: "RESET" });
    expect(snap(actor).value).toBe("idle");
    expect(snap(actor).context.llmText).toBe("");
    expect(snap(actor).context.pendingTranscript).toBeNull();
    expect(snap(actor).context.llmCompleteText).toBeNull();
    expect(snap(actor).context.serverStatus).toBeNull();
    expect(snap(actor).context.toolRunning).toBe(false);

    actor.stop();
  });

  // A13: Empty EndOfTurn transcript
  it("A13: whitespace-only transcript does not transition to awaitingResponse after debounce", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "   ", confidence: 0.95 });
    expect(snap(actor).value).toBe("debouncing");

    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("idle");

    actor.stop();
  });

  // A14: SERVER_AUDIO_END returns to idle
  it("A14: SERVER_AUDIO_END from awaitingResponse returns to idle", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.send({ type: "SERVER_AUDIO_END" });
    expect(snap(actor).value).toBe("idle");

    actor.stop();
  });

  // A15: Rapid-fire StartOfTurn events
  it("A15: rapid StartOfTurn events increment turnId correctly", () => {
    const { actor } = createTestActor();

    for (let i = 0; i < 5; i++) {
      actor.send({ type: "FLUX_START_OF_TURN" });
    }

    expect(snap(actor).context.turnId).toBe(5);
    expect(snap(actor).value).toBe("idle");

    actor.stop();
  });

  // Additional: SERVER_TTS_ERROR caps at 10
  it("TTS errors are capped at 10 entries", () => {
    const { actor } = createTestActor();

    for (let i = 0; i < 15; i++) {
      actor.send({ type: "SERVER_TTS_ERROR", text: `error-${i}` });
    }

    expect(snap(actor).context.ttsErrors).toHaveLength(10);
    expect(snap(actor).context.ttsErrors[0]).toBe("error-5");
    expect(snap(actor).context.ttsErrors[9]).toBe("error-14");

    actor.stop();
  });

  // Additional: SERVER_LLM_ERROR sets error and clears text
  it("SERVER_LLM_ERROR sets llmError and clears llmText", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    actor.send({ type: "SERVER_LLM_PARTIAL", text: "partial" });
    expect(snap(actor).context.llmText).toBe("partial");

    actor.send({ type: "SERVER_LLM_ERROR", reason: "rate limited" });
    expect(snap(actor).context.llmError).toBe("rate limited");
    expect(snap(actor).context.llmText).toBe("");

    actor.stop();
  });

  // Additional: LLM_COMPLETE in awaitingResponse adds to assistant history (capped at 20)
  it("assistant history is capped at 20 entries", () => {
    const { actor } = createTestActor();

    for (let i = 0; i < 25; i++) {
      actor.send({ type: "FLUX_END_OF_TURN", transcript: `q${i}`, confidence: 0.95 });
      vi.advanceTimersByTime(200);
      actor.send({ type: "SERVER_LLM_COMPLETE", text: `answer-${i}` });
    }

    expect(snap(actor).context.assistantHistory).toHaveLength(20);
    expect(snap(actor).context.assistantHistory[0]).toBe("answer-24");

    actor.stop();
  });

  // Additional: SERVER_STATUS event updates serverStatus
  it("SERVER_STATUS updates context serverStatus", () => {
    const { actor } = createTestActor();

    actor.send({ type: "SERVER_STATUS", value: "thinking" });
    expect(snap(actor).context.serverStatus).toBe("thinking");

    actor.send({ type: "SERVER_STATUS", value: "synthesizing" });
    expect(snap(actor).context.serverStatus).toBe("synthesizing");

    actor.send({ type: "SERVER_STATUS", value: "interrupted" });
    expect(snap(actor).context.serverStatus).toBe("interrupted");

    actor.stop();
  });

  // Additional: Multiple debounce entries merge correctly
  it("three EndOfTurn events merge into one transcript", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "one", confidence: 0.95 });
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "two", confidence: 0.95 });
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "three", confidence: 0.95 });
    expect(snap(actor).context.pendingTranscript).toBe("one two three");

    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.stop();
  });

  // A7b: Barge-in with empty transcript in awaitingResponse
  it("A7b: empty EndOfTurn in awaitingResponse sends interrupt, debounce expires to idle", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "", confidence: 0.9 });
    expect(snap(actor).value).toBe("debouncing");

    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("idle");

    actor.stop();
  });

  // A16: SERVER_LLM_COMPLETE in idle while toolRunning=true (set by global handler)
  it("A16: global SERVER_LLM_COMPLETE stores text while toolRunning persists", () => {
    const mockRunTool = vi.fn().mockImplementation(() => new Promise(() => {}));
    const { actor } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "test", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });
    expect(snap(actor).context.toolRunning).toBe(true);

    actor.send({ type: "SERVER_LLM_COMPLETE", text: "Here is the board" });
    expect(snap(actor).context.llmCompleteText).toBe("Here is the board");
    expect(snap(actor).context.toolRunning).toBe(true);

    actor.stop();
  });

  // A17: FLUX_EAGER_END_OF_TURN stores confidence but doesn't transition
  it("A17: FLUX_EAGER_END_OF_TURN in idle does not change state", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_EAGER_END_OF_TURN", confidence: 0.85 });
    expect(snap(actor).value).toBe("idle");

    actor.stop();
  });

  // A18: SET_RUN_TOOL can be called multiple times (last wins)
  it("A18: SET_RUN_TOOL overwrites previous runTool", async () => {
    const firstTool = vi.fn().mockResolvedValue({ first: true });
    const secondTool = vi.fn().mockResolvedValue({ second: true });
    const { actor } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: firstTool });
    actor.send({ type: "SET_RUN_TOOL", runTool: secondTool });

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "test", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });

    await vi.advanceTimersByTimeAsync(10);

    expect(firstTool).not.toHaveBeenCalled();
    expect(secondTool).toHaveBeenCalled();

    actor.stop();
  });

  // A19: TOOL_TIMED_OUT global handler clears state
  it("A19: TOOL_TIMED_OUT clears toolRunning and adds timeout to history", () => {
    const mockRunTool = vi.fn().mockImplementation(() => new Promise(() => {}));
    const { actor } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "test", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });
    expect(snap(actor).context.toolRunning).toBe(true);

    actor.send({ type: "TOOL_TIMED_OUT", toolCallId: "t1", toolName: "read_board" });
    expect(snap(actor).context.toolRunning).toBe(false);
    expect(snap(actor).context.activeToolName).toBeNull();
    const last = snap(actor).context.toolCallHistory.at(-1);
    expect((last?.result as any)?.error).toBe("Tool timed out");

    actor.stop();
  });

  // A20: SERVER_TOOL_REQUEST in awaitingResponse with runTool transitions to toolCallActive
  it("A20: SERVER_TOOL_REQUEST in awaitingResponse transitions to toolCallActive", () => {
    const mockRunTool = vi.fn().mockImplementation(() => new Promise(() => {}));
    const { actor } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "hello", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "add_sticky_note", args: { text: "idea" } });
    expect(snap(actor).value).toBe("toolCallActive");
    expect(snap(actor).context.activeToolName).toBe("add_sticky_note");

    actor.stop();
  });

  // A21: 5 rapid EndOfTurn events merge correctly
  it("A21: five rapid EndOfTurn events during debounce all merge", () => {
    const { actor } = createTestActor();

    for (let i = 1; i <= 5; i++) {
      actor.send({ type: "FLUX_END_OF_TURN", transcript: `word${i}`, confidence: 0.95 });
    }

    expect(snap(actor).context.pendingTranscript).toBe("word1 word2 word3 word4 word5");

    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.stop();
  });

  // A22: debounceMs boundary values around midpoint
  it("A22: debounce boundary at 0.8249 vs 0.825 vs 0.8251", () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "a", confidence: 0.8249 });
    const d1 = snap(actor).context.debounceMs;
    actor.send({ type: "FLUX_START_OF_TURN" });

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "a", confidence: 0.825 });
    const d2 = snap(actor).context.debounceMs;
    actor.send({ type: "FLUX_START_OF_TURN" });

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "a", confidence: 0.8251 });
    const d3 = snap(actor).context.debounceMs;

    expect(d1).toBeGreaterThanOrEqual(d2);
    expect(d2).toBeGreaterThanOrEqual(d3);
    expect(d2).toBe(350);

    actor.stop();
  });

  // A23: Deadlock fix -- null runTool transitions out of toolCallActive
  it("A23: tool request with null runTool transitions back to awaitingResponse (no deadlock)", async () => {
    const { actor } = createTestActor();

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "check board", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });
    expect(snap(actor).value).toBe("toolCallActive");

    await vi.advanceTimersByTimeAsync(10);

    expect(snap(actor).value).toBe("awaitingResponse");
    expect(snap(actor).context.toolRunning).toBe(false);
    expect(snap(actor).context.activeToolName).toBeNull();
    const lastTool = snap(actor).context.toolCallHistory.at(-1);
    expect((lastTool?.result as any)?.error).toBe("No tool runner");

    actor.stop();
  });

  // A24: Multiple consecutive tool calls work correctly
  it("A24: multiple consecutive tool calls resolve sequentially", async () => {
    const mockRunTool = vi.fn()
      .mockResolvedValueOnce({ image: "data:image/png;base64,first" })
      .mockResolvedValueOnce({ text: "note added" });
    const { actor } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "read and add note", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    expect(snap(actor).value).toBe("awaitingResponse");

    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });
    expect(snap(actor).value).toBe("toolCallActive");
    await vi.advanceTimersByTimeAsync(10);

    expect(snap(actor).value).toBe("awaitingResponse");
    expect(snap(actor).context.toolCallHistory).toHaveLength(1);
    expect(snap(actor).context.toolCallHistory[0].name).toBe("read_board");

    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t2", name: "add_sticky_note", args: { text: "idea" } });
    expect(snap(actor).value).toBe("toolCallActive");
    await vi.advanceTimersByTimeAsync(10);

    expect(snap(actor).value).toBe("awaitingResponse");
    expect(snap(actor).context.toolCallHistory).toHaveLength(2);
    expect(snap(actor).context.toolCallHistory[1].name).toBe("add_sticky_note");

    actor.stop();
  });

  // A25: TOOL_ERRORED in toolCallActive transitions back
  it("A25: TOOL_ERRORED transitions from toolCallActive to awaitingResponse", async () => {
    const mockRunTool = vi.fn().mockRejectedValue(new Error("Network error"));
    const { actor } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });

    actor.send({ type: "FLUX_END_OF_TURN", transcript: "read", confidence: 0.95 });
    vi.advanceTimersByTime(200);

    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });
    await vi.advanceTimersByTimeAsync(10);

    expect(snap(actor).value).toBe("awaitingResponse");
    expect(snap(actor).context.toolRunning).toBe(false);
    const lastEntry = snap(actor).context.toolCallHistory.at(-1);
    expect((lastEntry?.result as any)?.error).toBe("Network error");

    actor.stop();
  });

  // A26: Barge-in during toolCallActive sends interrupt
  it("A26: FLUX_END_OF_TURN during toolCallActive sends interrupt and debounces", async () => {
    const mockRunTool = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 5000))
    );
    const { actor, inspectedEvents } = createTestActor();

    actor.send({ type: "SET_RUN_TOOL", runTool: mockRunTool });
    actor.send({ type: "FLUX_END_OF_TURN", transcript: "read", confidence: 0.95 });
    vi.advanceTimersByTime(200);
    actor.send({ type: "SERVER_TOOL_REQUEST", toolCallId: "t1", name: "read_board" });
    expect(snap(actor).value).toBe("toolCallActive");

    actor.send({ type: "FLUX_START_OF_TURN" });
    const interrupted = inspectedEvents.some(
      (e) => e.event?.type === "SEND_INTERRUPT"
    );
    expect(snap(actor).context.turnId).toBe(2);

    actor.stop();
  });
});
