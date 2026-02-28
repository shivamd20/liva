import { describe, it, expect } from "vitest";
import { parseClientJson, serializeServerJson, type ServerToClientJson } from "../protocol";

describe("protocol", () => {
  describe("parseClientJson", () => {
    // H1: Valid messages
    it("parses session.init with systemPrompt", () => {
      const result = parseClientJson(JSON.stringify({
        type: "session.init",
        systemPrompt: "You are a helper",
      }));
      expect(result).not.toBeNull();
      expect(result!.type).toBe("session.init");
      expect((result as any).systemPrompt).toBe("You are a helper");
    });

    it("parses control.mute", () => {
      const result = parseClientJson(JSON.stringify({ type: "control.mute", value: true }));
      expect(result).toEqual({ type: "control.mute", value: true });
    });

    it("parses control.interrupt", () => {
      const result = parseClientJson(JSON.stringify({ type: "control.interrupt" }));
      expect(result).toEqual({ type: "control.interrupt" });
    });

    it("parses transcript_final with text", () => {
      const result = parseClientJson(JSON.stringify({
        type: "transcript_final",
        text: "hello world",
      }));
      expect(result).toEqual({ type: "transcript_final", text: "hello world" });
    });

    it("parses transcript_final with turnId", () => {
      const result = parseClientJson(JSON.stringify({
        type: "transcript_final",
        text: "hello",
        turnId: "42",
      }));
      expect(result).toEqual({ type: "transcript_final", text: "hello", turnId: "42" });
    });

    it("parses tool_result", () => {
      const result = parseClientJson(JSON.stringify({
        type: "tool_result",
        toolCallId: "tc-1",
        result: { image: "data:..." },
      }));
      expect(result).toEqual({
        type: "tool_result",
        toolCallId: "tc-1",
        result: { image: "data:..." },
      });
    });

    it("parses ping", () => {
      const result = parseClientJson(JSON.stringify({ type: "ping" }));
      expect(result).toEqual({ type: "ping" });
    });

    // Edge cases
    it("returns null for invalid JSON", () => {
      expect(parseClientJson("not json")).toBeNull();
    });

    it("returns null for unknown type", () => {
      expect(parseClientJson(JSON.stringify({ type: "unknown" }))).toBeNull();
    });

    it("returns null for transcript_final without text field", () => {
      expect(parseClientJson(JSON.stringify({ type: "transcript_final" }))).toBeNull();
    });

    it("parses transcript_final with empty text (server validates later)", () => {
      const result = parseClientJson(JSON.stringify({
        type: "transcript_final",
        text: "",
      }));
      expect(result).toEqual({ type: "transcript_final", text: "" });
    });

    it("returns null for session.init with empty systemPrompt", () => {
      expect(parseClientJson(JSON.stringify({
        type: "session.init",
        systemPrompt: "",
      }))).toBeNull();
    });

    it("returns null for session.init with whitespace-only systemPrompt", () => {
      expect(parseClientJson(JSON.stringify({
        type: "session.init",
        systemPrompt: "   ",
      }))).toBeNull();
    });

    it("trims session.init systemPrompt", () => {
      const result = parseClientJson(JSON.stringify({
        type: "session.init",
        systemPrompt: "  hello  ",
      }));
      expect(result).toEqual({ type: "session.init", systemPrompt: "hello" });
    });

    // H3: New voice and eagerness fields
    it("parses session.init with voice field", () => {
      const result = parseClientJson(JSON.stringify({
        type: "session.init",
        systemPrompt: "test",
        voice: "asteria",
      }));
      expect(result).not.toBeNull();
      expect((result as any).voice).toBe("asteria");
    });

    it("parses session.init with eagerness field", () => {
      const result = parseClientJson(JSON.stringify({
        type: "session.init",
        systemPrompt: "test",
        eagerness: "high",
      }));
      expect(result).not.toBeNull();
      expect((result as any).eagerness).toBe("high");
    });

    it("parses session.init with both voice and eagerness", () => {
      const result = parseClientJson(JSON.stringify({
        type: "session.init",
        systemPrompt: "test",
        voice: "orion",
        eagerness: "low",
      }));
      expect(result).not.toBeNull();
      expect((result as any).voice).toBe("orion");
      expect((result as any).eagerness).toBe("low");
    });

    it("parses session.init without voice/eagerness (backward compat)", () => {
      const result = parseClientJson(JSON.stringify({
        type: "session.init",
        systemPrompt: "test",
      }));
      expect(result).not.toBeNull();
      expect(result).toEqual({ type: "session.init", systemPrompt: "test" });
      expect("voice" in (result as any)).toBe(false);
      expect("eagerness" in (result as any)).toBe(false);
    });

    // Phase 1D: Edge cases
    it("ignores extra unknown fields", () => {
      const result = parseClientJson(JSON.stringify({ type: "ping", foo: "bar", baz: 42 }));
      expect(result).toEqual({ type: "ping" });
    });

    it("parses transcript_final with very long text (10KB)", () => {
      const longText = "A".repeat(10_240);
      const result = parseClientJson(JSON.stringify({ type: "transcript_final", text: longText }));
      expect(result).not.toBeNull();
      expect((result as any).text).toHaveLength(10_240);
    });

    it("parses session.init with invalid eagerness value (no validation)", () => {
      const result = parseClientJson(JSON.stringify({
        type: "session.init",
        systemPrompt: "test",
        eagerness: "extreme",
      }));
      expect(result).not.toBeNull();
      expect((result as any).eagerness).toBe("extreme");
    });

    it("parses tool_result with deeply nested result", () => {
      const result = parseClientJson(JSON.stringify({
        type: "tool_result",
        toolCallId: "x",
        result: { nested: { deep: { value: true } } },
      }));
      expect(result).not.toBeNull();
      expect((result as any).result.nested.deep.value).toBe(true);
    });

    it("returns null for control.mute with number value instead of boolean", () => {
      const result = parseClientJson(JSON.stringify({ type: "control.mute", value: 0 }));
      expect(result).toBeNull();
    });

    it("returns null for null input", () => {
      expect(parseClientJson("null")).toBeNull();
    });
  });

  // H2: serializeServerJson round-trip
  describe("serializeServerJson", () => {
    const testCases: ServerToClientJson[] = [
      { type: "state", value: "connected" },
      { type: "state", value: "streaming" },
      { type: "state", value: "closed" },
      { type: "error", reason: "Something went wrong" },
      { type: "status", value: "thinking" },
      { type: "status", value: "synthesizing" },
      { type: "status", value: "interrupted" },
      { type: "llm_partial", text: "Hello" },
      { type: "llm_partial", text: "world", turnId: "5" },
      { type: "llm_complete", text: "Hello world" },
      { type: "llm_complete", text: "done", turnId: "5" },
      { type: "llm_error", reason: "rate limited" },
      { type: "llm_error", reason: "timeout", turnId: "3" },
      { type: "tool_request", toolCallId: "tc-1", name: "read_board" },
      { type: "tool_request", toolCallId: "tc-2", name: "add_sticky_note", args: { text: "hello" } },
      { type: "tts_error", text: "Failed to synthesize" },
      { type: "audio_end" },
      { type: "audio_end", turnId: "7" },
      { type: "pong" },
    ];

    for (const msg of testCases) {
      it(`round-trips ${msg.type}${(msg as any).value ? `:${(msg as any).value}` : ""}`, () => {
        const serialized = serializeServerJson(msg);
        const parsed = JSON.parse(serialized);
        expect(parsed).toEqual(msg);
      });
    }
  });
});
