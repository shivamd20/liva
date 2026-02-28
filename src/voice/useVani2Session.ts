/**
 * Voice session WebSocket: transcript_final, LLM stream, TTS audio playback, interrupt, tool_request/tool_result.
 */
import { useRef, useState, useCallback, useEffect } from "react";

function buildSessionWsUrl(baseUrl: string, sessionId: string): string {
  const base = baseUrl.replace(/^http/, "ws");
  const path = base.endsWith("/") ? "" : "/";
  return `${base}${path}v2/ws/${sessionId}`;
}

export type SessionStatus = "disconnected" | "connecting" | "connected" | "error";

export type ServerStatus = "thinking" | "synthesizing" | null;

export interface ToolCallEntry {
  id: string;
  name: string;
  args?: unknown;
  result?: unknown;
  /** Data URL of board snapshot when tool is read_board and result contains image */
  imageDataUrl?: string;
}

export interface UseVani2SessionOptions {
  serverBaseUrl?: string;
  sessionId?: string;
  systemPrompt?: string;
  /** When server sends tool_request, run the tool (e.g. read_board) and return result. */
  runTool?: (name: string, args?: unknown) => Promise<unknown>;
}

export function useVani2Session(options: UseVani2SessionOptions = {}) {
  const {
    serverBaseUrl,
    sessionId,
    systemPrompt,
    runTool,
  } = options;
  const baseUrl = serverBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
  const sessionIdVal = sessionId ?? (typeof window !== "undefined" ? `v2-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : "v2-session");
  const [status, setStatus] = useState<SessionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>(null);
  const [llmText, setLlmText] = useState("");
  const [llmCompleteText, setLlmCompleteText] = useState<string | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [assistantHistory, setAssistantHistory] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [toolRunning, setToolRunning] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [toolCallHistory, setToolCallHistory] = useState<ToolCallEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const runToolRef = useRef(runTool);
  runToolRef.current = runTool;

  const drainPlayback = useCallback(() => {
    const ctx = audioContextRef.current;
    const queue = playbackQueueRef.current;
    if (!ctx || isPlayingRef.current || queue.length === 0) return;
    const buffer = queue.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    currentSourceRef.current = source;
    isPlayingRef.current = true;
    setIsPlaying(true);
    source.onended = () => {
      isPlayingRef.current = false;
      currentSourceRef.current = null;
      setIsPlaying(false);
      drainPlayback();
    };
    source.start(0);
  }, []);

  const stopPlayback = useCallback(() => {
    const src = currentSourceRef.current;
    if (src) {
      try {
        src.stop();
      } catch {}
      currentSourceRef.current = null;
    }
    isPlayingRef.current = false;
    playbackQueueRef.current = [];
    setIsPlaying(false);
  }, []);

  const connect = useCallback(() => {
    setError(null);
    setLlmError(null);
    setServerStatus(null);
    setStatus("connecting");
    const url = buildSessionWsUrl(baseUrl, sessionIdVal);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      setStatus("connected");
      setError(null);
      if (typeof systemPrompt === "string" && systemPrompt.trim().length > 0) {
        try {
          ws.send(JSON.stringify({ type: "session.init", systemPrompt: systemPrompt.trim() }));
        } catch (e) {
          console.error("[Vani2Session] session.init failed", e instanceof Error ? e.stack : e);
          setError("Failed to send system prompt");
        }
      }
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        audioContextRef.current.resume?.();
      }
    };
    ws.onmessage = async (event: MessageEvent) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data) as { type: string; text?: string; reason?: string; value?: string; toolCallId?: string; name?: string; args?: unknown };
          if (msg.type === "error" && typeof msg.reason === "string") {
            setError(msg.reason);
            return;
          }
          if (msg.type === "status" && (msg.value === "thinking" || msg.value === "synthesizing")) {
            setServerStatus(msg.value);
            return;
          }
          if (msg.type === "tool_request" && typeof msg.toolCallId === "string" && typeof msg.name === "string") {
            setToolRunning(true);
            setActiveToolName(msg.name);
            const runner = runToolRef.current;
            try {
              const result = runner ? await runner(msg.name, msg.args) : { error: "No tool runner" };
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "tool_result", toolCallId: msg.toolCallId, result }));
              }
              const resultObj = result && typeof result === "object" ? result as Record<string, unknown> : null;
              const imageDataUrl = resultObj && typeof resultObj.image === "string" ? resultObj.image as string : undefined;
              setToolCallHistory((prev) =>
                [...prev, { id: msg.toolCallId!, name: msg.name, args: msg.args, result, imageDataUrl }].slice(-50)
              );
            } catch (e) {
              console.error("[Vani2Session] runTool failed", e);
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "tool_result", toolCallId: msg.toolCallId, result: { error: e instanceof Error ? e.message : String(e) } }));
              }
              setToolCallHistory((prev) =>
                [...prev, { id: msg.toolCallId!, name: msg.name, args: msg.args, result: { error: e instanceof Error ? e.message : String(e) } }].slice(-50)
              );
            } finally {
              setToolRunning(false);
              setActiveToolName(null);
            }
            return;
          }
          if (msg.type === "llm_partial" && typeof msg.text === "string") {
            setServerStatus(null);
            setLlmText((prev) => prev + msg.text);
          }
          if (msg.type === "llm_complete" && typeof msg.text === "string") {
            setLlmCompleteText(msg.text);
            setAssistantHistory((prev) => [msg.text!, ...prev].slice(0, 20));
            setLlmText("");
            setServerStatus(null);
          }
          if (msg.type === "llm_error" && typeof msg.reason === "string") {
            setLlmError(msg.reason);
            setLlmText("");
            setServerStatus(null);
          }
        } catch (parseErr) {
          console.error("[Vani2Session] Failed to parse server message", parseErr);
          setError("Invalid server message");
        }
        return;
      }
      const data = event.data as ArrayBuffer | Blob;
      const getArrayBuffer = (): Promise<ArrayBuffer> =>
        data instanceof ArrayBuffer ? Promise.resolve(data) : (data as Blob).arrayBuffer();
      getArrayBuffer().then((ab) => {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        ctx.decodeAudioData(ab).then(
          (buffer) => {
            playbackQueueRef.current.push(buffer);
            drainPlayback();
          },
          (decodeErr) => {
            console.error("[Vani2Session] Audio decode failed", decodeErr);
            setError("Audio playback failed (decode error)");
          }
        );
      }).catch((e) => {
        console.error("[Vani2Session] Failed to read audio data", e);
        setError("Audio playback failed");
      });
    };
    ws.onclose = (ev: CloseEvent) => {
      setStatus("disconnected");
      wsRef.current = null;
      stopPlayback();
      setToolRunning(false);
      if (ev.code !== 1000 && ev.code !== 1001 && ev.reason) {
        setError(`Session closed: ${ev.code}${ev.reason ? " — " + ev.reason : ""}`);
      }
    };
    ws.onerror = () => {
      setStatus("error");
      setError("Session WebSocket error");
    };
  }, [baseUrl, sessionIdVal, systemPrompt, drainPlayback, stopPlayback]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    stopPlayback();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setStatus("disconnected");
    setError(null);
    setServerStatus(null);
    setLlmText("");
    setLlmCompleteText(null);
    setLlmError(null);
    setToolRunning(false);
    setActiveToolName(null);
    setToolCallHistory([]);
  }, [stopPlayback]);

  const sendTranscriptFinal = useCallback((text: string, turnId?: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setLlmText("");
    setLlmCompleteText(null);
    setLlmError(null);
    try {
      ws.send(JSON.stringify({ type: "transcript_final", text, ...(turnId != null ? { turnId } : {}) }));
    } catch (e) {
      console.error("[Vani2Session] sendTranscriptFinal failed", e);
      setError("Failed to send transcript");
    }
  }, []);

  const sendInterrupt = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    stopPlayback();
    try {
      ws.send(JSON.stringify({ type: "control.interrupt" }));
    } catch (e) {
      console.error("[Vani2Session] sendInterrupt failed", e);
    }
  }, [stopPlayback]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    status,
    error,
    serverStatus,
    connect,
    disconnect,
    sendTranscriptFinal,
    sendInterrupt,
    llmText,
    llmCompleteText,
    llmError,
    assistantHistory,
    isPlaying,
    toolRunning,
    activeToolName,
    toolCallHistory,
    sessionId: sessionIdVal,
  };
}
