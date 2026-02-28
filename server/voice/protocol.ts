/**
 * Voice session wire protocol (extends Vani2-style protocol with tool_request / tool_result).
 */

export type ClientToServerJson =
  | { type: "session.init"; systemPrompt: string }
  | { type: "control.mute"; value: boolean }
  | { type: "control.interrupt" }
  | { type: "transcript_final"; text: string; turnId?: string }
  | { type: "tool_result"; toolCallId: string; result: unknown };

export type ServerStatusValue = "thinking" | "synthesizing";

export type ServerToClientJson =
  | { type: "state"; value: SessionState }
  | { type: "error"; reason: string }
  | { type: "status"; value: ServerStatusValue }
  | { type: "llm_partial"; text: string; turnId?: string }
  | { type: "llm_complete"; text: string; turnId?: string }
  | { type: "llm_error"; reason: string; turnId?: string }
  | { type: "tool_request"; toolCallId: string; name: string; args?: unknown };

export type SessionState = "connected" | "streaming" | "closed";

export function parseClientJson(data: string): ClientToServerJson | null {
  try {
    const obj = JSON.parse(data) as {
      type?: string;
      value?: boolean;
      text?: string;
      turnId?: string;
      systemPrompt?: string;
      toolCallId?: string;
      result?: unknown;
    };
    if (obj.type === "session.init" && typeof obj.systemPrompt === "string" && obj.systemPrompt.trim().length > 0) {
      return { type: "session.init", systemPrompt: obj.systemPrompt.trim() };
    }
    if (obj.type === "control.mute" && typeof obj.value === "boolean") {
      return { type: "control.mute", value: obj.value };
    }
    if (obj.type === "transcript_final" && typeof obj.text === "string") {
      return {
        type: "transcript_final",
        text: obj.text,
        ...(typeof obj.turnId === "string" ? { turnId: obj.turnId } : {}),
      };
    }
    if (obj.type === "control.interrupt") {
      return { type: "control.interrupt" };
    }
    if (obj.type === "tool_result" && typeof obj.toolCallId === "string") {
      return { type: "tool_result", toolCallId: obj.toolCallId, result: obj.result };
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeServerJson(msg: ServerToClientJson): string {
  return JSON.stringify(msg);
}
