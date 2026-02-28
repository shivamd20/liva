/**
 * Flux STT transcription hook. Uses useReliableWebSocket for the Flux WS lifecycle
 * with auto-reconnect. Audio pipeline (mic → worklet → WS) is set up once and
 * persists across WS reconnections.
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { useReliableWebSocket } from "./useReliableWebSocket";
import {
  parseFluxEvent,
  isFluxEventPayload,
  type FluxEventPayload,
  type FluxEventType,
} from "./flux-events";

const FLUX_SAMPLE_RATE = 16000;
const BACKPRESSURE_BYTES = 128 * 1024;
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

  const sessionIdRef = useRef(
    sessionId ?? (typeof window !== "undefined" ? `flux-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : "flux-session")
  );
  if (sessionId) sessionIdRef.current = sessionId;

  const baseUrlRef = useRef(baseUrl);
  baseUrlRef.current = baseUrl;

  const [lastEvent, setLastEvent] = useState<FluxEvent | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [fluxState, setFluxState] = useState<{ event?: string; turnIndex?: number; endOfTurnConf?: number }>({});

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const lastSendTimeRef = useRef(0);
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPipelineReadyRef = useRef(false);

  const onFluxEventRef = useRef<(event: FluxEvent) => void>(() => {});
  const setOnFluxEvent = useCallback((fn: (event: FluxEvent) => void) => {
    onFluxEventRef.current = fn;
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
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
  }, []);

  const handleConnected = useCallback(() => {
    lastSendTimeRef.current = Date.now();
    if (keepAliveIntervalRef.current != null) clearInterval(keepAliveIntervalRef.current);
    keepAliveIntervalRef.current = setInterval(() => {
      if (Date.now() - lastSendTimeRef.current > FLUX_KEEPALIVE_IDLE_MS) {
        reliableWs.send(SILENCE_FRAME);
        lastSendTimeRef.current = Date.now();
      }
    }, FLUX_KEEPALIVE_INTERVAL_MS);
  }, []);

  const handleDisconnected = useCallback(() => {
    if (keepAliveIntervalRef.current != null) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
  }, []);

  const reliableWs = useReliableWebSocket({
    buildUrl: () => buildFluxWsUrl(baseUrlRef.current, sessionIdRef.current),
    onMessage: handleMessage,
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    reconnect: { enabled: true, maxRetries: 5, baseMs: 1000, maxMs: 30000 },
    handleVisibility: true,
  });

  const cleanupAudioPipeline = useCallback(() => {
    audioPipelineReadyRef.current = false;
    if (keepAliveIntervalRef.current != null) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try { audioContextRef.current.close(); } catch {}
    }
    audioContextRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    if (audioPipelineReadyRef.current) return;

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

      workletNode.port.onmessage = (event: MessageEvent) => {
        const { chunk } = event.data as { chunk: ArrayBuffer };
        if (!chunk) return;
        const ws = reliableWs.wsRef.current;
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

      audioPipelineReadyRef.current = true;
      reliableWs.connect();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Vani2Transcription] Connect failed", err instanceof Error ? err.stack : err);
      cleanupAudioPipeline();
      throw new Error(message);
    }
  }, [reliableWs, cleanupAudioPipeline]);

  const disconnect = useCallback(() => {
    reliableWs.disconnect();
    cleanupAudioPipeline();
    setLiveTranscript("");
    setLastEvent(null);
    setFluxState({});
  }, [reliableWs, cleanupAudioPipeline]);

  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  useEffect(() => {
    return () => disconnectRef.current();
  }, []);

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
    status: reliableWs.status as TranscriptionStatus,
    error: reliableWs.error,
    connect,
    disconnect,
    lastEvent,
    liveTranscript,
    transcriptHistory,
    fluxState,
    setOnFluxEvent,
  };
}
