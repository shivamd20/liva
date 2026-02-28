import { useRef, useState, useCallback, useEffect } from "react";
import {
  parseFluxEvent,
  isFluxEventPayload,
  type FluxEventPayload,
  type FluxEventType,
} from "./flux-events";

const FLUX_SAMPLE_RATE = 16000;
const BACKPRESSURE_BYTES = 128 * 1024;
const FLUX_RETRY_MAX = 5;
const FLUX_RETRY_BASE_MS = 1000;
const FLUX_RETRY_MAX_MS = 30000;
const TRANSCRIPT_HISTORY_MAX = 50;
const FLUX_KEEPALIVE_INTERVAL_MS = 4000;
const FLUX_KEEPALIVE_IDLE_MS = 3500;
const KEEPALIVE_SILENCE_SAMPLES = 320;
const SILENCE_FRAME = new Int16Array(KEEPALIVE_SILENCE_SAMPLES).fill(0).buffer;

export type TranscriptionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface FluxEvent {
  type: FluxEventType;
  payload: FluxEventPayload;
}

function buildFluxWsUrl(baseUrl: string, sessionId: string): string {
  const base = baseUrl.replace(/^http/, "ws");
  const path = base.endsWith("/") ? "" : "/";
  return `${base}${path}v2/flux/${sessionId}`;
}

export function useVani2Transcription(serverBaseUrl?: string, sessionId?: string) {
  const baseUrl = serverBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
  const sessionIdVal = sessionId ?? (typeof window !== "undefined" ? `flux-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : "flux-session");
  const [status, setStatus] = useState<TranscriptionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<FluxEvent | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [fluxState, setFluxState] = useState<{ event?: string; turnIndex?: number; endOfTurnConf?: number }>({});

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const shouldBeConnectedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSendTimeRef = useRef(0);
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onFluxEventRef = useRef<(event: FluxEvent) => void>(() => {});
  const setOnFluxEvent = useCallback((fn: (event: FluxEvent) => void) => {
    onFluxEventRef.current = fn;
  }, []);

  const disconnect = useCallback(() => {
    shouldBeConnectedRef.current = false;
    if (keepAliveIntervalRef.current != null) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    if (retryTimeoutRef.current != null) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryCountRef.current = 0;
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setStatus("disconnected");
    setLiveTranscript("");
    setTranscriptHistory([]);
    setLastEvent(null);
    setFluxState({});
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    shouldBeConnectedRef.current = true;
    retryCountRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: FLUX_SAMPLE_RATE });
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      const workletUrl = new URL("./flux-capture-worklet.js", import.meta.url).href;
      await ctx.audioWorklet.addModule(workletUrl);
      const workletNode = new AudioWorkletNode(ctx, "flux-capture-processor");
      workletNodeRef.current = workletNode;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const url = buildFluxWsUrl(baseUrl, sessionIdVal);

      const scheduleReconnect = () => {
        const attempt = retryCountRef.current;
        if (attempt >= FLUX_RETRY_MAX) {
          shouldBeConnectedRef.current = false;
          setStatus("error");
          setError(`Flux closed after ${FLUX_RETRY_MAX} retries.`);
          return;
        }
        const delay = Math.min(FLUX_RETRY_BASE_MS * Math.pow(2, attempt), FLUX_RETRY_MAX_MS);
        retryCountRef.current = attempt + 1;
        setStatus("connecting");
        setError(null);
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          if (!shouldBeConnectedRef.current) return;
          openWebSocket();
        }, delay);
      };

      const openWebSocket = () => {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          lastSendTimeRef.current = Date.now();
          if (keepAliveIntervalRef.current != null) clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = setInterval(() => {
            const w = wsRef.current;
            if (!w || w.readyState !== WebSocket.OPEN) return;
            if (Date.now() - lastSendTimeRef.current > FLUX_KEEPALIVE_IDLE_MS) {
              try {
                w.send(SILENCE_FRAME);
                lastSendTimeRef.current = Date.now();
              } catch {}
            }
          }, FLUX_KEEPALIVE_INTERVAL_MS);
          setStatus("connected");
          setError(null);
        };

        ws.onmessage = (event: MessageEvent) => {
          if (typeof event.data !== "string") return;
          const payload = parseFluxEvent(event.data);
          if (!payload) return;
          if (isFluxEventPayload(payload) && payload.event) {
            const fluxEvent: FluxEvent = { type: payload.event, payload };
            setLastEvent(fluxEvent);
            setFluxState({
              event: payload.event,
              turnIndex: payload.turn_index,
              endOfTurnConf: payload.end_of_turn_confidence,
            });
            if (payload.transcript !== undefined) setLiveTranscript(payload.transcript);
            if (payload.event === "EndOfTurn" && payload.transcript?.trim()) {
              setTranscriptHistory((prev) =>
                [payload.transcript!.trim(), ...prev].slice(0, TRANSCRIPT_HISTORY_MAX)
              );
            }
            onFluxEventRef.current(fluxEvent);
          }
        };

        ws.onclose = (ev: CloseEvent) => {
          if (keepAliveIntervalRef.current != null) {
            clearInterval(keepAliveIntervalRef.current);
            keepAliveIntervalRef.current = null;
          }
          wsRef.current = null;
          const abnormal = ev.code !== 1000 && !ev.wasClean;
          if (shouldBeConnectedRef.current && abnormal && retryCountRef.current < FLUX_RETRY_MAX) {
            scheduleReconnect();
          } else {
            setStatus("disconnected");
            if (abnormal) {
              const msg = `Flux closed (${ev.code}${ev.reason ? ": " + ev.reason : ""})`;
              setError(msg);
              console.warn("[Vani2Transcription]", msg);
            }
          }
        };

        ws.onerror = () => {
          setStatus("error");
          setError("Flux WebSocket error");
        };
      };

      openWebSocket();

      workletNode.port.onmessage = (event: MessageEvent) => {
        const { chunk } = event.data as { chunk: ArrayBuffer };
        if (!chunk) return;
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        if (ws.bufferedAmount > BACKPRESSURE_BYTES) return;
        try {
          ws.send(chunk);
          lastSendTimeRef.current = Date.now();
        } catch {}
      };

      source.connect(workletNode);
      const silence = ctx.createGain();
      silence.gain.value = 0;
      workletNode.connect(silence);
      silence.connect(ctx.destination);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("error");
      shouldBeConnectedRef.current = false;
      console.error("[Vani2Transcription] Connect failed", err instanceof Error ? err.stack : err);
    }
  }, [baseUrl, sessionIdVal]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      const ctx = audioContextRef.current;
      if (ctx?.state === "suspended") ctx.resume();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return {
    status,
    error,
    connect,
    disconnect,
    lastEvent,
    liveTranscript,
    transcriptHistory,
    fluxState,
    setOnFluxEvent,
  };
}
