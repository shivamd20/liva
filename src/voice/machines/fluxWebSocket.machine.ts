/**
 * FluxWebSocketActor – manages the Flux STT WebSocket lifecycle.
 *
 * Handles: connect, reconnect with exponential backoff, keepalive silence
 * frames, tab visibility recovery, and Flux event forwarding.
 */
import { setup, assign, fromCallback, type AnyActorRef } from "xstate";
import {
  parseFluxEvent,
  isFluxEventPayload,
  type FluxEventPayload,
  type FluxEventType,
} from "../flux-events";
import type { ReconnectConfig } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RECONNECT: ReconnectConfig = {
  enabled: true,
  maxRetries: 5,
  baseMs: 1_000,
  maxMs: 30_000,
};

const KEEPALIVE_INTERVAL_MS = 4_000;
const KEEPALIVE_IDLE_MS = 3_500;
const KEEPALIVE_SILENCE_SAMPLES = 320;
const SILENCE_FRAME = new Int16Array(KEEPALIVE_SILENCE_SAMPLES).fill(0).buffer;

// ---------------------------------------------------------------------------
// Input / context
// ---------------------------------------------------------------------------

export interface FluxWsInput {
  buildUrl: () => string;
  reconnect?: Partial<ReconnectConfig>;
}

interface FluxWsContext {
  buildUrl: () => string;
  reconnect: ReconnectConfig;
  ws: WebSocket | null;
  retryCount: number;
  lastSendTime: number;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type FluxWsMachineEvent =
  | { type: "CONNECT" }
  | { type: "DISCONNECT" }
  | { type: "SEND_AUDIO"; chunk: ArrayBuffer }
  | { type: "WS_OPEN" }
  | { type: "WS_CLOSE"; code: number; reason: string; wasClean: boolean }
  | { type: "WS_ERROR" }
  | { type: "FLUX_EVENT"; eventType: FluxEventType; payload: FluxEventPayload }
  | { type: "KEEPALIVE_TICK" }
  | { type: "VISIBILITY_VISIBLE" };

// ---------------------------------------------------------------------------
// Callback actor: WebSocket bridge for Flux
// ---------------------------------------------------------------------------

type FluxBridgeInput = { buildUrl: () => string };

const fluxBridge = fromCallback<FluxWsMachineEvent, FluxBridgeInput>(
  ({ sendBack, receive, input }) => {
    let ws: WebSocket | null = null;
    const BACKPRESSURE_BYTES = 128 * 1024;

    function open() {
      if (ws) {
        try { ws.close(); } catch { /* noop */ }
      }
      const url = input.buildUrl();
      ws = new WebSocket(url);

      ws.onopen = () => sendBack({ type: "WS_OPEN" });

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== "string") return;
        const payload = parseFluxEvent(event.data);
        if (payload && isFluxEventPayload(payload) && payload.event) {
          sendBack({
            type: "FLUX_EVENT",
            eventType: payload.event,
            payload,
          });
        }
      };

      ws.onclose = (ev: CloseEvent) => {
        sendBack({
          type: "WS_CLOSE",
          code: ev.code,
          reason: ev.reason,
          wasClean: ev.wasClean,
        });
      };

      ws.onerror = () => sendBack({ type: "WS_ERROR" });
    }

    receive((event) => {
      if (event.type === "CONNECT") {
        open();
      }
      if (event.type === "DISCONNECT") {
        if (ws) {
          try { ws.close(1000, "client disconnect"); } catch { /* noop */ }
          ws = null;
        }
      }
      if (event.type === "SEND_AUDIO" && ws?.readyState === WebSocket.OPEN) {
        if (ws.bufferedAmount > BACKPRESSURE_BYTES) return;
        try { ws.send(event.chunk); } catch { /* noop */ }
      }
    });

    return () => {
      if (ws) {
        try { ws.close(1000, "actor stopped"); } catch { /* noop */ }
        ws = null;
      }
    };
  }
);

// ---------------------------------------------------------------------------
// Visibility listener
// ---------------------------------------------------------------------------

const visibilityListener = fromCallback<{ type: "VISIBILITY_VISIBLE" }>(
  ({ sendBack }) => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        sendBack({ type: "VISIBILITY_VISIBLE" });
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }
);

// ---------------------------------------------------------------------------
// Keepalive ticker
// ---------------------------------------------------------------------------

