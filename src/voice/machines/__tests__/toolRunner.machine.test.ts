import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createActor } from "xstate";
import { toolRunnerMachine, type ToolRunnerInput } from "../toolRunner.machine";

function createRunnerActor(
  runTool: (name: string, args?: unknown) => Promise<unknown>,
  toolCallId = "tc-1",
  toolName = "read_board",
  args?: unknown
) {
  const input: ToolRunnerInput = { toolCallId, toolName, args, runTool };
  const actor = createActor(toolRunnerMachine, { input });
  actor.start();
  return actor;
}

describe("toolRunner.machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // D1: Tool completes successfully
  it("D1: transitions to done when tool resolves", async () => {
    const runTool = vi.fn().mockResolvedValue({ elements: [1, 2, 3] });
    const actor = createRunnerActor(runTool);

    expect(actor.getSnapshot().value).toBe("running");

    await vi.advanceTimersByTimeAsync(10);

    expect(actor.getSnapshot().value).toBe("done");
    expect(actor.getSnapshot().context.result).toEqual({ elements: [1, 2, 3] });
    expect(actor.getSnapshot().context.error).toBeNull();

    actor.stop();
  });

  // D2: Tool throws error
  it("D2: transitions to errored when tool rejects", async () => {
    const runTool = vi.fn().mockRejectedValue(new Error("Permission denied"));
    const actor = createRunnerActor(runTool);

    await vi.advanceTimersByTimeAsync(10);

    expect(actor.getSnapshot().value).toBe("errored");
    expect(actor.getSnapshot().context.error).toBe("Permission denied");

    actor.stop();
  });

  // D3: Tool exceeds 30s timeout
  it("D3: transitions to timedOut after 30 seconds", async () => {
    const runTool = vi.fn().mockImplementation(
      () => new Promise(() => {}) // never resolves
    );
    const actor = createRunnerActor(runTool);

    expect(actor.getSnapshot().value).toBe("running");

    await vi.advanceTimersByTimeAsync(30_000);

    expect(actor.getSnapshot().value).toBe("timedOut");

    actor.stop();
  });

  // D4: Tool completes just before timeout
  it("D4: tool that resolves at 29999ms reaches done, not timedOut", async () => {
    const runTool = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 29_999))
    );
    const actor = createRunnerActor(runTool);

    await vi.advanceTimersByTimeAsync(29_999);

    expect(actor.getSnapshot().value).toBe("done");
    expect(actor.getSnapshot().context.result).toEqual({ ok: true });

    actor.stop();
  });

  // D5: Tool returns null
  it("D5: tool returning null reaches done with result: null", async () => {
    const runTool = vi.fn().mockResolvedValue(null);
    const actor = createRunnerActor(runTool);

    await vi.advanceTimersByTimeAsync(10);

    expect(actor.getSnapshot().value).toBe("done");
    expect(actor.getSnapshot().context.result).toBeNull();
    expect(actor.getSnapshot().context.error).toBeNull();

    actor.stop();
  });

  // D6: Tool returns undefined
  it("D6: tool returning undefined reaches done with result: undefined", async () => {
    const runTool = vi.fn().mockResolvedValue(undefined);
    const actor = createRunnerActor(runTool);

    await vi.advanceTimersByTimeAsync(10);

    expect(actor.getSnapshot().value).toBe("done");
    expect(actor.getSnapshot().context.result).toBeUndefined();
    expect(actor.getSnapshot().context.error).toBeNull();

    actor.stop();
  });

  // D7: Tool returns image result
  it("D7: tool returning imageDataUrl is stored in result", async () => {
    const imageData = { image: "data:image/png;base64,iVBOR..." };
    const runTool = vi.fn().mockResolvedValue(imageData);
    const actor = createRunnerActor(runTool);

    await vi.advanceTimersByTimeAsync(10);

    expect(actor.getSnapshot().value).toBe("done");
    expect(actor.getSnapshot().context.result).toEqual(imageData);
    expect((actor.getSnapshot().context.result as any).image).toMatch(/^data:image/);

    actor.stop();
  });

  // D8: Tool input propagation
  it("D8: context stores toolName, toolCallId, and args from input", () => {
    const runTool = vi.fn().mockImplementation(() => new Promise(() => {}));
    const actor = createRunnerActor(runTool, "tc-42", "highlight_area", { description: "header" });

    const ctx = actor.getSnapshot().context;
    expect(ctx.toolCallId).toBe("tc-42");
    expect(ctx.toolName).toBe("highlight_area");
    expect(ctx.args).toEqual({ description: "header" });

    actor.stop();
  });
});
