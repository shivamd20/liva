/**
 * TurnManagerActor – manages the turn lifecycle between user speech and server
 * response in the main voice pipeline.
 *
 * Responsibilities:
 * - Debounce EndOfTurn events (adaptive: 200-500ms based on confidence)
 * - Merge consecutive transcripts before sending
 * - Coordinate interrupts when user speaks during server response
 * - Track LLM streaming state and tool calls
 * - Spawn ToolRunnerActors for tool_request messages
 */
import { setup, assign, type ActorRefFrom, type AnyActorRef } from "xstate";
import { toolRunnerMachine, type ToolRunnerInput } from "./toolRunner.machine";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DEBOUNCE_MS = 500;
const HIGH_CONFIDENCE_DEBOUNCE_MS = 200;
const CONFIDENCE_THRESHOLD_HIGH = 0.9;
const CONFIDENCE_THRESHOLD_LOW = 0.75;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCallEntry {
  id: string;
  name: string;
  args?: unknown;
  result?: unknown;
  imageDataUrl?: string;
}

interface TurnManagerContext {
  pendingTranscript: string | null;
  turnId: number;
  debounceMs: number;
  eotConfidence: number | null;
  llmText: string;
  llmCompleteText: string | null;
  llmError: string | null;
  serverStatus: "thinking" | "synthesizing" | "interrupted" | null;
  toolRunning: boolean;
  activeToolName: string | null;
  toolCallHistory: ToolCallEntry[];
  ttsErrors: string[];
  assistantHistory: string[];
  activeToolRunner: ActorRefFrom<typeof toolRunnerMachine> | null;
  runTool: ((name: string, args?: unknown) => Promise<unknown>) | null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type TurnManagerMachineEvent =
  // Flux STT events
  | { type: "FLUX_START_OF_TURN" }
  | { type: "FLUX_EAGER_END_OF_TURN"; confidence?: number }
  | { type: "FLUX_TURN_RESUMED" }
  | { type: "FLUX_END_OF_TURN"; transcript: string; confidence?: number }
  // Server events
  | { type: "SERVER_STATUS"; value: "thinking" | "synthesizing" | "interrupted" }
  | { type: "SERVER_LLM_PARTIAL"; text: string }
  | { type: "SERVER_LLM_COMPLETE"; text: string }
  | { type: "SERVER_LLM_ERROR"; reason: string }
  | { type: "SERVER_TOOL_REQUEST"; toolCallId: string; name: string; args?: unknown }
  | { type: "SERVER_TTS_ERROR"; text: string }
  | { type: "SERVER_AUDIO_END" }
  // Tool runner events (from spawned child)
  | { type: "TOOL_COMPLETED"; toolCallId: string; toolName: string; args?: unknown; result: unknown; imageDataUrl?: string }
  | { type: "TOOL_ERRORED"; toolCallId: string; toolName: string; error: string }
  | { type: "TOOL_TIMED_OUT"; toolCallId: string; toolName: string }
  // Internal
  | { type: "DEBOUNCE_EXPIRED" }
  | { type: "RESET" }
  | { type: "SET_RUN_TOOL"; runTool: (name: string, args?: unknown) => Promise<unknown> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDebounce(confidence: number | undefined | null): number {
  if (confidence == null) return DEFAULT_DEBOUNCE_MS;
  if (confidence >= CONFIDENCE_THRESHOLD_HIGH) return HIGH_CONFIDENCE_DEBOUNCE_MS;
  if (confidence < CONFIDENCE_THRESHOLD_LOW) return DEFAULT_DEBOUNCE_MS;
  const ratio =
    (confidence - CONFIDENCE_THRESHOLD_LOW) /
    (CONFIDENCE_THRESHOLD_HIGH - CONFIDENCE_THRESHOLD_LOW);
  return Math.round(
    DEFAULT_DEBOUNCE_MS - ratio * (DEFAULT_DEBOUNCE_MS - HIGH_CONFIDENCE_DEBOUNCE_MS)
  );
}

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

export const turnManagerMachine = setup({
  types: {
    context: {} as TurnManagerContext,
    events: {} as TurnManagerMachineEvent,
  },
  actors: {
    toolRunner: toolRunnerMachine,
  },
  guards: {
    hasPendingTranscript: ({ context }) => context.pendingTranscript !== null && context.pendingTranscript.trim().length > 0,
    isResponseActive: ({ context }) =>
      context.llmText.length > 0 || context.serverStatus === "thinking" || context.serverStatus === "synthesizing",
  },
  delays: {
    adaptiveDebounce: ({ context }) => context.debounceMs,
    interruptedClearDelay: 600,
  },
}).createMachine({
  id: "turnManager",
  context: {
    pendingTranscript: null,
    turnId: 0,
    debounceMs: DEFAULT_DEBOUNCE_MS,
    eotConfidence: null,
    llmText: "",
    llmCompleteText: null,
    llmError: null,
    serverStatus: null,
    toolRunning: false,
    activeToolName: null,
    toolCallHistory: [],
    ttsErrors: [],
    assistantHistory: [],
    activeToolRunner: null,
    runTool: null,
  },

  initial: "idle",

  on: {
    SET_RUN_TOOL: {
      actions: assign(({ event }) => ({
        runTool: (event as Extract<TurnManagerMachineEvent, { type: "SET_RUN_TOOL" }>).runTool,
      })),
    },

    SERVER_STATUS: {
      actions: [
        assign({ serverStatus: ({ event }) => event.value }),
        ({ event, self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "SERVER_STATUS_CHANGED", value: event.value });
        },
      ],
    },

    SERVER_LLM_PARTIAL: {
      actions: [
        assign({ llmText: ({ context, event }) => context.llmText + event.text, serverStatus: null }),
        ({ event, self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "LLM_TEXT_CHANGED", text: event.text, complete: false });
        },
      ],
    },

    SERVER_LLM_COMPLETE: {
      actions: [
        assign({
          llmCompleteText: ({ event }) => event.text,
          llmText: "",
          serverStatus: null,
          assistantHistory: ({ context, event }) => [event.text, ...context.assistantHistory].slice(0, 20),
        }),
        ({ event, self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "LLM_TEXT_CHANGED", text: event.text, complete: true });
        },
      ],
    },

    SERVER_LLM_ERROR: {
      actions: [
        assign({ llmError: ({ event }) => event.reason, llmText: "", serverStatus: null }),
        ({ event, self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "ERROR", error: event.reason, source: "llm" });
        },
      ],
    },