const keepaliveTicker = fromCallback<{ type: "KEEPALIVE_TICK" }>(
  ({ sendBack }) => {
    const id = setInterval(() => {
      sendBack({ type: "KEEPALIVE_TICK" });
    }, KEEPALIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }
);

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

export const fluxWebSocketMachine = setup({
  types: {
    context: {} as FluxWsContext,
    events: {} as FluxWsMachineEvent,
    input: {} as FluxWsInput,
  },
  actors: {
    fluxBridge,
    visibilityListener,
    keepaliveTicker,
  },
  guards: {
    canRetry: ({ context }) =>
      context.reconnect.enabled && context.retryCount < context.reconnect.maxRetries,
  },
  delays: {
    retryDelay: ({ context }) => {
      const { baseMs, maxMs } = context.reconnect;
      return Math.min(baseMs * Math.pow(2, context.retryCount), maxMs);
    },
  },
}).createMachine({
  id: "fluxWebSocket",
  context: ({ input }) => ({
    buildUrl: input.buildUrl,
    reconnect: { ...DEFAULT_RECONNECT, ...input.reconnect },
    ws: null,
    retryCount: 0,
    lastSendTime: 0,
  }),

  invoke: [
    { id: "fluxBridge", src: "fluxBridge", input: ({ context }) => ({ buildUrl: context.buildUrl }) },
    { id: "visibilityListener", src: "visibilityListener" },
  ],

  initial: "disconnected",

  states: {
    disconnected: {
      entry: ({ self }) => {
        const parent = (self as AnyActorRef)._parent;
        if (parent) parent.send({ type: "FLUX_STATUS_CHANGED", status: "disconnected" });
      },
      on: {
        CONNECT: { target: "connecting" },
      },
    },

    connecting: {
      entry: [
        assign({ retryCount: 0 }),
        ({ self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "FLUX_STATUS_CHANGED", status: "connecting" });
          const bridge = (self as AnyActorRef).system?.get("fluxBridge");
          if (bridge) bridge.send({ type: "CONNECT" });
        },
      ],
      on: {
        WS_OPEN: { target: "connected" },
        WS_CLOSE: [
          { guard: "canRetry", target: "reconnecting" },
          { target: "error" },
        ],
        WS_ERROR: { target: "error" },
        DISCONNECT: { target: "disconnecting" },
      },
    },

    connected: {
      entry: [
        assign({ retryCount: 0, lastSendTime: () => Date.now() }),
        ({ self }) => {
          const parent = (self as AnyActorRef)._parent;
          if (parent) parent.send({ type: "FLUX_STATUS_CHANGED", status: "connected" });
        },
      ],

      invoke: {
        id: "keepalive",
        src: "keepaliveTicker",
      },

      on: {
        FLUX_EVENT: {
          actions: ({ event, self }) => {
            const parent = (self as AnyActorRef)._parent;
            if (parent) {
              parent.send({
                type: "FLUX_EVENT",
                eventType: event.eventType,
                payload: event.payload,
              });
            }
          },
        },
        SEND_AUDIO: {
          actions: [
            assign({ lastSendTime: () => Date.now() }),
            ({ event, self }) => {
              const bridge = (self as AnyActorRef).system?.get("fluxBridge");
              if (bridge) bridge.send({ type: "SEND_AUDIO", chunk: event.chunk });
            },
          ],
        },
        KEEPALIVE_TICK: {
          actions: ({ context, self }) => {
            if (Date.now() - context.lastSendTime > KEEPALIVE_IDLE_MS) {
              const bridge = (self as AnyActorRef).system?.get("fluxBridge");
              if (bridge) bridge.send({ type: "SEND_AUDIO", chunk: SILENCE_FRAME });
            }
          },
        },
        WS_CLOSE: [
          {
            guard: ({ event }) => event.code !== 1000 && !event.wasClean,
            target: "reconnecting",
          },
          { target: "disconnected" },
        ],
        DISCONNECT: { target: "disconnecting" },
      },
    },

    reconnecting: {
      entry: ({ self }) => {
        const parent = (self as AnyActorRef)._parent;
        if (parent) parent.send({ type: "FLUX_STATUS_CHANGED", status: "connecting" });
      },
      after: {
        retryDelay: {
          actions: [
            assign({ retryCount: ({ context }) => context.retryCount + 1 }),
            ({ self }) => {
              const bridge = (self as AnyActorRef).system?.get("fluxBridge");
              if (bridge) bridge.send({ type: "CONNECT" });
            },
          ],
          target: "awaitingReconnect",
        },
      },
      on: {
        DISCONNECT: { target: "disconnecting" },
      },
    },

    awaitingReconnect: {
      on: {
        WS_OPEN: { target: "connected" },
        WS_CLOSE: [
          { guard: "canRetry", target: "reconnecting" },
          { target: "error" },
        ],
        WS_ERROR: [
          { guard: "canRetry", target: "reconnecting" },
          { target: "error" },
        ],
        DISCONNECT: { target: "disconnecting" },
      },
    },

    disconnecting: {
      entry: [
        ({ self }) => {
          const bridge = (self as AnyActorRef).system?.get("fluxBridge");
          if (bridge) bridge.send({ type: "DISCONNECT" });
        },
        assign({ retryCount: 0 }),
      ],
      always: { target: "disconnected" },
    },

    error: {
      entry: ({ self }) => {
        const parent = (self as AnyActorRef)._parent;
        if (parent) parent.send({ type: "FLUX_STATUS_CHANGED", status: "error" });
      },
      on: {
        CONNECT: { target: "connecting" },
        DISCONNECT: { target: "disconnecting" },
        VISIBILITY_VISIBLE: { target: "connecting" },
      },
    },
  },
});
