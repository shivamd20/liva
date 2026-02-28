import { describe, it, expect } from "vitest";
import { formatForProsody, AVAILABLE_VOICES } from "../tts-adapter";

describe("tts-adapter", () => {
  describe("formatForProsody", () => {
    // I1: Adds commas after acknowledgments
    it("adds comma after 'Sure' followed by text", () => {
      expect(formatForProsody("Sure let me check")).toBe("Sure, let me check");
    });

    it("adds comma after 'Got it' followed by text", () => {
      expect(formatForProsody("Got it I'll do that")).toBe("Got it, I'll do that");
    });

    it("adds comma after 'Right' followed by text", () => {
      expect(formatForProsody("Right here's the plan")).toBe("Right, here's the plan");
    });

    it("adds comma after 'Okay' followed by text", () => {
      expect(formatForProsody("Okay so here's what I think")).toBe("Okay, so here's what I think");
    });

    it("does not double-add comma if already present", () => {
      const input = "Sure, I'll check that";
      expect(formatForProsody(input)).toBe("Sure, I'll check that");
    });

    // I2: Normalizes em-dashes and whitespace
    it("normalizes em-dashes with spaces", () => {
      expect(formatForProsody("Think—okay here")).toBe("Think — okay here");
    });

    it("normalizes double spaces", () => {
      expect(formatForProsody("Extra   spaces   here")).toBe("Extra spaces here");
    });

    it("trims leading and trailing whitespace", () => {
      expect(formatForProsody("  hello world  ")).toBe("hello world");
    });

    it("preserves trailing punctuation", () => {
      expect(formatForProsody("This is great!")).toBe("This is great!");
      expect(formatForProsody("Is it ready?")).toBe("Is it ready?");
    });

    // I1 edge: empty string
    it("returns empty string for empty input", () => {
      expect(formatForProsody("")).toBe("");
    });

    // I2 edge: multiple acknowledgments
    it("adds commas after multiple acknowledgments", () => {
      const result = formatForProsody("Sure Okay let's go");
      expect(result).toContain("Sure,");
      expect(result).toContain("Okay,");
    });

    // I3 edge: already correct text is unchanged
    it("does not alter already well-formatted text", () => {
      expect(formatForProsody("Hello, how are you?")).toBe("Hello, how are you?");
    });

    // I4 edge: multiple em-dashes
    it("normalizes multiple em-dashes", () => {
      const result = formatForProsody("first—second—third");
      expect(result).toBe("first — second — third");
    });

    // I5 edge: preserves question marks and exclamations
    it("preserves question marks and exclamations", () => {
      expect(formatForProsody("Really? Yes! Wow.")).toBe("Really? Yes! Wow.");
    });
  });

  // I3: Available voices
  describe("AVAILABLE_VOICES", () => {
    it("contains 12 voices", () => {
      expect(AVAILABLE_VOICES).toHaveLength(12);
    });

    it("includes luna as default", () => {
      expect(AVAILABLE_VOICES).toContain("luna");
    });

    it("includes asteria, orion, and other voices", () => {
      expect(AVAILABLE_VOICES).toContain("asteria");
      expect(AVAILABLE_VOICES).toContain("orion");
      expect(AVAILABLE_VOICES).toContain("stella");
      expect(AVAILABLE_VOICES).toContain("athena");
      expect(AVAILABLE_VOICES).toContain("zeus");
    });
  });
});
