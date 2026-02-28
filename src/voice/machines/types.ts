/**
 * Shared types for the main voice pipeline XState actors.
 *
 * These types are ONLY for the board-editor voice mode (LLM + Flux STT + TTS).
 * Voice Shots is a completely separate system with its own types.
 */

import type { FluxEventPayload, FluxEventType } from "../flux-events";

// ---------------------------------------------------------------------------
// WebSocket actor shared types
// ---------------------------------------------------------------------------

export type WsStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ReconnectConfig {
  enabled: boolean;
  maxRetries: number;
  baseMs: number;
  maxMs: number;
}

export interface HeartbeatConfig {
  intervalMs: number;
  timeoutMs: number;
  pingPayload: string;
  pongType: string;
}

// ---------------------------------------------------------------------------
// Session WebSocket events
// ---------------------------------------------------------------------------

export type SessionWsEvent =
  | { type: "CONNECT" }
  | { type: "DISCONNECT" }
  | { type: "SEND"; data: string }
  | { type: "SEND_BINARY"; data: ArrayBuffer }
  | { type: "WS_OPEN" }
  | { type: "WS_CLOSE"; code: number; reason: string; wasClean: boolean }
  | { type: "WS_ERROR" }
  | { type: "WS_MESSAGE_JSON"; msg: ServerMessage }
  | { type: "WS_MESSAGE_BINARY"; data: ArrayBuffer }
  | { type: "PONG_RECEIVED" }
  | { type: "HEARTBEAT_TIMEOUT" }
  | { type: "VISIBILITY_VISIBLE" };

// ---------------------------------------------------------------------------
// Flux WebSocket events
// ---------------------------------------------------------------------------

export type FluxWsEvent =
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
// Server messages (parsed from session WS)
// ---------------------------------------------------------------------------

export type ServerMessage =
  | { type: "state"; value: "connected" | "streaming" | "closed" }
  | { type: "error"; reason: string }
  | { type: "status"; value: "thinking" | "synthesizing" | "interrupted" }
  | { type: "llm_partial"; text: string; turnId?: string }
  | { type: "llm_complete"; text: string; turnId?: string }
  | { type: "llm_error"; reason: string; turnId?: string }
  | { type: "tool_request"; toolCallId: string; name: string; args?: unknown }
  | { type: "tts_error"; text: string; turnId?: string }
  | { type: "audio_end"; turnId?: string }
  | { type: "pong" };

// ---------------------------------------------------------------------------
// Audio playback events
// ---------------------------------------------------------------------------

export type AudioPlaybackEvent =
  | { type: "ENQUEUE_AUDIO"; buffer: ArrayBuffer }
  | { type: "AUDIO_DECODED"; audioBuffer: AudioBuffer }
  | { type: "AUDIO_ENDED" }
  | { type: "STOP_PLAYBACK" }
  | { type: "SET_VOLUME"; value: number }
  | { type: "SPEAKING_TIMEOUT" }
  | { type: "INIT_CONTEXT" }
  | { type: "DECODE_ERROR"; error: string };

// ---------------------------------------------------------------------------
// Audio capture events
// ---------------------------------------------------------------------------

export type AudioCaptureEvent =
  | { type: "START" }
  | { type: "STOP" }
  | { type: "CAPTURE_READY" }
  | { type: "CAPTURE_ERROR"; error: string }
  | { type: "CAPTURE_STOPPED" };

// ---------------------------------------------------------------------------
// Turn manager events
// ---------------------------------------------------------------------------

export type TurnManagerEvent =
  | { type: "FLUX_START_OF_TURN" }
  | { type: "FLUX_EAGER_END_OF_TURN"; confidence?: number }
  | { type: "FLUX_TURN_RESUMED" }
  | { type: "FLUX_END_OF_TURN"; transcript: string; confidence?: number }
  | { type: "SERVER_LLM_PARTIAL"; text: string }
  | { type: "SERVER_LLM_COMPLETE"; text: string }
  | { type: "SERVER_LLM_ERROR"; reason: string }
  | { type: "SERVER_INTERRUPTED" }
  | { type: "SERVER_TOOL_REQUEST"; toolCallId: string; name: string; args?: unknown }
  | { type: "TOOL_COMPLETED"; toolCallId: string; result: unknown }
  | { type: "TOOL_TIMED_OUT"; toolCallId: string }
  | { type: "DEBOUNCE_EXPIRED" }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Tool runner events
// ---------------------------------------------------------------------------

export type ToolRunnerEvent =
  | { type: "TOOL_RESULT"; result: unknown }
  | { type: "TOOL_ERROR"; error: string }
  | { type: "TIMEOUT" };

export interface ToolRunnerInput {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  runTool: (name: string, args?: unknown) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Voice orchestrator events (top-level)
// ---------------------------------------------------------------------------

export type VoiceOrchestratorEvent =
  | { type: "VOICE_START" }
  | { type: "VOICE_STOP" }
  | { type: "SESSION_STATUS_CHANGED"; status: WsStatus }
  | { type: "FLUX_STATUS_CHANGED"; status: WsStatus }
  | { type: "CAPTURE_STATUS_CHANGED"; ready: boolean; error?: string }
  | { type: "PLAYBACK_STATE_CHANGED"; isPlaying: boolean }
  | { type: "SERVER_STATUS_CHANGED"; value: "thinking" | "synthesizing" | "interrupted" | null }
  | { type: "TOOL_STATE_CHANGED"; running: boolean; name: string | null }
  | { type: "LLM_TEXT_CHANGED"; text: string; complete: boolean }
  | { type: "ERROR"; error: string; source: string };

export interface VoiceOrchestratorInput {
  sessionId: string;
  systemPrompt: string;
  serverBaseUrl: string;
  runTool?: (name: string, args?: unknown) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// OrbState (identical to existing type for backward compat)
// ---------------------------------------------------------------------------

export type OrbState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "readingBoard"
  | "speaking"
  | "toolRunning"
  | "interrupted"
  | "error";
