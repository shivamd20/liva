/**
 * React adapter hook for the XState voice orchestrator.
 *
 * Provides the same return-type shape as the existing useVani2Session +
 * useVani2Transcription hooks combined, so consumers (BoardEditor, VoicePanel)
 * can swap imports without any other changes.
 */
import { useCallback, useMemo, useRef, useEffect } from "react";
import { useActor, useSelector } from "@xstate/react";
import { voiceOrchestratorMachine } from "./voiceOrchestrator.machine";
import type { OrbState } from "./types";
import type { ToolCallEntry } from "./turnManager.machine";

// ---------------------------------------------------------------------------
// Return types (mirrors existing hooks)
// ---------------------------------------------------------------------------

export type SessionStatus = "disconnected" | "connecting" | "connected" | "error";
export type ServerStatus = "thinking" | "synthesizing" | "interrupted" | null;
export type TranscriptionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface UseVoiceOrchestratorOptions {
  sessionId: string;
  systemPrompt?: string;
  serverBaseUrl?: string;
  runTool?: (name: string, args?: unknown) => Promise<unknown>;
}

export interface UseVoiceOrchestratorReturn {
  // Orchestrator lifecycle
  start: () => void;
  stop: () => void;
  orbState: OrbState;

  // Session (same shape as useVani2Session)
  sessionStatus: SessionStatus;
  sessionError: string | null;
  serverStatus: ServerStatus;
  llmText: string;
  llmCompleteText: string | null;
  llmError: string | null;
  assistantHistory: string[];
  isPlaying: boolean;
  toolRunning: boolean;
  activeToolName: string | null;
  toolCallHistory: ToolCallEntry[];
  ttsErrors: string[];
  sendTranscriptFinal: (text: string, turnId?: string) => void;
  sendInterrupt: () => void;
  setVolume: (value: number) => void;

  // Transcription (same shape as useVani2Transcription)
  transcriptionStatus: TranscriptionStatus;
  transcriptionError: string | null;
  liveTranscript: string;
  transcriptHistory: string[];
  fluxState: { event?: string; turnIndex?: number; endOfTurnConf?: number };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceOrchestrator(
  options: UseVoiceOrchestratorOptions
): UseVoiceOrchestratorReturn {
  const baseUrl =
    options.serverBaseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const inputRef = useRef({
    sessionId: options.sessionId,
    systemPrompt: options.systemPrompt ?? "",
    serverBaseUrl: baseUrl,
    runTool: options.runTool,
  });
  inputRef.current = {
    sessionId: options.sessionId,
    systemPrompt: options.systemPrompt ?? "",
    serverBaseUrl: baseUrl,
    runTool: options.runTool,
  };

  const [snapshot, send, actorRef] = useActor(voiceOrchestratorMachine, {
    input: inputRef.current,
  });

  // Update runTool in turnManager when it changes
  useEffect(() => {
    if (options.runTool) {
      const turnMgr = (actorRef as any).system?.get("turnMgr");
      if (turnMgr) {
        turnMgr.send({ type: "SET_RUN_TOOL", runTool: options.runTool });
      }
    }
  }, [options.runTool, actorRef]);

  const ctx = snapshot.context;

  const start = useCallback(() => send({ type: "VOICE_START" }), [send]);
  const stop = useCallback(() => send({ type: "VOICE_STOP" }), [send]);

  const sendTranscriptFinal = useCallback(
    (text: string, turnId?: string) => {
      send({
        type: "SEND_TRANSCRIPT_FINAL" as any,
        text,
        turnId: turnId ?? String(Date.now()),
      });
    },
    [send]
  );

  const sendInterrupt = useCallback(() => {
    send({ type: "SEND_INTERRUPT" as any });
  }, [send]);

  const setVolume = useCallback(
    (value: number) => {
      const playback = (actorRef as any).system?.get("playback");
      if (playback) playback.send({ type: "SET_VOLUME", value });
    },
    [actorRef]
  );

  const mapWsStatus = (s: string): SessionStatus => {
    if (s === "connected" || s === "connecting" || s === "error") return s;
    return "disconnected";
  };

  return useMemo(
    () => ({
      start,
      stop,
      orbState: ctx.orbState,

      sessionStatus: mapWsStatus(ctx.sessionWsStatus),
      sessionError: ctx.error,
      serverStatus: ctx.serverStatus as ServerStatus,
      llmText: ctx.llmText,
      llmCompleteText: ctx.llmCompleteText,
      llmError: ctx.llmError,
      assistantHistory: ctx.assistantHistory,
      isPlaying: ctx.isPlaying,
      toolRunning: ctx.toolRunning,
      activeToolName: ctx.activeToolName,
      toolCallHistory: ctx.toolCallHistory,
      ttsErrors: ctx.ttsErrors,
      sendTranscriptFinal,
      sendInterrupt,
      setVolume,

      transcriptionStatus: mapWsStatus(ctx.fluxWsStatus) as TranscriptionStatus,
      transcriptionError: null,
      liveTranscript: ctx.liveTranscript,
      transcriptHistory: ctx.transcriptHistory,
      fluxState: ctx.fluxState,
    }),
    [
      start,
      stop,
      ctx.orbState,
      ctx.sessionWsStatus,
      ctx.error,
      ctx.serverStatus,
      ctx.llmText,
      ctx.llmCompleteText,
      ctx.llmError,
      ctx.assistantHistory,
      ctx.isPlaying,
      ctx.toolRunning,
      ctx.activeToolName,
      ctx.toolCallHistory,
      ctx.ttsErrors,
      sendTranscriptFinal,
      sendInterrupt,
      setVolume,
      ctx.fluxWsStatus,
      ctx.liveTranscript,
      ctx.transcriptHistory,
      ctx.fluxState,
    ]
  );
}