    SERVER_TTS_ERROR: {
      actions: assign({
        ttsErrors: ({ context, event }) => [...context.ttsErrors, event.text].slice(-10),
      }),
    },

    SERVER_TOOL_REQUEST: {
      actions: [
        assign({
          toolRunning: true,
          activeToolName: ({ event }) => event.name,
        }),
        ({ event, self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "TOOL_STATE_CHANGED", running: true, name: event.name });
        },
      ],
    },

    TOOL_COMPLETED: {
      actions: [
        assign({
          toolRunning: false,
          activeToolName: null,
          toolCallHistory: ({ context, event }) =>
            [
              ...context.toolCallHistory,
              {
                id: event.toolCallId,
                name: event.toolName,
                args: event.args,
                result: event.result,
                imageDataUrl: event.imageDataUrl,
              },
            ].slice(-50),
        }),
        ({ self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "TOOL_STATE_CHANGED", running: false, name: null });
        },
      ],
    },

    TOOL_ERRORED: {
      actions: [
        assign({
          toolRunning: false,
          activeToolName: null,
          toolCallHistory: ({ context, event }) =>
            [
              ...context.toolCallHistory,
              {
                id: event.toolCallId,
                name: event.toolName,
                result: { error: event.error },
              },
            ].slice(-50),
        }),
        ({ self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "TOOL_STATE_CHANGED", running: false, name: null });
        },
      ],
    },

    TOOL_TIMED_OUT: {
      actions: [
        assign({
          toolRunning: false,
          activeToolName: null,
          toolCallHistory: ({ context, event }) =>
            [
              ...context.toolCallHistory,
              {
                id: event.toolCallId,
                name: event.toolName,
                result: { error: "Tool timed out" },
              },
            ].slice(-50),
        }),
        ({ self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "TOOL_STATE_CHANGED", running: false, name: null });
        },
      ],
    },

    RESET: {
      target: ".idle",
      actions: assign({
        pendingTranscript: null,
        llmText: "",
        llmCompleteText: null,
        llmError: null,
        serverStatus: null,
        toolRunning: false,
        activeToolName: null,
        ttsErrors: [],
      }),
    },
  },

  states: {
    idle: {
      on: {
        FLUX_START_OF_TURN: {
          actions: [
            assign({ turnId: ({ context }) => context.turnId + 1 }),
          ],
        },

        FLUX_END_OF_TURN: {
          target: "debouncing",
          actions: assign({
            pendingTranscript: ({ context, event }) => {
              const existing = context.pendingTranscript;
              const t = event.transcript.trim();
              return existing ? `${existing} ${t}` : t;
            },
            eotConfidence: ({ event }) => event.confidence ?? null,
            debounceMs: ({ event }) => computeDebounce(event.confidence),
          }),
        },
      },
    },

    debouncing: {
      after: {
        adaptiveDebounce: [
          {
            guard: "hasPendingTranscript",
            target: "awaitingResponse",
            actions: [
              ({ context, self }) => {
                const parent = (self as AnyActorRef)._parent;
                if (!parent || !context.pendingTranscript) return;
                parent.send({
                  type: "SEND_TRANSCRIPT_FINAL",
                  text: context.pendingTranscript,
                  turnId: String(context.turnId),
                });
              },
              assign({
                llmText: "",
                llmCompleteText: null,
                llmError: null,
                ttsErrors: [],
              }),
            ],
          },
          { target: "idle" },
        ],
      },

      on: {
        FLUX_TURN_RESUMED: {
          target: "idle",
          actions: assign({ pendingTranscript: null }),
        },

        FLUX_END_OF_TURN: {
          target: "debouncing",
          reenter: true,
          actions: assign({
            pendingTranscript: ({ context, event }) => {
              const existing = context.pendingTranscript;
              const t = event.transcript.trim();
              return existing ? `${existing} ${t}` : t;
            },
            eotConfidence: ({ event }) => event.confidence ?? null,
            debounceMs: ({ event }) => computeDebounce(event.confidence),
          }),
        },

        FLUX_START_OF_TURN: {
          target: "idle",
          actions: [
            assign({
              turnId: ({ context }) => context.turnId + 1,
              pendingTranscript: null,
            }),
          ],
        },
      },
    },

    awaitingResponse: {
      entry: assign({ pendingTranscript: null }),

      on: {
        FLUX_START_OF_TURN: {
          actions: [
            assign({ turnId: ({ context }) => context.turnId + 1 }),
            ({ self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) parent.send({ type: "SEND_INTERRUPT" });
            },
          ],
        },

        SERVER_LLM_COMPLETE: {
          target: "idle",
          actions: [
            assign({
              llmCompleteText: ({ event }) => event.text,
              llmText: "",
              serverStatus: null,
              assistantHistory: ({ context, event }) => [event.text, ...context.assistantHistory].slice(0, 20),
            }),
            ({ event, self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) parent.send({ type: "LLM_TEXT_CHANGED", text: event.text, complete: true });
            },
          ],
        },

        SERVER_AUDIO_END: {
          target: "idle",
        },

        FLUX_END_OF_TURN: {
          actions: [
            assign({
              pendingTranscript: ({ event }) => event.transcript.trim() || null,
              eotConfidence: ({ event }) => event.confidence ?? null,
              debounceMs: ({ event }) => computeDebounce(event.confidence),
            }),
            ({ self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) parent.send({ type: "SEND_INTERRUPT" });
            },
          ],
          target: "debouncing",
          reenter: true,
        },

        SERVER_TOOL_REQUEST: {
          target: "toolCallActive",
          actions: [
            assign({
              toolRunning: true,
              activeToolName: ({ event }) => event.name,
            }),
            ({ event, self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) parent.send({ type: "TOOL_STATE_CHANGED", running: true, name: event.name });
            },
          ],
        },
      },
    },

    toolCallActive: {
      entry: ({ context, event, self }) => {
        if (event.type !== "SERVER_TOOL_REQUEST") return;
        if (!context.runTool) {
          const parent = (self as AnyActorRef)._parent;
          const errResult = { error: "No tool runner" };
          if (parent) {
            parent.send({
              type: "SEND_TOOL_RESULT",
              toolCallId: event.toolCallId,
              result: errResult,
            });
          }
          (self as AnyActorRef).send({
            type: "TOOL_ERRORED",
            toolCallId: event.toolCallId,
            toolName: event.name,
            error: "No tool runner",
          });
          return;
        }
        context.runTool(event.name, event.args)
          .then((result) => {
            (self as AnyActorRef).send({
              type: "TOOL_COMPLETED",
              toolCallId: event.toolCallId,
              toolName: event.name,
              args: event.args,
              result,
              imageDataUrl:
                result && typeof result === "object" && "image" in (result as Record<string, unknown>)
                  ? String((result as Record<string, unknown>).image)
                  : undefined,
            });
          })
          .catch((err) => {
            (self as AnyActorRef).send({
              type: "TOOL_ERRORED",
              toolCallId: event.toolCallId,
              toolName: event.name,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      },

      on: {
        TOOL_COMPLETED: {
          target: "awaitingResponse",
          actions: [
            assign({
              toolRunning: false,
              activeToolName: null,
              toolCallHistory: ({ context, event }) =>
                [
                  ...context.toolCallHistory,
                  {
                    id: event.toolCallId,
                    name: event.toolName,
                    args: event.args,
                    result: event.result,
                    imageDataUrl: event.imageDataUrl,
                  },
                ].slice(-50),
            }),
            ({ event, self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) {
                parent.send({ type: "TOOL_STATE_CHANGED", running: false, name: null });
                parent.send({
                  type: "SEND_TOOL_RESULT",
                  toolCallId: event.toolCallId,
                  result: event.result,
                });
              }
            },
          ],
        },

        TOOL_ERRORED: {
          target: "awaitingResponse",
          actions: [
            assign({
              toolRunning: false,
              activeToolName: null,
              toolCallHistory: ({ context, event }) =>
                [
                  ...context.toolCallHistory,
                  {
                    id: event.toolCallId,
                    name: event.toolName,
                    result: { error: event.error },
                  },
                ].slice(-50),
            }),
            ({ event, self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) {
                parent.send({ type: "TOOL_STATE_CHANGED", running: false, name: null });
                parent.send({
                  type: "SEND_TOOL_RESULT",
                  toolCallId: event.toolCallId,
                  result: { error: event.error },
                });
              }
            },
          ],
        },

        FLUX_START_OF_TURN: {
          actions: [
            assign({ turnId: ({ context }) => context.turnId + 1 }),
            ({ self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) parent.send({ type: "SEND_INTERRUPT" });
            },
          ],
        },
      },
    },
  },
});
