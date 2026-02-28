import { DurableObject } from "cloudflare:workers";
import { LivaAIModel } from "../ai/liva-ai-model";
import { readBoardDef, addStickyNoteDef, highlightAreaDef } from "./chat-tools";
import {
  parseClientJson,
  serializeServerJson,
  type ClientToServerJson,
  type ServerToClientJson,
} from "../voice/protocol";
import { runAura2, AVAILABLE_VOICES } from "../voice/tts-adapter";

const VOICE_SYSTEM_PROMPT = `You are Liva, a creative collaborator who helps people think visually on their whiteboard. You talk like a smart coworker — casual, direct, and genuinely interested in what they're building.

HOW TO SPEAK:
- Short sentences. Plain words. No filler.
- Use contractions naturally: "I'll", "let's", "that's", "here's".
- Never output markdown, bullet points, asterisks, or numbered lists. This is spoken audio.
- Acknowledge briefly before answering: "Sure", "Got it", "Okay so".
- 2-3 sentences per response. If the topic is complex, give a one-line summary and ask if they want the full version.
- When you see board content, describe what you actually see — specific shapes, text, arrows, clusters. Use spatial language: "that group on the left", "the arrow going from X to Y".

WHEN THE USER IS THINKING:
If they trail off, say "hmm", "let me think", or seem to be working through an idea — just give a short acknowledgment or stay quiet. Don't jump in with answers.

USING TOOLS:
You have three tools. Always say what you're doing before calling one.

read_board — Takes a screenshot of the board. Call this when:
  - They ask you to look at, describe, check, or review the board.
  - They say "this", "what I drew", "my board", "what's here", "take a look".
  - You need context about what's on the board to give a useful answer.
  Say something like "Let me take a look at your board" before calling it.
  After seeing the board, reference specific things you notice.

add_sticky_note — Places a colored sticky note on the board. Call this when:
  - They ask you to write something down, add a note, capture an idea, or put something on the board.
  - You've summarized something and they want it saved.
  Keep note text concise — a few words to one short sentence.
  Pick a meaningful color: yellow for general notes, blue for questions or ideas, green for decisions or completed items, pink for important or urgent things, orange for warnings or blockers.

highlight_area — Highlights the board to draw their attention. Call this when:
  - You're pointing out a specific region during discussion.
  - They ask "where?" or "which part?" about something on the board.

TOOL BEHAVIOR:
- Only call one tool at a time. Wait for the result before continuing.
- If a tool fails, tell the user briefly and move on. Don't retry automatically.
- After calling read_board, talk about what you see. Don't just say "I see your board."
- If you're unsure whether to use a tool, it's better to ask: "Want me to check your board?" or "Should I add that as a note?"

PERSONALITY:
Match the user's energy. If they're excited, match it. If they're frustrated, be calm and solution-focused. Be opinionated when asked — don't hedge with "it depends" unless it truly does. You're a collaborator, not an assistant.`;

class AsyncQueue<T> {
  private buffer: T[] = [];
  private waiting: ((value: T) => void) | null = null;
  push(item: T): void {
    if (this.waiting) {
      this.waiting(item);
      this.waiting = null;
    } else {
      this.buffer.push(item);
    }
  }
  async get(): Promise<T> {
    if (this.buffer.length > 0) return this.buffer.shift()!;
    return new Promise((resolve) => {
      this.waiting = resolve;
    });
  }
}

const SENTENCE_END = /(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Corp|approx|dept|est|govt))(?<!\bi\.e)(?<!\be\.g)[.!?](?:\s+|$)|\n/g;
const TTS_FIRST_CHUNK_TIMEOUT_MS = 4_000;
const MIN_PARTIAL_LENGTH = 5;
const TOKEN_BUDGET = 8000;
const CHARS_PER_TOKEN = 4;
const TOOL_RESULT_TIMEOUT_MS = 30_000;
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

