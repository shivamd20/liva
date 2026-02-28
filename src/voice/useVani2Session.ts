/**
 * Voice session hook: transcript_final, LLM stream, TTS audio playback, interrupt,
 * tool_request/tool_result. Built on useReliableWebSocket for auto-reconnect,
 * heartbeat, and tab visibility handling.
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { useReliableWebSocket } from "./useReliableWebSocket";

const MAX_PLAYBACK_QUEUE = 8;
const MAX_SPEAKING_DURATION_MS = 45_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 5_000;

function buildSessionWsUrl(baseUrl: string, sessionId: string): string {
  const base = baseUrl.replace(/^http/, "ws");
  const path = base.endsWith("/") ? "" : "/";
  return `${base}${path}v2/ws/${sessionId}`;
}

export type SessionStatus = "disconnected" | "connecting" | "connected" | "error";
export type ServerStatus = "thinking" | "synthesizing" | "interrupted" | null;

export interface ToolCallEntry {
  id: string;
  name: string;
  args?: unknown;
  result?: unknown;
  imageDataUrl?: string;
}

export interface UseVani2SessionOptions {
  serverBaseUrl?: string;
  sessionId?: string;
  systemPrompt?: string;
  runTool?: (name: string, args?: unknown) => Promise<unknown>;
}

export function useVani2Session(options: UseVani2SessionOptions = {}) {
  const { serverBaseUrl, sessionId, systemPrompt, runTool } = options;
  const baseUrl = serverBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");

  const sessionIdRef = useRef(
    sessionId ?? (typeof window !== "undefined" ? `v2-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : "v2-session")
  );
  if (sessionId) sessionIdRef.current = sessionId;

  const [serverStatus, setServerStatus] = useState<ServerStatus>(null);
  const [llmText, setLlmText] = useState("");
  const [llmCompleteText, setLlmCompleteText] = useState<string | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [assistantHistory, setAssistantHistory] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [toolRunning, setToolRunning] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [toolCallHistory, setToolCallHistory] = useState<ToolCallEntry[]>([]);
  const [ttsErrors, setTtsErrors] = useState<string[]>([]);
  const [connectionQuality, setConnectionQuality] = useState<"good" | "degraded" | "poor">("good");
  const [sessionRestored, setSessionRestored] = useState(false);
  const pingTimestampRef = useRef<number>(0);
  const latencyHistoryRef = useRef<number[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const runToolRef = useRef(runTool);
  runToolRef.current = runTool;
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardAudioRef = useRef(false);
  const lastCompleteTextRef = useRef<string | null>(null);

  const baseUrlRef = useRef(baseUrl);
  baseUrlRef.current = baseUrl;
  const systemPromptRef = useRef(systemPrompt);
  systemPromptRef.current = systemPrompt;

  const ensureAudioContext = useCallback(async (): Promise<AudioContext> => {
    let ctx = audioContextRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext();
      audioContextRef.current = ctx;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;
    }
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  }, []);

  const drainPlayback = useCallback(() => {
    const ctx = audioContextRef.current;
    const gain = gainNodeRef.current;
    const queue = playbackQueueRef.current;
    if (!ctx || ctx.state === "closed" || !gain || isPlayingRef.current || queue.length === 0) return;
    if (ctx.state === "suspended") {
      ctx.resume().then(() => drainPlayback());
      return;
    }
    const buffer = queue.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    currentSourceRef.current = source;
    isPlayingRef.current = true;
    setIsPlaying(true);

    if (!speakingTimerRef.current) {
      speakingTimerRef.current = setTimeout(() => {
        stopPlaybackInternal();
      }, MAX_SPEAKING_DURATION_MS);
    }

    source.onended = () => {
      isPlayingRef.current = false;
      currentSourceRef.current = null;
      if (queue.length === 0) {
        setIsPlaying(false);
        if (speakingTimerRef.current) {
          clearTimeout(speakingTimerRef.current);
          speakingTimerRef.current = null;
        }
      } else {
        drainPlayback();
      }
    };
    source.start(0);
  }, []);

  const stopPlaybackInternal = useCallback(() => {
    const src = currentSourceRef.current;
    if (src) {
      try { src.stop(); } catch {}
      currentSourceRef.current = null;
    }
    isPlayingRef.current = false;
    playbackQueueRef.current = [];
    setIsPlaying(false);
    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
  }, []);

  const setVolume = useCallback((value: number) => {
    const gain = gainNodeRef.current;
    if (gain) {
      gain.gain.setValueAtTime(Math.max(0, Math.min(1, value)), gain.context.currentTime);
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data === "string") {
      try {
        const msg = JSON.parse(event.data) as {
          type: string;
          text?: string;
          reason?: string;
          value?: string;
          toolCallId?: string;
          name?: string;
          args?: unknown;
          turnId?: string;
        };
        if (msg.type === "error" && typeof msg.reason === "string") {
          console.warn("[Vani2Session] Server error:", msg.reason);
          setLlmError(msg.reason);
          return;
        }
        if (msg.type === "state" && msg.value === "connected") {
          if (assistantHistory.length > 0 || lastCompleteTextRef.current) {
            setSessionRestored(true);
          }
          return;
        }
        if (msg.type === "status") {
          if (msg.value === "thinking") {
            discardAudioRef.current = false;
            setServerStatus("thinking");
          } else if (msg.value === "synthesizing") {
            setServerStatus("synthesizing");
          } else if (msg.value === "interrupted") {
            setServerStatus("interrupted");
            if (interruptedTimerRef.current) clearTimeout(interruptedTimerRef.current);
            interruptedTimerRef.current = setTimeout(() => {
              setServerStatus(null);
              interruptedTimerRef.current = null;
            }, 600);
          }
          return;
        }
        if (msg.type === "tool_request" && typeof msg.toolCallId === "string" && typeof msg.name === "string") {
          const toolCallId = msg.toolCallId;
          const toolName = msg.name;
          const toolArgs = msg.args;
          setToolRunning(true);
          setActiveToolName(toolName);
          const runner = runToolRef.current;
          (async () => {
            try {
              const result = runner ? await runner(toolName, toolArgs) : { error: "No tool runner" };
              reliableWs.send(JSON.stringify({ type: "tool_result", toolCallId, result }));
              const resultObj = result && typeof result === "object" ? result as Record<string, unknown> : null;
              const imageDataUrl = resultObj && typeof resultObj.image === "string" ? resultObj.image as string : undefined;
              setToolCallHistory((prev) =>
                [...prev, { id: toolCallId, name: toolName, args: toolArgs, result, imageDataUrl }].slice(-50)
              );
            } catch (e) {
              const errResult = { error: e instanceof Error ? e.message : String(e) };
              reliableWs.send(JSON.stringify({ type: "tool_result", toolCallId, result: errResult }));
              setToolCallHistory((prev) =>
                [...prev, { id: toolCallId, name: toolName, args: toolArgs, result: errResult }].slice(-50)
              );
            } finally {
              setToolRunning(false);
              setActiveToolName(null);
            }
          })();
          return;
        }
        if (msg.type === "llm_partial" && typeof msg.text === "string") {
          setServerStatus(null);
          setLlmText((prev) => prev + msg.text);
        }
        if (msg.type === "llm_complete" && typeof msg.text === "string") {
          setLlmCompleteText(msg.text);
          lastCompleteTextRef.current = msg.text;
          setAssistantHistory((prev) => [msg.text!, ...prev].slice(0, 20));
          setLlmText("");
          setServerStatus(null);
        }
        if (msg.type === "llm_error" && typeof msg.reason === "string") {
          setLlmError(msg.reason);
          setLlmText("");
          setServerStatus(null);
        }
        if (msg.type === "tts_error" && typeof msg.text === "string") {
          setTtsErrors((prev) => [...prev, msg.text!].slice(-10));
          if ("speechSynthesis" in window && msg.text) {
            try {
              const utterance = new SpeechSynthesisUtterance(msg.text);
              utterance.rate = 1.1;
              utterance.volume = 0.8;
              speechSynthesis.speak(utterance);
            } catch {}
          }
        }
        if (msg.type === "audio_end") {
          // All TTS chunks have been sent for this turn
        }
      } catch (parseErr) {
        console.error("[Vani2Session] Failed to parse server message", parseErr);
      }
      return;
    }
    // Binary TTS audio — discard stale frames after interrupt
    if (discardAudioRef.current) return;
    const data = event.data as ArrayBuffer | Blob;
    (async () => {
      try {
        if (discardAudioRef.current) return;
        const ab = data instanceof ArrayBuffer ? data : await (data as Blob).arrayBuffer();
        const ctx = await ensureAudioContext();
        const buffer = await ctx.decodeAudioData(ab);
        if (!discardAudioRef.current && playbackQueueRef.current.length < MAX_PLAYBACK_QUEUE) {
          playbackQueueRef.current.push(buffer);
        }
        if (!discardAudioRef.current) drainPlayback();
      } catch (e) {
        console.error("[Vani2Session] Audio decode/play failed", e);
      }
    })();
  }, [ensureAudioContext, drainPlayback]);

  const handleConnected = useCallback((ws: WebSocket) => {
    setLlmText("");
    setLlmCompleteText(null);
    setLlmError(null);
    setServerStatus(null);
    setToolRunning(false);
    setActiveToolName(null);
    setTtsErrors([]);
    setConnectionQuality("good");

    const prompt = systemPromptRef.current;
    if (typeof prompt === "string" && prompt.trim().length > 0) {
      try {
        ws.send(JSON.stringify({ type: "session.init", systemPrompt: prompt.trim() }));
      } catch (e) {
        console.error("[Vani2Session] session.init failed", e);
      }
    }
    ensureAudioContext();
    setSessionRestored(false);
  }, [ensureAudioContext]);

  const handleDisconnected = useCallback(() => {
    stopPlaybackInternal();
    setToolRunning(false);
    setActiveToolName(null);
  }, [stopPlaybackInternal]);

  const handlePong = useCallback((rttMs: number) => {
    latencyHistoryRef.current = [...latencyHistoryRef.current.slice(-4), rttMs];
    const avg = latencyHistoryRef.current.reduce((a, b) => a + b, 0) / latencyHistoryRef.current.length;
    if (avg > 500) setConnectionQuality("poor");
    else if (avg > 200) setConnectionQuality("degraded");
    else setConnectionQuality("good");
  }, []);

  const reliableWs = useReliableWebSocket({
    buildUrl: () => buildSessionWsUrl(baseUrlRef.current, sessionIdRef.current),
    onMessage: handleMessage,
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onPong: handlePong,
    reconnect: { enabled: true, maxRetries: 5, baseMs: 1000, maxMs: 15000 },
    heartbeat: {
      intervalMs: HEARTBEAT_INTERVAL_MS,
      timeoutMs: HEARTBEAT_TIMEOUT_MS,
      pingPayload: JSON.stringify({ type: "ping" }),
      pongType: "pong",
    },
    handleVisibility: true,
  });

  const connect = reliableWs.connect;

  const disconnect = useCallback(() => {
    reliableWs.disconnect();
    stopPlaybackInternal();
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try { audioContextRef.current.close(); } catch {}
    }
    audioContextRef.current = null;
    gainNodeRef.current = null;
    setServerStatus(null);
    setLlmText("");
    setLlmCompleteText(null);
    setLlmError(null);
    setToolRunning(false);
    setActiveToolName(null);
    setTtsErrors([]);
  }, [reliableWs.disconnect, stopPlaybackInternal]);

  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  useEffect(() => {
    return () => {
      disconnectRef.current();
      if (interruptedTimerRef.current) clearTimeout(interruptedTimerRef.current);
    };
  }, []);

  const sendTranscriptFinal = useCallback((text: string, turnId?: string) => {
    discardAudioRef.current = false;
    setLlmText("");
    setLlmCompleteText(null);
    setLlmError(null);
    setTtsErrors([]);
    reliableWs.send(JSON.stringify({ type: "transcript_final", text, ...(turnId != null ? { turnId } : {}) }));
  }, [reliableWs]);

  const sendInterrupt = useCallback(() => {
    discardAudioRef.current = true;
    stopPlaybackInternal();
    reliableWs.send(JSON.stringify({ type: "control.interrupt" }));
  }, [stopPlaybackInternal, reliableWs]);

  return {
    status: reliableWs.status as SessionStatus,
    error: reliableWs.error,
    serverStatus,
    connect,
    disconnect,
    sendTranscriptFinal,
    sendInterrupt,
    setVolume,
    llmText,
    llmCompleteText,
    llmError,
    assistantHistory,
    isPlaying,
    toolRunning,
    activeToolName,
    toolCallHistory,
    ttsErrors,
    sessionId: sessionIdRef.current,
    connectionQuality,
    sessionRestored,
    lastCompleteText: lastCompleteTextRef.current,
  };
}
