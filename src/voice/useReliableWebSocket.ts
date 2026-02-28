/**
 * Shared WebSocket hook with auto-reconnect, heartbeat, and tab visibility handling.
 * Used by useVani2Session and useVani2Transcription to avoid duplicating WS lifecycle logic.
 */
import { useRef, useState, useCallback, useEffect } from "react";

export type ReliableWsStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ReliableWsReconnectConfig {
  enabled: boolean;
  maxRetries?: number;
  baseMs?: number;
  maxMs?: number;
}

export interface ReliableWsHeartbeatConfig {
  intervalMs: number;
  timeoutMs: number;
  pingPayload: string;
  pongType?: string;
}

export interface UseReliableWebSocketOptions {
  buildUrl: () => string;
  onMessage: (event: MessageEvent) => void;
  onConnected?: (ws: WebSocket) => void;
  onDisconnected?: (event: CloseEvent | null) => void;
  onPong?: (rttMs: number) => void;
  reconnect?: ReliableWsReconnectConfig;
  heartbeat?: ReliableWsHeartbeatConfig;
  handleVisibility?: boolean;
}

const DEFAULT_RECONNECT: Required<Omit<ReliableWsReconnectConfig, "enabled">> = {
  maxRetries: 5,
  baseMs: 1000,
  maxMs: 30000,
};

export function useReliableWebSocket(options: UseReliableWebSocketOptions) {
  const {
    buildUrl,
    onMessage,
    onConnected,
    onDisconnected,
    reconnect: reconnectConfig,
    heartbeat: heartbeatConfig,
    handleVisibility = false,
  } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [status, setStatus] = useState<ReliableWsStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const shouldBeConnectedRef = useRef(false);
  const connectingRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPongRef = useRef(0);
  const pingSentAtRef = useRef(0);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current != null) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current != null) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimeoutRef.current != null) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const openWebSocket = useCallback(() => {
    if (!shouldBeConnectedRef.current) return;
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    const url = optionsRef.current.buildUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      connectingRef.current = false;
      retryCountRef.current = 0;
      setStatus("connected");
      setError(null);

      const hb = optionsRef.current.heartbeat;
      if (hb) {
        clearHeartbeat();
        lastPongRef.current = Date.now();
        heartbeatIntervalRef.current = setInterval(() => {
          const w = wsRef.current;
          if (!w || w.readyState !== WebSocket.OPEN) return;
          pingSentAtRef.current = Date.now();
          try { w.send(hb.pingPayload); } catch {}
          heartbeatTimeoutRef.current = setTimeout(() => {
            if (Date.now() - lastPongRef.current > hb.intervalMs + hb.timeoutMs) {
              try { w.close(4000, "heartbeat timeout"); } catch {}
            }
          }, hb.timeoutMs);
        }, hb.intervalMs);
      }

      optionsRef.current.onConnected?.(ws);
    };

    ws.onmessage = (event: MessageEvent) => {
      const hb = optionsRef.current.heartbeat;
      if (hb && typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === (hb.pongType ?? "pong")) {
            lastPongRef.current = Date.now();
            if (pingSentAtRef.current > 0) {
              const rtt = Date.now() - pingSentAtRef.current;
              optionsRef.current.onPong?.(rtt);
            }
            if (heartbeatTimeoutRef.current) {
              clearTimeout(heartbeatTimeoutRef.current);
              heartbeatTimeoutRef.current = null;
            }
            return;
          }
        } catch {}
      }
      optionsRef.current.onMessage(event);
    };

    ws.onclose = (ev: CloseEvent) => {
      clearHeartbeat();
      if (wsRef.current === ws) wsRef.current = null;

      const recon = optionsRef.current.reconnect;
      const abnormal = ev.code !== 1000 && !ev.wasClean;
      const maxRetries = recon?.maxRetries ?? DEFAULT_RECONNECT.maxRetries;

      if (shouldBeConnectedRef.current && recon?.enabled && abnormal && retryCountRef.current < maxRetries) {
        scheduleReconnect();
      } else {
        if (shouldBeConnectedRef.current && abnormal) {
          setStatus("error");
          setError(`Connection closed (${ev.code}${ev.reason ? ": " + ev.reason : ""})`);
        } else {
          setStatus("disconnected");
        }
        connectingRef.current = false;
      }
      optionsRef.current.onDisconnected?.(ev);
    };

    ws.onerror = () => {};
  }, [clearHeartbeat]);

  const scheduleReconnect = useCallback(() => {
    const recon = optionsRef.current.reconnect;
    const maxRetries = recon?.maxRetries ?? DEFAULT_RECONNECT.maxRetries;
    const baseMs = recon?.baseMs ?? DEFAULT_RECONNECT.baseMs;
    const maxMs = recon?.maxMs ?? DEFAULT_RECONNECT.maxMs;

    const attempt = retryCountRef.current;
    if (attempt >= maxRetries) {
      shouldBeConnectedRef.current = false;
      connectingRef.current = false;
      setStatus("error");
      setError(`Connection lost after ${maxRetries} retries`);
      return;
    }
    const delayMs = Math.min(baseMs * Math.pow(2, attempt), maxMs);
    retryCountRef.current = attempt + 1;
    setStatus("connecting");
    setError(null);
    retryTimeoutRef.current = setTimeout(() => {
      retryTimeoutRef.current = null;
      if (!shouldBeConnectedRef.current) return;
      openWebSocket();
    }, delayMs);
  }, [openWebSocket]);

  const connect = useCallback(() => {
    if (shouldBeConnectedRef.current || connectingRef.current) return;
    const existing = wsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;

    connectingRef.current = true;
    shouldBeConnectedRef.current = true;
    retryCountRef.current = 0;
    setError(null);
    setStatus("connecting");
    openWebSocket();
  }, [openWebSocket]);

  const disconnect = useCallback(() => {
    shouldBeConnectedRef.current = false;
    connectingRef.current = false;
    clearHeartbeat();
    clearRetry();
    retryCountRef.current = 0;
    const ws = wsRef.current;
    if (ws) {
      try { ws.close(1000, "client disconnect"); } catch {}
      wsRef.current = null;
    }
    setStatus("disconnected");
    setError(null);
  }, [clearHeartbeat, clearRetry]);

  const send = useCallback((data: string | ArrayBuffer | ArrayBufferView): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(data);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!handleVisibility) return;
    const onVisibilityChange = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      if (!shouldBeConnectedRef.current) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        retryCountRef.current = 0;
        openWebSocket();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [handleVisibility, openWebSocket]);

  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  useEffect(() => {
    return () => disconnectRef.current();
  }, []);

  return { status, error, connect, disconnect, send, wsRef };
}