type VoiceContentPart =
  | { type: "text"; content: string }
  | { type: "image"; source: { type: "data"; value: string }; metadata?: { mimeType?: string } };

type VoiceMessage = {
  role: "user" | "assistant" | "tool";
  content: string | VoiceContentPart[];
  toolCallId?: string;
  toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
};

export class VoiceSessionDO extends DurableObject {
  private sql: SqlStorage;
  private ws: WebSocket | null = null;
  private closed = false;
  private messageQueue: AsyncQueue<ClientToServerJson> | null = null;
  private aiModel: LivaAIModel;
  private messages: VoiceMessage[] = [];
  private llmStreaming = false;
  private aborted = false;
  private activeAbortController: AbortController | null = null;
  private turnIndex = 0;
  private lastProcessedTurnId: string | null = null;
  private pendingTranscriptFinal: Extract<ClientToServerJson, { type: "transcript_final" }> | null = null;
  private systemPrompt: string | null = null;
  private lastInterruptedText: string | null = null;
  private currentTurnId: string | null = null;
  private voiceSpeaker: string = "luna";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.aiModel = new LivaAIModel(env);
    this.initializeTables();
  }

  private initializeTables() {
    try {
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS voice_events (
          id TEXT PRIMARY KEY,
          timestamp INTEGER,
          type TEXT,
          payload TEXT,
          metadata TEXT
        );
      `);
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS session_facts (
          id TEXT PRIMARY KEY,
          fact TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
    } catch (e) {
      console.error("[VoiceSessionDO] init tables", e);
    }
  }

  private estimateTokens(): number {
    let chars = 0;
    for (const m of this.messages) {
      if (typeof m.content === "string") {
        chars += m.content.length;
      } else if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (part.type === "text") chars += part.content.length;
          else if (part.type === "image") chars += 200;
        }
      }
      if (m.toolCalls) chars += JSON.stringify(m.toolCalls).length;
    }
    return Math.ceil(chars / CHARS_PER_TOKEN);
  }

  private stripImageMessages(): void {
    for (let i = 0; i < this.messages.length; i++) {
      const m = this.messages[i];
      if (m.role === "user" && Array.isArray(m.content)) {
        const hasImage = m.content.some((p) => p.type === "image");
        if (hasImage) {
          this.messages[i] = { role: "user", content: "[Board snapshot was provided to the AI at this point in conversation]" };
        }
      }
    }
  }

  private async maybeCompact(systemPrompt: string): Promise<void> {
    const tokens = this.estimateTokens();
    if (tokens <= TOKEN_BUDGET || this.messages.length < 4) return;
    const halfIdx = Math.max(2, Math.floor(this.messages.length / 2));
    const oldMessages = this.messages.slice(0, halfIdx);
    const conversationText = oldMessages
      .map((m) => {
        const content = typeof m.content === "string" ? m.content : "[multimodal content]";
        return `${m.role}: ${content}`;
      })
      .join("\n");

    try {
      const summaryStream = await this.aiModel.streamChatVoice(
        [{ role: "user", content: `Summarize this conversation preserving:\n1. Key decisions made\n2. Action items or next steps discussed\n3. Important facts about the user's project or board\n4. The current topic being discussed\nFormat as a brief structured summary with labeled sections. Be concise.\n\n${conversationText}` }],
        { systemPrompt: "You are a summarizer. Output a structured summary preserving key context. Be concise — no more than 5 sentences total." }
      );
      let summary = "";
      for await (const chunk of summaryStream as AsyncIterable<{ type: string; delta?: string; content?: string }>) {
        const delta = (chunk as any).delta ?? (chunk as any).content ?? "";
        if (delta) summary += delta;
      }
      if (summary.trim()) {
        this.messages = [
          { role: "user", content: `[Previous conversation summary]: ${summary.trim()}` },
          ...this.messages.slice(halfIdx),
        ];
        this.persistEvent("compaction", summary.trim(), { removedCount: halfIdx, remainingCount: this.messages.length });
        this.extractAndStoreFacts(conversationText).catch(() => {});
      }
    } catch (e) {
      console.error("[VoiceSessionDO] compaction failed (non-fatal)", e);
    }
  }

  private async extractAndStoreFacts(conversationText: string): Promise<void> {
    try {
      const stream = await this.aiModel.streamChatVoice(
        [{ role: "user", content: `Extract 1-3 key persistent facts from this conversation that would be useful to remember across sessions. Only include concrete facts about the user, their project, preferences, or decisions. Output each fact on its own line. If there are no notable facts, output nothing.\n\n${conversationText}` }],
        { systemPrompt: "You extract key persistent facts. Output only the facts, one per line. No numbering or bullets." }
      );
      let result = "";
      for await (const chunk of stream as AsyncIterable<{ type: string; delta?: string; content?: string }>) {
        const delta = (chunk as any).delta ?? (chunk as any).content ?? "";
        if (delta) result += delta;
      }
      const facts = result.trim().split("\n").filter((f) => f.trim().length > 5);
      const now = Date.now();
      for (const fact of facts) {
        const id = crypto.randomUUID();
        try {
          this.sql.exec(
            `INSERT OR IGNORE INTO session_facts (id, fact, created_at) VALUES (?, ?, ?)`,
            id, fact.trim(), now
          );
        } catch {}
      }
    } catch (e) {
      console.error("[VoiceSessionDO] fact extraction failed (non-fatal)", e);
    }
  }

  private loadSessionFacts(): string[] {
    try {
      const rows = this.sql.exec(
        `SELECT fact FROM session_facts ORDER BY created_at DESC LIMIT 10`
      ).toArray();
      return rows.map((r) => r.fact as string);
    } catch {
      return [];
    }
  }

  private loadSessionFromEvents(): void {
    try {
      const compactionRow = this.sql.exec(
        `SELECT payload FROM voice_events WHERE type = 'compaction' ORDER BY timestamp DESC LIMIT 1`
      ).toArray();
      let startTimestamp = 0;
      if (compactionRow.length > 0) {
        const summary = compactionRow[0].payload as string;
        this.messages.push({ role: "user", content: `[Previous conversation summary]: ${summary}` });
        const tsRow = this.sql.exec(
          `SELECT timestamp FROM voice_events WHERE type = 'compaction' ORDER BY timestamp DESC LIMIT 1`
        ).toArray();
        startTimestamp = (tsRow[0]?.timestamp as number) ?? 0;
      }
      const events = this.sql.exec(
        `SELECT type, payload FROM voice_events WHERE timestamp > ? AND type IN ('audio_in', 'audio_out') ORDER BY timestamp ASC LIMIT 50`,
        startTimestamp
      ).toArray();
      for (const ev of events) {
        const role = ev.type === "audio_in" ? "user" : "assistant";
        this.messages.push({ role, content: ev.payload as string });
      }
    } catch (e) {
      console.error("[VoiceSessionDO] loadSessionFromEvents failed (non-fatal)", e);
    }
  }

  private sendJson(msg: ServerToClientJson): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(serializeServerJson(msg));
    } catch (e) {
      console.error("[VoiceSessionDO] sendJson failed", e);
      this.cleanup();
    }
  }

  private sendStatus(value: "thinking" | "synthesizing" | "interrupted"): void {
    this.sendJson({ type: "status", value });
  }

  private sendBinary(audio: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(audio);
    } catch (e) {
      console.error("[VoiceSessionDO] sendBinary failed", e);
      this.cleanup();
    }
  }

  private persistEvent(type: string, payload: string, metadata: Record<string, unknown> = {}): void {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    try {
      this.sql.exec(
        `INSERT OR IGNORE INTO voice_events (id, timestamp, type, payload, metadata) VALUES (?, ?, ?, ?, ?)`,
        id,
        timestamp,
        type,
        payload,
        JSON.stringify(metadata)
      );
    } catch (e) {
      console.error("[VoiceSessionDO] persistEvent", e);
    }
  }

  private async runAura2WithTimeout(ms: number, text: string, signal?: AbortSignal): Promise<ArrayBuffer | null> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TTS first chunk timeout")), ms)
    );
    const abortPromise = signal
      ? new Promise<never>((_, reject) => {
          if (signal.aborted) reject(new DOMException("Aborted", "AbortError"));
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        })
      : null;
    const promises: Promise<ArrayBuffer | null>[] = [
      runAura2(this.env as any, { text, speaker: this.voiceSpeaker }, signal),
      timeoutPromise,
    ];
    if (abortPromise) promises.push(abortPromise);
    return Promise.race(promises);
  }

  /**
   * Concurrent TTS drainer: consumes sentences from the queue, synthesizes, and sends audio.
   * Runs concurrently with LLM streaming so TTS starts as soon as a sentence is ready.
   */
  private async drainTtsQueue(
    ttsQueue: AsyncQueue<string | null>,
    signal: AbortSignal,
    turnId?: string
  ): Promise<void> {
    let isFirst = true;
    while (true) {
      const sentence = await ttsQueue.get();
      if (sentence === null) break;
      if (signal.aborted) continue;

      try {
        const audio = isFirst
          ? await this.runAura2WithTimeout(TTS_FIRST_CHUNK_TIMEOUT_MS, sentence, signal)
          : await runAura2(this.env as any, { text: sentence, speaker: this.voiceSpeaker }, signal);

        if (isFirst && !signal.aborted) {
          this.sendStatus("synthesizing");
          isFirst = false;
        }

        if (audio && !signal.aborted) {
          this.sendBinary(audio);
        } else if (!audio && !signal.aborted) {
          this.sendJson({ type: "tts_error", text: sentence, ...(turnId ? { turnId } : {}) });
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") continue;
        if (!signal.aborted) {
          this.sendJson({ type: "tts_error", text: sentence, ...(turnId ? { turnId } : {}) });
        }
      }
    }
    if (!signal.aborted) {
      this.sendJson({ type: "audio_end", ...(turnId ? { turnId } : {}) });
    }
  }

  /**
   * Extracts complete sentences from the buffer and pushes them to the TTS queue.
   * Returns the remaining (incomplete) buffer.
   * When isFirstChunk is true, sends partial text to TTS after SPECULATIVE_WORD_THRESHOLD
   * words even without a sentence boundary, reducing time-to-first-audio.
   */
  private flushSentences(buffer: string, ttsQueue: AsyncQueue<string | null>, isFirstChunk = false): string {
    if (isFirstChunk) {
      const trimmed = buffer.trim();
      const wordCount = trimmed.split(/\s+/).length;
      if (wordCount >= SPECULATIVE_WORD_THRESHOLD || trimmed.length >= 20) {
        const processed = preprocessForTTS(trimmed);
        if (processed) ttsQueue.push(processed);
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
      if (sentence) {
        ttsQueue.push(preprocessForTTS(sentence));
      }
      lastEnd = end;
    }
    re.lastIndex = 0;
    return buffer.slice(lastEnd);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    if (this.ws) {
      try { this.ws.close(1000, "replaced by new connection"); } catch {}
    }
    this.cleanup();

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.closed = false;
    this.ws = server;
    this.messageQueue = new AsyncQueue<ClientToServerJson>();
    this.llmStreaming = false;
    this.aborted = false;
    this.activeAbortController = null;
    this.pendingTranscriptFinal = null;

    if (this.messages.length === 0) {
      this.loadSessionFromEvents();
    }

    void this.runProcessorLoop();
    this.sendJson({ type: "state", value: "connected" });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      if (this.closed || _ws !== this.ws) return;
      if (typeof message !== "string") return;
      const parsed = parseClientJson(message);
      if (!parsed) {
        this.sendJson({ type: "error", reason: "Invalid or unknown message" });
        return;
      }
      if (parsed.type === "ping") {
        this.sendJson({ type: "pong" });
        return;
      }
      this.messageQueue?.push(parsed);
    } catch (e) {
      console.error("[VoiceSessionDO] webSocketMessage error", e);
    }
  }

  private async runProcessorLoop(): Promise<void> {
    const queue = this.messageQueue;
    if (!queue) return;
    while (!this.closed && this.messageQueue === queue) {
      const msg = await queue.get();
      if (this.messageQueue !== queue) break;
      if (msg.type === "session.init") {
        this.systemPrompt = msg.systemPrompt;
        if (msg.voice) {
          if ((AVAILABLE_VOICES as readonly string[]).includes(msg.voice)) {
            this.voiceSpeaker = msg.voice;
          } else {
            this.sendJson({ type: "error", reason: `Unknown voice "${msg.voice}", using default` });
          }
        }
        continue;
      }
      if (msg.type === "control.mute") continue;
      if (msg.type === "control.interrupt") {
        this.aborted = true;
        if (this.activeAbortController) this.activeAbortController.abort();
        continue;
      }
      if (msg.type === "transcript_final") {
        if (!msg.text.trim()) {
          this.sendJson({ type: "error", reason: "transcript_final requires non-empty text" });
          continue;
        }
        if (msg.turnId != null && msg.turnId === this.lastProcessedTurnId) continue;

        if (this.llmStreaming) {
          this.aborted = true;
          if (this.activeAbortController) this.activeAbortController.abort();
          this.pendingTranscriptFinal = msg;
          continue;
        }
        await this.runNormalTurn(msg);
      }
      if (msg.type === "tool_result") {
        continue;
      }
      while (this.pendingTranscriptFinal) {
        const next = this.pendingTranscriptFinal;
        this.pendingTranscriptFinal = null;
        if (!next.text.trim()) continue;
        if (next.turnId != null && next.turnId === this.lastProcessedTurnId) continue;
        if (this.llmStreaming) continue;
        await this.runNormalTurn(next);
      }
    }
  }

  private static readonly RESUME_PHRASES = new Set([
    "wait", "hold on", "go back", "what was that", "say that again",
    "repeat that", "continue", "keep going", "go on", "what were you saying",
  ]);

  private isResumeRequest(text: string): boolean {
    const normalized = text.toLowerCase().trim().replace(/[?.!,]+$/, "");
    return VoiceSessionDO.RESUME_PHRASES.has(normalized);
  }

  private async runNormalTurn(parsed: Extract<ClientToServerJson, { type: "transcript_final" }>): Promise<void> {
    const turnId = parsed.turnId ?? undefined;
    this.lastProcessedTurnId = parsed.turnId ?? null;
    this.currentTurnId = turnId ?? null;
    this.llmStreaming = true;
    this.aborted = false;

    const abortController = new AbortController();
    this.activeAbortController = abortController;

    this.turnIndex += 1;

    if (this.lastInterruptedText && this.isResumeRequest(parsed.text)) {
      const resumedText = this.lastInterruptedText;
      this.lastInterruptedText = null;
      this.persistEvent("audio_in", parsed.text, { turnIndex: this.turnIndex, resumed: true });
      this.messages.push({ role: "user", content: parsed.text });
      this.messages.push({ role: "assistant", content: resumedText });
      this.persistEvent("audio_out", resumedText, { turnIndex: this.turnIndex, resumed: true });

      const ttsQueue = new AsyncQueue<string | null>();
      const ttsDrainer = this.drainTtsQueue(ttsQueue, abortController.signal, turnId);
      this.sendStatus("synthesizing");

      const sentences = resumedText.match(/[^.!?\n]+[.!?\n]?/g) || [resumedText];
      for (const s of sentences) {
        if (s.trim()) ttsQueue.push(s.trim());
      }
      ttsQueue.push(null);
      await ttsDrainer;

      this.sendJson({ type: "llm_complete", text: resumedText, ...(turnId ? { turnId } : {}) });
      this.llmStreaming = false;
      this.activeAbortController = null;
      return;
    }

    if (this.lastInterruptedText) {
      const truncated = this.lastInterruptedText.length > 120
        ? this.lastInterruptedText.substring(0, 120) + "..."
        : this.lastInterruptedText;
      this.messages.push({
        role: "assistant",
        content: `[I was interrupted while saying: "${truncated}"]`,
      });
      this.lastInterruptedText = null;
    }

    this.persistEvent("audio_in", parsed.text, { turnIndex: this.turnIndex });
    this.messages.push({ role: "user", content: parsed.text });

    let fullText = "";
    let sentenceBuffer = "";
    let firstChunkFlushed = false;
    const queue = this.messageQueue;
    let systemPrompt = this.systemPrompt ?? VOICE_SYSTEM_PROMPT;

    const facts = this.loadSessionFacts();
    if (facts.length > 0) {
      systemPrompt += `\n\nKNOWN FACTS ABOUT THIS USER/SESSION:\n${facts.map((f) => `- ${f}`).join("\n")}`;
    }

    const ttsQueue = new AsyncQueue<string | null>();

    const ttsDrainer = this.drainTtsQueue(ttsQueue, abortController.signal, turnId);

    this.sendStatus("thinking");

    try {
      const tools = [readBoardDef, addStickyNoteDef, highlightAreaDef];
      let currentMessages: VoiceMessage[] = [...this.messages];

      outer: while (true) {
        const stream = await this.aiModel.streamChatVoice(currentMessages, { tools, systemPrompt });
        let accumulatedText = "";
        let accumulatedToolCalls: Array<{ id?: string; name?: string; arguments?: string }> = [];

        for await (const chunk of stream as AsyncIterable<{ type: string; delta?: string; content?: string; toolCall?: { id?: string; name?: string; arguments?: string } }>) {
          if (this.aborted) break outer;
          if (chunk.type === "content" || chunk.type === "TEXT_MESSAGE_CONTENT") {
            const delta = (chunk as any).delta ?? (chunk as any).content ?? "";
            if (delta) {
              fullText += delta;
              accumulatedText += delta;
              sentenceBuffer += delta;
              this.sendJson({ type: "llm_partial", text: delta, ...(turnId ? { turnId } : {}) });
              const isFirst = !firstChunkFlushed;
              const prevLen = sentenceBuffer.length;
              sentenceBuffer = this.flushSentences(sentenceBuffer, ttsQueue, isFirst);
              if (sentenceBuffer.length < prevLen) firstChunkFlushed = true;
            }
          } else if (chunk.type === "tool_call" && (chunk as any).toolCall) {
            const tc = (chunk as any).toolCall;
            accumulatedToolCalls.push({
              id: tc.id,
              name: tc.name ?? "unknown",
              arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments ?? {}),
            });
            const toolCallId = tc.id ?? tc.name ?? crypto.randomUUID();
            this.sendJson({ type: "tool_request", toolCallId, name: tc.name ?? "unknown", args: tc.arguments });

            let toolResultMsg: Extract<ClientToServerJson, { type: "tool_result" }> | null = null;
            let toolTimedOut = false;
            const toolTimer = setTimeout(() => {
              toolTimedOut = true;
              queue?.push({ type: "control.interrupt" });
            }, TOOL_RESULT_TIMEOUT_MS);

            while (queue && !this.closed) {
              const m = await queue.get();
              if (toolTimedOut) {
                clearTimeout(toolTimer);
                this.sendJson({ type: "llm_error", reason: "Tool timed out waiting for result", ...(turnId ? { turnId } : {}) });
                break outer;
              }
              if (m.type === "control.interrupt") {
                clearTimeout(toolTimer);
                this.aborted = true;
                abortController.abort();
                break outer;
              }
              if (m.type === "transcript_final") {
                clearTimeout(toolTimer);
                this.aborted = true;
                abortController.abort();
                this.pendingTranscriptFinal = m;
                break outer;
              }
              if (m.type === "tool_result" && m.toolCallId === toolCallId) {
                toolResultMsg = m;
                break;
              }
            }
            clearTimeout(toolTimer);
            if (!toolResultMsg || this.aborted) break outer;

            const resultContent =
              typeof toolResultMsg.result === "string"
                ? toolResultMsg.result
                : JSON.stringify(toolResultMsg.result ?? {});
            currentMessages.push({
              role: "assistant",
              content: accumulatedText,
              toolCalls: accumulatedToolCalls,
            });
            currentMessages.push({
              role: "tool",
              content: resultContent,
              toolCallId: toolCallId,
            });
            const resultObj = typeof toolResultMsg.result === "object" && toolResultMsg.result !== null ? toolResultMsg.result as Record<string, unknown> : null;
            const imageDataUrl = resultObj && typeof resultObj.image === "string" ? resultObj.image as string : null;
            if (imageDataUrl && (tc.name === "read_board" || accumulatedToolCalls.some((t) => t.name === "read_board"))) {
              const match = imageDataUrl.match(/^data:(.+);base64,(.+)$/);
              if (match) {
                const mimeType = match[1].trim();
                const base64 = match[2];
                currentMessages.push({
                  role: "user",
                  content: [
                    { type: "text" as const, content: "Current board state from read_board tool (see image):" },
                    { type: "image" as const, source: { type: "data" as const, value: base64 }, metadata: { mimeType } },
                  ],
                });
              }
            }

            accumulatedText = "";
            accumulatedToolCalls = [];
            break;
          }
        }

        if (accumulatedToolCalls.length === 0) {
          break;
        }
      }

      if (this.aborted) {
        abortController.abort();
        ttsQueue.push(null);
        await ttsDrainer;

        if (fullText.trim().length >= MIN_PARTIAL_LENGTH) {
          this.messages.push({ role: "assistant", content: fullText.trim() });
          this.persistEvent("audio_out", fullText.trim(), { turnIndex: this.turnIndex, interrupted: true });
          this.lastInterruptedText = fullText.trim();
        }
        this.sendStatus("interrupted");
        this.llmStreaming = false;
        this.activeAbortController = null;
        return;
      }

      if (sentenceBuffer.trim()) {
        ttsQueue.push(preprocessForTTS(sentenceBuffer.trim()));
      }
      ttsQueue.push(null);
      await ttsDrainer;

      this.messages.push({ role: "assistant", content: fullText });
      this.sendJson({ type: "llm_complete", text: fullText, ...(turnId ? { turnId } : {}) });
      this.persistEvent("audio_out", fullText, { turnIndex: this.turnIndex });

      this.stripImageMessages();
      await this.maybeCompact(systemPrompt);
    } catch (e) {
      abortController.abort();
      ttsQueue.push(null);
      await ttsDrainer.catch(() => {});

      const reason = e instanceof Error ? e.message : String(e);
      console.error("[VoiceSessionDO] turn error", e);
      this.sendJson({ type: "llm_error", reason, ...(turnId ? { turnId } : {}) });
    } finally {
      this.llmStreaming = false;
      this.activeAbortController = null;
    }
  }

  async webSocketClose(): Promise<void> {
    this.cleanup();
  }

  async webSocketError(): Promise<void> {
    this.cleanup();
  }

  private cleanup(): void {
    this.closed = true;
    this.aborted = true;
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.messageQueue = null;
    this.ws = null;
  }
}
