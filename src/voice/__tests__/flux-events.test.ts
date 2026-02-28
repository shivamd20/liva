import { describe, it, expect } from "vitest";
import { parseFluxEvent, isFluxEventPayload, type FluxEventPayload } from "../flux-events";

describe("flux-events", () => {
  describe("parseFluxEvent", () => {
    it("parses valid StartOfTurn payload", () => {
      const data = JSON.stringify({ event: "StartOfTurn", request_id: "r1", turn_index: 0 });
      const result = parseFluxEvent(data);
      expect(result).not.toBeNull();
      expect(result!.event).toBe("StartOfTurn");
      expect(result!.turn_index).toBe(0);
    });

    it("parses valid EndOfTurn with transcript and confidence", () => {
      const data = JSON.stringify({
        event: "EndOfTurn",
        transcript: "hello world",
        end_of_turn_confidence: 0.95,
        words: [{ word: "hello", confidence: 0.99 }],
      });
      const result = parseFluxEvent(data);
      expect(result).not.toBeNull();
      expect(result!.transcript).toBe("hello world");
      expect(result!.end_of_turn_confidence).toBe(0.95);
    });

    it("parses valid Update payload with words array", () => {
      const data = JSON.stringify({
        event: "Update",
        words: [
          { word: "testing", confidence: 0.98 },
          { word: "now", confidence: 0.96 },
        ],
      });
      const result = parseFluxEvent(data);
      expect(result).not.toBeNull();
      expect(result!.words).toHaveLength(2);
    });

    it("returns null for invalid JSON", () => {
      expect(parseFluxEvent("not json {")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseFluxEvent("")).toBeNull();
    });

    it("returns array for JSON array (typeof 'object')", () => {
      const result = parseFluxEvent("[]");
      expect(result).not.toBeNull();
    });

    it("returns null for JSON null", () => {
      expect(parseFluxEvent("null")).toBeNull();
    });

    it("returns null for JSON number", () => {
      expect(parseFluxEvent("42")).toBeNull();
    });

    it("returns null for JSON string", () => {
      expect(parseFluxEvent('"hello"')).toBeNull();
    });
  });

  describe("isFluxEventPayload", () => {
    const validTypes = ["Update", "StartOfTurn", "EagerEndOfTurn", "TurnResumed", "EndOfTurn"] as const;

    for (const eventType of validTypes) {
      it(`returns true for event type "${eventType}"`, () => {
        const payload: FluxEventPayload = { event: eventType };
        expect(isFluxEventPayload(payload)).toBe(true);
      });
    }

    it("returns false when event field is missing", () => {
      const payload: FluxEventPayload = { request_id: "r1" };
      expect(isFluxEventPayload(payload)).toBe(false);
    });

    it("returns false for unknown event type", () => {
      const payload = { event: "Unknown" } as any;
      expect(isFluxEventPayload(payload)).toBe(false);
    });

    it("returns false for null input", () => {
      expect(isFluxEventPayload(null)).toBe(false);
    });
  });
});
