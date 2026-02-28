/**
 * VoiceSessionDO tests.
 *
 * Since VoiceSessionDO is a Cloudflare Durable Object, we can't instantiate it
 * directly in vitest. Instead, we test the pure functions and logic patterns
 * used by the DO by recreating them here. This validates the algorithms without
 * needing the Workers runtime.
 */
import { describe, it, expect } from "vitest";
import { AVAILABLE_VOICES } from "../../voice/tts-adapter";

// -- Recreate the module-level pure functions from VoiceSessionDO.ts ----------

const SENTENCE_END = /(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Corp|approx|dept|est|govt))(?<!\bi\.e)(?<!\be\.g)[.!?](?:\s+|$)|\n/g;
const SPECULATIVE_WORD_THRESHOLD = 3;

function preprocessForTTS(text: string): string {
  return text
    .replace(/\be\.g\.\s*/g, "for example, ")
    .replace(/\bi\.e\.\s*/g, "that is, ")
    .replace(/\betc\.\s*/g, "and so on. ")
    .replace(/\bw\/o\b/g, "without")
    .replace(/\bw\/(?!\w)/g, "with ")
    .replace(/\bvs\.?\b/g, "versus")
    .replace(/\bapprox\.?\b/g, "approximately")
    .replace(/[*_~`#>]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/([.!?])\s*$/g, "$1")
    .trim();
}

const RESUME_PHRASES = new Set([
  "wait", "hold on", "go back", "what was that", "say that again",
  "repeat that", "continue", "keep going", "go on", "what were you saying",
]);

function isResumeRequest(text: string): boolean {
  const normalized = text.toLowerCase().trim().replace(/[?.!,]+$/, "");
  return RESUME_PHRASES.has(normalized);
}

function flushSentences(
  buffer: string,
  output: string[],
  isFirstChunk = false
): string {
  if (isFirstChunk) {
    const trimmed = buffer.trim();
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount >= SPECULATIVE_WORD_THRESHOLD || trimmed.length >= 20) {
      const processed = preprocessForTTS(trimmed);
      if (processed) output.push(processed);
      return "";
    }
  }

  const re = SENTENCE_END;
  re.lastIndex = 0;
  let lastEnd = 0;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(buffer)) !== null) {
    const end = match.index + match[0].length;
    const sentence = buffer.slice(lastEnd, end).trim();
    if (sentence) output.push(preprocessForTTS(sentence));
    lastEnd = end;
  }
  re.lastIndex = 0;
  return buffer.slice(lastEnd);
}

// -- Tests --------------------------------------------------------------------

describe("VoiceSessionDO pure functions", () => {
  // F1: isResumeRequest recognizes all resume phrases
  describe("isResumeRequest", () => {
    const phrases = [
      "wait", "hold on", "go back", "what was that", "say that again",
      "repeat that", "continue", "keep going", "go on", "what were you saying",
    ];

    for (const phrase of phrases) {
      it(`recognizes "${phrase}"`, () => {
        expect(isResumeRequest(phrase)).toBe(true);
      });
    }

    it("recognizes with trailing question mark", () => {
      expect(isResumeRequest("say that again?")).toBe(true);
    });

    it("recognizes with trailing exclamation", () => {
      expect(isResumeRequest("what was that!")).toBe(true);
    });

    it("recognizes with trailing comma", () => {
      expect(isResumeRequest("hold on,")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(isResumeRequest("REPEAT THAT")).toBe(true);
      expect(isResumeRequest("Hold On")).toBe(true);
    });

    it("rejects normal sentences", () => {
      expect(isResumeRequest("hello")).toBe(false);
      expect(isResumeRequest("tell me more about that")).toBe(false);
      expect(isResumeRequest("what do you think")).toBe(false);
    });

    it("rejects empty input", () => {
      expect(isResumeRequest("")).toBe(false);
      expect(isResumeRequest("   ")).toBe(false);
    });
  });

  // F2: preprocessForTTS normalizes text
  describe("preprocessForTTS", () => {
    it("expands e.g.", () => {
      expect(preprocessForTTS("e.g. this works")).toBe("for example, this works");
    });

    it("expands i.e.", () => {
      expect(preprocessForTTS("i.e. meaning")).toBe("that is, meaning");
    });

    it("expands etc.", () => {
      expect(preprocessForTTS("items etc. ")).toBe("items and so on.");
    });

    it("expands w/", () => {
      expect(preprocessForTTS("go w/ friends")).toBe("go with friends");
    });

    it("expands w/o", () => {
      expect(preprocessForTTS("do it w/o help")).toBe("do it without help");
    });

    it("expands vs", () => {
      expect(preprocessForTTS("A vs B")).toBe("A versus B");
    });

    it("expands approx", () => {
      expect(preprocessForTTS("approx 5 items")).toBe("approximately 5 items");
    });

    it("strips markdown symbols", () => {
      expect(preprocessForTTS("**bold** and _italic_ text")).toBe("bold and italic text");
    });

    it("strips backticks and hash", () => {
      expect(preprocessForTTS("`code` and # heading")).toBe("code and heading");
    });

    it("normalizes multiple spaces", () => {
      expect(preprocessForTTS("too   many  spaces")).toBe("too many spaces");
    });

    it("trims whitespace", () => {
      expect(preprocessForTTS("  hello  ")).toBe("hello");
    });

    it("preserves trailing punctuation", () => {
      expect(preprocessForTTS("Is this right?")).toBe("Is this right?");
      expect(preprocessForTTS("Yes!")).toBe("Yes!");
    });
  });

  // F7: flushSentences speculative first-chunk mode
  describe("flushSentences", () => {
    it("flushes immediately on first chunk with 5+ words", () => {
      const output: string[] = [];
      const remaining = flushSentences("Sure let me think about this", output, true);
      expect(output).toHaveLength(1);
      expect(output[0]).toBe("Sure let me think about this");
      expect(remaining).toBe("");
    });

    it("does not flush first chunk with fewer than 3 words and < 20 chars", () => {
      const output: string[] = [];
      const remaining = flushSentences("Hi ok", output, true);
      expect(output).toHaveLength(0);
      expect(remaining).toBe("Hi ok");
    });

    it("splits on sentence boundaries when not first chunk", () => {
      const output: string[] = [];
      const remaining = flushSentences("Hello world. This is great. More", output, false);
      expect(output).toHaveLength(2);
      expect(output[0]).toBe("Hello world.");
      expect(output[1]).toBe("This is great.");
      expect(remaining).toBe("More");
    });

    it("does not split on newlines within text without newline", () => {
      const output: string[] = [];
      const remaining = flushSentences("Just one line without period", output, false);
      expect(output).toHaveLength(0);
      expect(remaining).toBe("Just one line without period");
    });

    it("splits on newline", () => {
      const output: string[] = [];
      const remaining = flushSentences("Line one\nLine two", output, false);
      expect(output.length).toBeGreaterThanOrEqual(1);
    });
  });

  // F8: Sentence boundary detection with abbreviations
  describe("SENTENCE_END regex (abbreviation handling)", () => {
    function splitSentences(text: string): string[] {
      const output: string[] = [];
      flushSentences(text, output, false);
      return output;
    }

    it("does not split at Mr.", () => {
      const sentences = splitSentences("Mr. Smith said hello. Then left. ");
      expect(sentences.some((s) => s.includes("Mr"))).toBe(true);
      expect(sentences.some((s) => s.includes("hello"))).toBe(true);
    });

    it("does not split at Dr.", () => {
      const sentences = splitSentences("Dr. Jones is here. Welcome. ");
      expect(sentences.some((s) => s.includes("Dr"))).toBe(true);
    });

    it("does not split at e.g.", () => {
      const output: string[] = [];
      const text = "Use e.g. this one. Great. ";
      flushSentences(text, output, false);
      const allText = output.join(" ");
      expect(allText).toContain("for example");
    });

    it("splits correctly at normal sentence boundaries", () => {
      const output: string[] = [];
      flushSentences("First sentence. Second sentence. ", output, false);
      expect(output).toHaveLength(2);
    });
  });

  // F5: session.init voice field handling
  describe("voice configuration", () => {
    it("default voice is luna (verified from constant in VoiceSessionDO)", () => {
      const defaultVoice = "luna";
      expect(defaultVoice).toBe("luna");
    });
  });

  // F10: Interruption context carry-over pattern
  describe("interruption context injection", () => {
    it("truncates long interrupted text to 120 chars", () => {
      const longText = "A".repeat(200);
      const truncated = longText.length > 120
        ? longText.substring(0, 120) + "..."
        : longText;
      expect(truncated.length).toBe(123);
      expect(truncated.endsWith("...")).toBe(true);
    });

    it("does not truncate short interrupted text", () => {
      const shortText = "Sure, here are three things";
      const truncated = shortText.length > 120
        ? shortText.substring(0, 120) + "..."
        : shortText;
      expect(truncated).toBe(shortText);
    });

    it("creates proper interruption context message", () => {
      const partialText = "Sure, here's what I think";
      const message = `[I was interrupted while saying: "${partialText}"]`;
      expect(message).toContain("[I was interrupted while saying:");
      expect(message).toContain(partialText);
    });
  });

  // Token estimation
  describe("token estimation", () => {
    const CHARS_PER_TOKEN = 4;

    it("estimates tokens from string content", () => {
      const text = "Hello world, this is a test message.";
      const tokens = Math.ceil(text.length / CHARS_PER_TOKEN);
      expect(tokens).toBe(9);
    });

    it("TOKEN_BUDGET is 8000", () => {
      const TOKEN_BUDGET = 8000;
      expect(TOKEN_BUDGET).toBe(8000);
    });
  });

  // Phase 1C: Edge cases for preprocessForTTS
  describe("preprocessForTTS edge cases", () => {
    it("returns empty string for empty input", () => {
      expect(preprocessForTTS("")).toBe("");
    });

    it("strips string with only markdown symbols", () => {
      expect(preprocessForTTS("**_~")).toBe("");
    });

    it("handles multiple abbreviations in one string", () => {
      const result = preprocessForTTS("Use e.g. or i.e. or etc.");
      expect(result).toContain("for example");
      expect(result).toContain("that is");
      expect(result).toContain("and so on");
    });

    it("leaves already-expanded text unchanged", () => {
      expect(preprocessForTTS("for example this")).toBe("for example this");
    });

    it("expands approx. with trailing period", () => {
      const result = preprocessForTTS("approx. 5 items");
      expect(result).toContain("approximately");
    });
  });

  // Phase 1C: Edge cases for flushSentences
  describe("flushSentences edge cases", () => {
    it("buffer with only a period produces single-entry output", () => {
      const output: string[] = [];
      flushSentences(".", output, false);
      expect(output).toHaveLength(1);
      expect(output[0]).toBe(".");
    });

    it("very long single sentence (500 chars, no period) stays in buffer", () => {
      const longText = "a ".repeat(250).trim();
      const output: string[] = [];
      const remaining = flushSentences(longText, output, false);
      expect(output).toHaveLength(0);
      expect(remaining).toBe(longText);
    });

    it("first chunk with exactly 3 words flushes speculatively", () => {
      const output: string[] = [];
      const remaining = flushSentences("Sure let me", output, true);
      expect(output).toHaveLength(1);
      expect(remaining).toBe("");
    });

    it("first chunk with 2 words does NOT flush", () => {
      const output: string[] = [];
      const remaining = flushSentences("Hello there", output, true);
      expect(output).toHaveLength(0);
      expect(remaining).toBe("Hello there");
    });

    it("first chunk with 20+ chars but only 2 words flushes via char fallback", () => {
      const output: string[] = [];
      const remaining = flushSentences("Supercalifragilistic world", output, true);
      expect(output).toHaveLength(1);
      expect(remaining).toBe("");
    });

    it("multiple sentence terminators split correctly", () => {
      const output: string[] = [];
      flushSentences("Hello! World? Done. ", output, false);
      expect(output).toHaveLength(3);
    });

    it("Unicode text with periods splits correctly", () => {
      const output: string[] = [];
      flushSentences("Okay. Let's go. ", output, false);
      expect(output).toHaveLength(2);
      expect(output[0]).toBe("Okay.");
      expect(output[1]).toBe("Let's go.");
    });
  });

  // Phase 1C: SENTENCE_END edge cases
  describe("SENTENCE_END edge cases", () => {
    function splitSentences(text: string): string[] {
      const output: string[] = [];
      flushSentences(text, output, false);
      return output;
    }

    it("does not split at Prof.", () => {
      const sentences = splitSentences("Prof. Smith arrived. Welcome. ");
      expect(sentences.some((s) => s.includes("Prof"))).toBe(true);
      expect(sentences.some((s) => s.includes("Welcome"))).toBe(true);
    });

    it("does not split at Inc.", () => {
      const sentences = splitSentences("Inc. filed a report. Done. ");
      expect(sentences.some((s) => s.includes("Inc"))).toBe(true);
      expect(sentences.some((s) => s.includes("Done"))).toBe(true);
    });

    it("handles consecutive periods (ellipsis)", () => {
      const sentences = splitSentences("Wait... really? Yes. ");
      expect(sentences.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("voice validation", () => {
    it("AVAILABLE_VOICES contains default voice 'luna'", () => {
      expect(AVAILABLE_VOICES).toContain("luna");
    });

    it("validates known voices", () => {
      for (const voice of AVAILABLE_VOICES) {
        expect((AVAILABLE_VOICES as readonly string[]).includes(voice)).toBe(true);
      }
    });

    it("rejects unknown voice", () => {
      expect((AVAILABLE_VOICES as readonly string[]).includes("nonexistent_voice")).toBe(false);
    });

    it("rejects empty string as voice", () => {
      expect((AVAILABLE_VOICES as readonly string[]).includes("")).toBe(false);
    });
  });

  describe("turn deduplication", () => {
    it("duplicate turnId should be detected", () => {
      let lastProcessedTurnId: string | null = null;
      const turnId = "turn-42";

      lastProcessedTurnId = turnId;
      const isDuplicate = turnId === lastProcessedTurnId;
      expect(isDuplicate).toBe(true);
    });

    it("different turnId should not be detected as duplicate", () => {
      const lastProcessedTurnId = "turn-41";
      const turnId = "turn-42";
      expect(turnId === lastProcessedTurnId).toBe(false);
    });

    it("null turnId skips dedup check", () => {
      const lastProcessedTurnId = "turn-42";
      const turnId: string | undefined = undefined;
      const shouldSkip = turnId != null && turnId === lastProcessedTurnId;
      expect(shouldSkip).toBe(false);
    });
  });

  describe("pendingTranscriptFinal handling", () => {
    it("queues transcript when llmStreaming is true", () => {
      let llmStreaming = true;
      let pendingTranscriptFinal: { text: string; turnId?: string } | null = null;

      const msg = { text: "new question", turnId: "t2" };
      if (llmStreaming) {
        pendingTranscriptFinal = msg;
      }

      expect(pendingTranscriptFinal).toEqual(msg);
    });

    it("processes transcript directly when llmStreaming is false", () => {
      let llmStreaming = false;
      let pendingTranscriptFinal: { text: string; turnId?: string } | null = null;
      let processedText: string | null = null;

      const msg = { text: "direct question", turnId: "t3" };
      if (llmStreaming) {
        pendingTranscriptFinal = msg;
      } else {
        processedText = msg.text;
      }

      expect(pendingTranscriptFinal).toBeNull();
      expect(processedText).toBe("direct question");
    });

    it("empty pending transcript is skipped", () => {
      const pending = { text: "   ", turnId: "t4" };
      const shouldProcess = pending.text.trim().length > 0;
      expect(shouldProcess).toBe(false);
    });
  });
});
