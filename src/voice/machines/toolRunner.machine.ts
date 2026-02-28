/**
 * ToolRunnerActor – spawned per tool_request from the server.
 *
 * Invokes the runTool promise, enforces a 30s timeout, and sends the result
 * (or error/timeout) back to the parent.
 */
import { setup, assign, fromPromise, type AnyActorRef } from "xstate";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOOL_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Input / context
// ---------------------------------------------------------------------------

export interface ToolRunnerInput {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  runTool: (name: string, args?: unknown) => Promise<unknown>;
}

interface ToolRunnerContext {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result: unknown | null;
  error: string | null;
  runTool: (name: string, args?: unknown) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type ToolRunnerEvent =
  | { type: "TOOL_RESULT"; result: unknown }
  | { type: "TOOL_ERROR"; error: string }
  | { type: "TIMEOUT" };

// ---------------------------------------------------------------------------
// Tool execution promise actor
// ---------------------------------------------------------------------------

const executeTool = fromPromise<unknown, { runTool: (n: string, a?: unknown) => Promise<unknown>; name: string; args?: unknown }>(
  async ({ input }) => {
    return await input.runTool(input.name, input.args);
  }
);

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

export const toolRunnerMachine = setup({
  types: {
    context: {} as ToolRunnerContext,
    events: {} as ToolRunnerEvent,
    input: {} as ToolRunnerInput,
  },
  actors: {
    executeTool,
  },
  delays: {
    toolTimeout: TOOL_TIMEOUT_MS,
  },
}).createMachine({
  id: "toolRunner",
  context: ({ input }) => ({
    toolCallId: input.toolCallId,
    toolName: input.toolName,
    args: input.args,
    result: null,
    error: null,
    runTool: input.runTool,
  }),

  initial: "running",

  states: {
    running: {
      invoke: {
        id: "executeTool",
        src: "executeTool",
        input: ({ context }) => ({
          runTool: context.runTool,
          name: context.toolName,
          args: context.args,
        }),
        onDone: {
          target: "done",
          actions: [
            assign({ result: ({ event }) => event.output }),
            ({ context, event, self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) {
                const resultObj =
                  event.output && typeof event.output === "object"
                    ? (event.output as Record<string, unknown>)
                    : null;
                const imageDataUrl =
                  resultObj && typeof resultObj.image === "string"
                    ? (resultObj.image as string)
                    : undefined;
                parent.send({
                  type: "TOOL_COMPLETED",
                  toolCallId: context.toolCallId,
                  toolName: context.toolName,
                  args: context.args,
                  result: event.output,
                  imageDataUrl,
                });
              }
            },
          ],
        },
        onError: {
          target: "errored",
          actions: [
            assign({
              error: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
            }),
            ({ context, event, self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) {
                const errMsg =
                  event.error instanceof Error ? event.error.message : String(event.error);
                parent.send({
                  type: "TOOL_ERRORED",
                  toolCallId: context.toolCallId,
                  toolName: context.toolName,
                  error: errMsg,
                });
              }
            },
          ],
        },
      },

      after: {
        toolTimeout: {
          target: "timedOut",
          actions: ({ context, self }) => {
            const parent = (self as AnyActorRef)._parent;
            if (parent) {
              parent.send({
                type: "TOOL_TIMED_OUT",
                toolCallId: context.toolCallId,
                toolName: context.toolName,
              });
            }
          },
        },
      },
    },

    done: { type: "final" },
    timedOut: { type: "final" },
    errored: { type: "final" },
  },
});
