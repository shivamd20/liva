/**
 * VoiceOrchestratorActor – top-level machine for the main voice pipeline.
 *
 * Composes: SessionWebSocket, FluxWebSocket, AudioCapture, AudioPlayback,
 * and TurnManager as child actors. Routes events between them.
 *
 * This is ONLY for the board-editor voice mode. Voice Shots is separate.
 */
import { setup, assign, type ActorRefFrom, type AnyActorRef } from "xstate";
import { sessionWebSocketMachine } from "./sessionWebSocket.machine";
import { fluxWebSocketMachine } from "./fluxWebSocket.machine";
import { audioPlaybackMachine } from "./audioPlayback.machine";
import { audioCaptureActor, type AudioCaptureInput } from "./audioCapture.actor";
import { turnManagerMachine, type ToolCallEntry } from "./turnManager.machine";
import type { OrbState, ServerMessage, WsStatus } from "./types";
import type { FluxEventPayload, FluxEventType } from "../flux-events";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface VoiceOrchestratorInput {
  sessionId: string;
  systemPrompt: string;
  serverBaseUrl: string;
  runTool?: (name: string, args?: unknown) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface OrchestratorContext {
  sessionId: string;
  systemPrompt: string;
  serverBaseUrl: string;
  runTool: ((name: string, args?: unknown) => Promise<unknown>) | null;

  sessionWsStatus: WsStatus;
  fluxWsStatus: WsStatus;
  captureReady: boolean;
  isPlaying: boolean;
  serverStatus: "thinking" | "synthesizing" | "interrupted" | null;
  toolRunning: boolean;
  activeToolName: string | null;
  orbState: OrbState;
  error: string | null;

  llmText: string;
  llmCompleteText: string | null;
  llmError: string | null;
  assistantHistory: string[];
  toolCallHistory: ToolCallEntry[];
  ttsErrors: string[];

  liveTranscript: string;
  transcriptHistory: string[];
  fluxState: { event?: string; turnIndex?: number; endOfTurnConf?: number };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type OrchestratorEvent =
  | { type: "VOICE_START" }
  | { type: "VOICE_STOP" }
  // From SessionWebSocket child
  | { type: "SESSION_STATUS_CHANGED"; status: WsStatus; error?: string }
  | { type: "SESSION_MESSAGE"; msg: ServerMessage }
  | { type: "SESSION_BINARY"; data: ArrayBuffer }
  // From FluxWebSocket child
  | { type: "FLUX_STATUS_CHANGED"; status: WsStatus }
  | { type: "FLUX_EVENT"; eventType: FluxEventType; payload: FluxEventPayload }
  // From AudioCapture child
  | { type: "CAPTURE_READY" }
  | { type: "CAPTURE_ERROR"; error: string }
  | { type: "CAPTURE_STOPPED" }
  // From AudioPlayback child
  | { type: "PLAYBACK_STATE_CHANGED"; isPlaying: boolean }
  // From TurnManager child
  | { type: "SERVER_STATUS_CHANGED"; value: "thinking" | "synthesizing" | "interrupted" | null }
  | { type: "TOOL_STATE_CHANGED"; running: boolean; name: string | null }
  | { type: "LLM_TEXT_CHANGED"; text: string; complete: boolean }
  | { type: "SEND_TRANSCRIPT_FINAL"; text: string; turnId: string }
  | { type: "SEND_INTERRUPT" }
  | { type: "SEND_TOOL_RESULT"; toolCallId: string; result: unknown }
  | { type: "ERROR"; error: string; source: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSessionWsUrl(baseUrl: string, sessionId: string): string {
  const base = baseUrl.replace(/^http/, "ws");
  const path = base.endsWith("/") ? "" : "/";
  return `${base}${path}v2/ws/${sessionId}`;
}

function buildFluxWsUrl(baseUrl: string, sessionId: string): string {
  const base = baseUrl.replace(/^http/, "ws");
  const path = base.endsWith("/") ? "" : "/";
  return `${base}${path}v2/flux/${sessionId}`;
}

function deriveOrbState(ctx: OrchestratorContext): OrbState {
  if (ctx.error) return "error";
  if (ctx.sessionWsStatus === "connecting" || ctx.fluxWsStatus === "connecting") return "connecting";
  if (ctx.toolRunning && ctx.activeToolName === "read_board") return "readingBoard";
  if (ctx.toolRunning) return "toolRunning";
  if (ctx.serverStatus === "thinking") return "thinking";
  if (ctx.serverStatus === "synthesizing" || ctx.isPlaying) return "speaking";
  if (ctx.fluxWsStatus === "connected") return "listening";
  return "idle";
}

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

export const voiceOrchestratorMachine = setup({
  types: {
    context: {} as OrchestratorContext,
    events: {} as OrchestratorEvent,
    input: {} as VoiceOrchestratorInput,
  },
  actors: {
    sessionWebSocket: sessionWebSocketMachine,
    fluxWebSocket: fluxWebSocketMachine,
    audioPlayback: audioPlaybackMachine,
    audioCapture: audioCaptureActor,
    turnManager: turnManagerMachine,
  },
}).createMachine({
  id: "voiceOrchestrator",
  context: ({ input }) => ({
    sessionId: input.sessionId,
    systemPrompt: input.systemPrompt,
    serverBaseUrl: input.serverBaseUrl,
    runTool: input.runTool ?? null,

    sessionWsStatus: "disconnected",
    fluxWsStatus: "disconnected",
    captureReady: false,
    isPlaying: false,
    serverStatus: null,
    toolRunning: false,
    activeToolName: null,
    orbState: "idle",
    error: null,

    llmText: "",
    llmCompleteText: null,
    llmError: null,
    assistantHistory: [],
    toolCallHistory: [],
    ttsErrors: [],

    liveTranscript: "",
    transcriptHistory: [],
    fluxState: {},
  }),

  initial: "idle",

  states: {
    idle: {
      on: {
        VOICE_START: { target: "active" },
      },
    },

    active: {
      invoke: [
        {
          id: "sessionWs",
          src: "sessionWebSocket",
          input: ({ context }) => ({
            buildUrl: () => buildSessionWsUrl(context.serverBaseUrl, context.sessionId),
          }),
        },
        {
          id: "fluxWs",
          src: "fluxWebSocket",
          input: ({ context }) => ({
            buildUrl: () => buildFluxWsUrl(context.serverBaseUrl, context.sessionId),
          }),
        },
        {
          id: "playback",
          src: "audioPlayback",
        },
        {
          id: "turnMgr",
          src: "turnManager",
        },
      ],

      entry: [
        assign({
          error: null,
          llmText: "",
          llmCompleteText: null,
          llmError: null,
          ttsErrors: [],
          serverStatus: null,
          toolRunning: false,
          activeToolName: null,
          liveTranscript: "",
          fluxState: {},
        }),
        ({ self }) => {
          const sessionWs = (self as AnyActorRef).system?.get("sessionWs");
          const fluxWs = (self as AnyActorRef).system?.get("fluxWs");
          if (sessionWs) sessionWs.send({ type: "CONNECT" });
          if (fluxWs) fluxWs.send({ type: "CONNECT" });

          const playback = (self as AnyActorRef).system?.get("playback");
          if (playback) playback.send({ type: "INIT_CONTEXT" });
        },
      ],

      exit: [
        ({ self }) => {
          const sessionWs = (self as AnyActorRef).system?.get("sessionWs");
          const fluxWs = (self as AnyActorRef).system?.get("fluxWs");
          const playback = (self as AnyActorRef).system?.get("playback");
          if (sessionWs) sessionWs.send({ type: "DISCONNECT" });
          if (fluxWs) fluxWs.send({ type: "DISCONNECT" });
          if (playback) playback.send({ type: "STOP_PLAYBACK" });
        },
        assign({
          sessionWsStatus: "disconnected" as WsStatus,
          fluxWsStatus: "disconnected" as WsStatus,
          isPlaying: false,
          captureReady: false,
          orbState: "idle" as OrbState,
        }),
      ],

      on: {
        VOICE_STOP: { target: "idle" },

        // ----- Session WS status -----
        SESSION_STATUS_CHANGED: {
          actions: [
            assign({
              sessionWsStatus: ({ event }) => event.status,
              error: ({ context, event }) => {
                if (event.status === "error") return event.error ?? "Session connection error";
                if (event.status === "connected") return null;
                return context.error;
              },
            }),
            assign({ orbState: ({ context }) => deriveOrbState(context) }),
            ({ context, self }) => {
              if (context.sessionWsStatus === "connected" && context.systemPrompt) {
                const sessionWs = (self as AnyActorRef).system?.get("sessionWs");
                if (sessionWs) {
                  sessionWs.send({
                    type: "SEND",
                    data: JSON.stringify({
                      type: "session.init",
                      systemPrompt: context.systemPrompt,
                    }),
                  });
                }
              }
            },
          ],
        },

        // ----- Session WS messages -----
        SESSION_MESSAGE: {
          actions: ({ event, self }) => {
            const turnMgr = (self as AnyActorRef).system?.get("turnMgr");
            if (!turnMgr) return;
            const msg = event.msg;
            switch (msg.type) {
              case "status":
                turnMgr.send({ type: "SERVER_STATUS", value: msg.value });
                break;
              case "llm_partial":
                turnMgr.send({ type: "SERVER_LLM_PARTIAL", text: msg.text });
                break;
              case "llm_complete":
                turnMgr.send({ type: "SERVER_LLM_COMPLETE", text: msg.text });
                break;
              case "llm_error":
                turnMgr.send({ type: "SERVER_LLM_ERROR", reason: msg.reason });
                break;
              case "tool_request":
                turnMgr.send({
                  type: "SERVER_TOOL_REQUEST",
                  toolCallId: msg.toolCallId,
                  name: msg.name,
                  args: msg.args,
                });
                break;
              case "tts_error":
                turnMgr.send({ type: "SERVER_TTS_ERROR", text: msg.text });
                break;
              case "audio_end":
                turnMgr.send({ type: "SERVER_AUDIO_END" });
                break;
            }
          },
        },

        // ----- Session WS binary (TTS audio) -----
        SESSION_BINARY: {
          actions: ({ event, self }) => {
            const playback = (self as AnyActorRef).system?.get("playback");
            if (playback) playback.send({ type: "ENQUEUE_AUDIO", buffer: event.data });
          },
        },

        // ----- Flux WS status -----
        FLUX_STATUS_CHANGED: {
          actions: [
            assign({
              fluxWsStatus: ({ event }) => event.status,
            }),
            assign({ orbState: ({ context }) => deriveOrbState(context) }),
          ],
        },

        // ----- Flux events (STT) -----
        FLUX_EVENT: {
          actions: [
            assign({
              fluxState: ({ event }) => ({
                event: event.eventType,
                turnIndex: event.payload.turn_index,
                endOfTurnConf: event.payload.end_of_turn_confidence,
              }),
              liveTranscript: ({ context, event }) =>
                event.payload.transcript !== undefined ? event.payload.transcript : context.liveTranscript,
              transcriptHistory: ({ context, event }) => {
                if (event.eventType === "EndOfTurn" && event.payload.transcript?.trim()) {
                  return [event.payload.transcript.trim(), ...context.transcriptHistory].slice(0, 50);
                }
                return context.transcriptHistory;
              },
            }),
            ({ event, self }) => {
              const turnMgr = (self as AnyActorRef).system?.get("turnMgr");
              if (!turnMgr) return;
              switch (event.eventType) {
                case "StartOfTurn":
                  turnMgr.send({ type: "FLUX_START_OF_TURN" });
                  break;
                case "EagerEndOfTurn":
                  turnMgr.send({
                    type: "FLUX_EAGER_END_OF_TURN",
                    confidence: event.payload.end_of_turn_confidence,
                  });
                  break;
                case "TurnResumed":
                  turnMgr.send({ type: "FLUX_TURN_RESUMED" });
                  break;
                case "EndOfTurn":
                  if (event.payload.transcript?.trim()) {
                    turnMgr.send({
                      type: "FLUX_END_OF_TURN",
                      transcript: event.payload.transcript,
                      confidence: event.payload.end_of_turn_confidence,
                    });
                  }
                  break;
              }
            },
          ],
        },

        // ----- Audio capture status -----
        CAPTURE_READY: {
          actions: assign({ captureReady: true }),
        },
        CAPTURE_ERROR: {
          actions: [
            assign({ error: ({ event }) => event.error, captureReady: false }),
            assign({ orbState: ({ context }) => deriveOrbState(context) }),
          ],
        },

        // ----- Playback status -----
        PLAYBACK_STATE_CHANGED: {
          actions: [
            assign({ isPlaying: ({ event }) => event.isPlaying }),
            assign({ orbState: ({ context }) => deriveOrbState(context) }),
          ],
        },

        // ----- Turn manager -> orchestrator -----
        SERVER_STATUS_CHANGED: {
          actions: [
            assign({
              serverStatus: ({ event }) =>
                "value" in event
                  ? (event as { type: string; value: "thinking" | "synthesizing" | "interrupted" | null }).value
                  : null,
            }),
            assign({ orbState: ({ context }) => deriveOrbState(context) }),
          ],
        },

        TOOL_STATE_CHANGED: {
          actions: [
            assign({
              toolRunning: ({ event }) => event.running,
              activeToolName: ({ event }) => event.name,
            }),
            assign({ orbState: ({ context }) => deriveOrbState(context) }),
          ],
        },

        LLM_TEXT_CHANGED: {
          actions: assign({
            llmText: ({ context, event }) => (event.complete ? "" : context.llmText + event.text),
            llmCompleteText: ({ event }) => (event.complete ? event.text : null),
            assistantHistory: ({ context, event }) =>
              event.complete ? [event.text, ...context.assistantHistory].slice(0, 20) : context.assistantHistory,
          }),
        },

        SEND_TRANSCRIPT_FINAL: {
          actions: [
            ({ event, self, context }) => {
              if (context.isPlaying || context.llmText) {
                const playback = (self as AnyActorRef).system?.get("playback");
                if (playback) playback.send({ type: "STOP_PLAYBACK" });
                const sessionWs = (self as AnyActorRef).system?.get("sessionWs");
                if (sessionWs) {
                  sessionWs.send({
                    type: "SEND",
                    data: JSON.stringify({ type: "control.interrupt" }),
                  });
                }
              }
              const sessionWs = (self as AnyActorRef).system?.get("sessionWs");
              if (sessionWs) {
                sessionWs.send({
                  type: "SEND",
                  data: JSON.stringify({
                    type: "transcript_final",
                    text: event.text,
                    turnId: event.turnId,
                  }),
                });
              }
            },
          ],
        },

        SEND_INTERRUPT: {
          actions: [
            ({ self }) => {
              const playback = (self as AnyActorRef).system?.get("playback");
              if (playback) playback.send({ type: "STOP_PLAYBACK" });
              const sessionWs = (self as AnyActorRef).system?.get("sessionWs");
              if (sessionWs) {
                sessionWs.send({
                  type: "SEND",
                  data: JSON.stringify({ type: "control.interrupt" }),
                });
              }
            },
          ],
        },

        SEND_TOOL_RESULT: {
          actions: ({ event, self }) => {
            const sessionWs = (self as AnyActorRef).system?.get("sessionWs");
            if (sessionWs) {
              sessionWs.send({
                type: "SEND",
                data: JSON.stringify({
                  type: "tool_result",
                  toolCallId: event.toolCallId,
                  result: event.result,
                }),
              });
            }
          },
        },

        ERROR: {
          actions: [
            assign({ error: ({ event }) => event.error }),
            assign({ orbState: ({ context }) => deriveOrbState(context) }),
          ],
        },
      },
    },
  },
});
