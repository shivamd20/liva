/**
 * Typed Flux (@cf/deepgram/flux) WebSocket event payloads.
 */

export type FluxEventType =
  | "Update"
  | "StartOfTurn"
  | "EagerEndOfTurn"
  | "TurnResumed"
  | "EndOfTurn";

export interface FluxWord {
  word: string;
  confidence: number;
}

export interface FluxEventPayload {
  request_id?: string;
  sequence_id?: number;
  event?: FluxEventType;
  turn_index?: number;
  audio_window_start?: number;
  audio_window_end?: number;
  transcript?: string;
  words?: FluxWord[];
  end_of_turn_confidence?: number;
}

export function parseFluxEvent(data: string): FluxEventPayload | null {
  try {
    const obj = JSON.parse(data) as FluxEventPayload;
    if (obj && typeof obj === "object") return obj;
    return null;
  } catch {
    return null;
  }
}

export function isFluxEventPayload(
  p: FluxEventPayload | null
): p is FluxEventPayload & { event: FluxEventType } {
  return (
    p != null &&
    typeof p.event === "string" &&
    ["Update", "StartOfTurn", "EagerEndOfTurn", "TurnResumed", "EndOfTurn"].includes(p.event)
  );
}
