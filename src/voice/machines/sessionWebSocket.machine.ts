/**
 * SessionWebSocketActor – manages the session WS lifecycle for the main voice
 * pipeline (LLM streaming, TTS audio, tool calls).
 *
 * Handles: connect, reconnect with exponential backoff, heartbeat/ping-pong,
 * tab visibility recovery, and message routing (JSON + binary).
 */
import { setup, assign, fromCallback, sendParent, type AnyActorRef } from "xstate";
import type {
  HeartbeatConfig,
  ReconnectConfig,
  ServerMessage,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RECONNECT: ReconnectConfig = {
  enabled: true,
  maxRetries: 5,
  baseMs: 1_000,
  maxMs: 15_000,
};

const DEFAULT_HEARTBEAT: HeartbeatConfig = {
  intervalMs: 15_000,
  timeoutMs: 5_000,
  pingPayload: JSON.stringify({ type: "ping" }),
  pongType: "pong",
};

// ---------------------------------------------------------------------------
// Input / context
// ---------------------------------------------------------------------------

export interface SessionWsInput {
  buildUrl: () => string;
  reconnect?: Partial<ReconnectConfig>;
  heartbeat?: Partial<HeartbeatConfig>;
}

interface SessionWsContext {
  buildUrl: () => string;
  reconnect: ReconnectConfig;
  heartbeat: HeartbeatConfig;
  ws: WebSocket | null;
  retryCount: number;
  lastPongAt: number;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type SessionWsMachineEvent =
  | { type: "CONNECT" }
  | { type: "DISCONNECT" }
  | { type: "SEND"; data: string }
  | { type: "WS_OPEN" }
  | { type: "WS_CLOSE"; code: number; reason: string; wasClean: boolean }
  | { type: "WS_ERROR" }
  | { type: "WS_MESSAGE_JSON"; msg: ServerMessage }
  | { type: "WS_MESSAGE_BINARY"; data: ArrayBuffer }
  | { type: "PONG_RECEIVED" }
  | { type: "HEARTBEAT_TIMEOUT" }
  | { type: "VISIBILITY_VISIBLE" };

// ---------------------------------------------------------------------------
// Callback actor: bridges a WebSocket instance to XState events
// ---------------------------------------------------------------------------

type WsBridgeInput = { buildUrl: () => string };

const wsBridge = fromCallback<SessionWsMachineEvent, WsBridgeInput>(
  ({ sendBack, receive, input }) => {
    let ws: WebSocket | null = null;

    function open() {
      if (ws) {
        try { ws.close(); } catch { /* noop */ }
      }
      const url = input.buildUrl();
      ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => sendBack({ type: "WS_OPEN" });

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          try {
            const parsed = JSON.parse(event.data) as ServerMessage;
            if (parsed.type === "pong") {
              sendBack({ type: "PONG_RECEIVED" });
              return;
            }
            sendBack({ type: "WS_MESSAGE_JSON", msg: parsed });
          } catch {
            /* ignore unparseable */
          }
        } else {
          const ab =
            event.data instanceof ArrayBuffer
              ? event.data
              : (event.data as Blob).arrayBuffer
                ? undefined
                : undefined;
          if (ab) {
            sendBack({ type: "WS_MESSAGE_BINARY", data: ab });
          } else if (event.data instanceof Blob) {
            (event.data as Blob).arrayBuffer().then((buf) => {
              sendBack({ type: "WS_MESSAGE_BINARY", data: buf });
            });
          }
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
      if (event.type === "SEND" && ws?.readyState === WebSocket.OPEN) {
        try { ws.send(event.data); } catch { /* noop */ }
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
// Visibility listener callback actor
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
// Machine
// ---------------------------------------------------------------------------

export const sessionWebSocketMachine = setup({
  types: {
    context: {} as SessionWsContext,
    events: {} as SessionWsMachineEvent,
    input: {} as SessionWsInput,
  },
  actors: {
    wsBridge,
    visibilityListener,
  },
  actions: {
    forwardJsonToParent: sendParent(
      (_: unknown, event: { msg: ServerMessage }) => ({
        type: "SESSION_MESSAGE" as const,
        msg: event.msg,
      })
    ),
    forwardBinaryToParent: sendParent(
      (_: unknown, event: { data: ArrayBuffer }) => ({
        type: "SESSION_BINARY" as const,
        data: event.data,
      })
    ),
    notifyConnected: sendParent({ type: "SESSION_STATUS_CHANGED" as const, status: "connected" as const }),
    notifyDisconnected: sendParent({ type: "SESSION_STATUS_CHANGED" as const, status: "disconnected" as const }),
    notifyConnecting: sendParent({ type: "SESSION_STATUS_CHANGED" as const, status: "connecting" as const }),
    notifyError: sendParent(
      (_: unknown, event: { type: string; code?: number; reason?: string }) => ({
        type: "SESSION_STATUS_CHANGED" as const,
        status: "error" as const,
        error: "reason" in event && event.reason ? String(event.reason) : "Connection error",
      })
    ),
  },
  guards: {
    canRetry: ({ context }) =>
      context.reconnect.enabled && context.retryCount < context.reconnect.maxRetries,
    isAbnormalClose: (_, event: { code: number; wasClean: boolean }) =>
      event.code !== 1000 && !event.wasClean,
    shouldReconnectOnVisibility: ({ context }) =>
      context.ws === null || context.ws.readyState === WebSocket.CLOSED || context.ws.readyState === WebSocket.CLOSING,
  },
  delays: {
    retryDelay: ({ context }) => {
      const { baseMs, maxMs } = context.reconnect;
      return Math.min(baseMs * Math.pow(2, context.retryCount), maxMs);
    },
    heartbeatInterval: ({ context }) => context.heartbeat.intervalMs,
    heartbeatTimeout: ({ context }) => context.heartbeat.timeoutMs,
  },
}).createMachine({
  id: "sessionWebSocket",
  context: ({ input }) => ({
    buildUrl: input.buildUrl,
    reconnect: { ...DEFAULT_RECONNECT, ...input.reconnect },
    heartbeat: { ...DEFAULT_HEARTBEAT, ...input.heartbeat },
    ws: null,
    retryCount: 0,
    lastPongAt: 0,
  }),

  invoke: [
    { id: "wsBridge", src: "wsBridge", input: ({ context }) => ({ buildUrl: context.buildUrl }) },
    { id: "visibilityListener", src: "visibilityListener" },
  ],

  initial: "disconnected",

  states: {
    disconnected: {
      entry: "notifyDisconnected",
      on: {
        CONNECT: { target: "connecting" },
      },
    },

    connecting: {
      entry: [
        "notifyConnecting",
        assign({ retryCount: 0 }),
        ({ context: _ctx, self }) => {
          const bridge = (self as AnyActorRef).system?.get("wsBridge");
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
        assign({ retryCount: 0, lastPongAt: () => Date.now() }),
        "notifyConnected",
      ],

      initial: "idle",
      states: {
        idle: {
          after: {
            heartbeatInterval: { target: "heartbeatPending" },
          },
        },
        heartbeatPending: {
          entry: ({ context: _ctx, self }) => {
            const bridge = (self as AnyActorRef).system?.get("wsBridge");
            if (bridge) bridge.send({ type: "SEND", data: _ctx.heartbeat.pingPayload });
          },
          after: {
            heartbeatTimeout: [
              {
                target: "#sessionWebSocket.reconnecting",
                guard: "canRetry",
              },
              { target: "#sessionWebSocket.error" },
            ],
          },
          on: {
            PONG_RECEIVED: {
              target: "idle",
              actions: assign({ lastPongAt: () => Date.now() }),
            },
          },
        },
      },

      on: {
        WS_MESSAGE_JSON: {
          actions: [
            ({ event, self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) parent.send({ type: "SESSION_MESSAGE", msg: event.msg });
            },
          ],
        },
        WS_MESSAGE_BINARY: {
          actions: [
            ({ event, self }) => {
              const parent = (self as AnyActorRef)._parent;
              if (parent) parent.send({ type: "SESSION_BINARY", data: event.data });
            },
          ],
        },
        SEND: {
          actions: ({ event, self }) => {
            const bridge = (self as AnyActorRef).system?.get("wsBridge");
            if (bridge) bridge.send({ type: "SEND", data: event.data });
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
        PONG_RECEIVED: {
          actions: assign({ lastPongAt: () => Date.now() }),
        },
      },
    },

    reconnecting: {
      entry: "notifyConnecting",
      after: {
        retryDelay: {
          actions: [
            assign({ retryCount: ({ context }) => context.retryCount + 1 }),
            ({ context: _ctx, self }) => {
              const bridge = (self as AnyActorRef).system?.get("wsBridge");
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
          const bridge = (self as AnyActorRef).system?.get("wsBridge");
          if (bridge) bridge.send({ type: "DISCONNECT" });
        },
        assign({ retryCount: 0 }),
      ],
      always: { target: "disconnected" },
    },

    error: {
      entry: ({ self }) => {
        const parent = (self as AnyActorRef)._parent;
        if (parent)
          parent.send({
            type: "SESSION_STATUS_CHANGED",
            status: "error",
          });
      },
      on: {
        CONNECT: { target: "connecting" },
        DISCONNECT: { target: "disconnecting" },
        VISIBILITY_VISIBLE: { target: "connecting" },
      },
    },
  },

});
