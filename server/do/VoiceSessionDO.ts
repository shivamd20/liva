import { DurableObject } from "cloudflare:workers";
import { LivaAIModel } from "../ai/liva-ai-model";
import { readBoardDef } from "./chat-tools";
import {
  parseClientJson,
  serializeServerJson,
  type ClientToServerJson,
  type ServerToClientJson,
} from "../voice/protocol";
import { runAura2 } from "../voice/tts-adapter";

const VOICE_SYSTEM_PROMPT = `You are a concise voice assistant for someone using a whiteboard. Be brief. Use the read_board tool when you need to see what is on the board.`;

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

const SENTENCE_END = /[.!?]\s+|\n/g;
const TTS_FIRST_CHUNK_TIMEOUT_MS = 10_000;
const MIN_PARTIAL_LENGTH = 5;
const TOKEN_BUDGET = 4000;
const CHARS_PER_TOKEN = 4;

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
  private turnIndex = 0;
  private lastProcessedTurnId: string | null = null;
  private pendingTranscriptFinal: Extract<ClientToServerJson, { type: "transcript_final" }> | null = null;
  private systemPrompt: string | null = null;

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
        [{ role: "user", content: `Summarize this conversation in 2-3 sentences, preserving key facts and decisions:\n\n${conversationText}` }],
        { systemPrompt: "You are a summarizer. Be concise." }
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
      }
    } catch (e) {
      console.error("[VoiceSessionDO] compaction failed (non-fatal)", e);
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

  private sendStatus(value: "thinking" | "synthesizing"): void {
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

  private async runAura2WithTimeout(ms: number, text: string): Promise<ArrayBuffer | null> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TTS first chunk timeout")), ms)
    );
    return Promise.race([runAura2(this.env as any, { text }), timeoutPromise]);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.closed = false;
    this.ws = server;
    this.messageQueue = new AsyncQueue<ClientToServerJson>();

    if (this.messages.length === 0) {
      this.loadSessionFromEvents();
    }

    void this.runProcessorLoop();
    this.sendJson({ type: "state", value: "connected" });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.closed) return;
    if (typeof message !== "string") return;
    const parsed = parseClientJson(message);
    if (!parsed) {
      this.sendJson({ type: "error", reason: "Invalid or unknown message" });
      return;
    }
    this.messageQueue?.push(parsed);
  }

  private async runProcessorLoop(): Promise<void> {
    const queue = this.messageQueue;
    if (!queue) return;
    while (!this.closed && this.messageQueue) {
      const msg = await queue.get();
      if (msg.type === "session.init") {
        this.systemPrompt = msg.systemPrompt;
        continue;
      }
      if (msg.type === "control.mute") continue;
      if (msg.type === "control.interrupt") {
        this.aborted = true;
        continue;
      }
      if (msg.type === "transcript_final") {
        if (!msg.text.trim()) {
          this.sendJson({ type: "error", reason: "transcript_final requires non-empty text" });
          continue;
        }
        if (msg.turnId != null && msg.turnId === this.lastProcessedTurnId) continue;
        if (this.llmStreaming) {
          this.sendJson({ type: "error", reason: "Turn in progress; send control.interrupt first" });
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

  private async runNormalTurn(parsed: Extract<ClientToServerJson, { type: "transcript_final" }>): Promise<void> {
    const turnId = parsed.turnId ?? undefined;
    this.lastProcessedTurnId = parsed.turnId ?? null;
    this.llmStreaming = true;
    this.aborted = false;
    this.turnIndex += 1;

    this.persistEvent("audio_in", parsed.text, { turnIndex: this.turnIndex });
    this.messages.push({ role: "user", content: parsed.text });

    let fullText = "";
    let sentenceBuffer = "";
    let ttsFirstSent = false;
    const queue = this.messageQueue;
    const systemPrompt = this.systemPrompt ?? VOICE_SYSTEM_PROMPT;

    this.sendStatus("thinking");

    try {
      const tools = [readBoardDef];
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
            }
          } else if (chunk.type === "tool_call" && (chunk as any).toolCall) {
            const tc = (chunk as any).toolCall;
            accumulatedToolCalls.push({
              id: tc.id,
              name: tc.name ?? "read_board",
              arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments ?? {}),
            });
            const toolCallId = tc.id ?? tc.name ?? crypto.randomUUID();
            this.sendJson({ type: "tool_request", toolCallId, name: tc.name ?? "read_board", args: tc.arguments });

            let toolResultMsg: Extract<ClientToServerJson, { type: "tool_result" }> | null = null;
            while (queue && !this.closed) {
              const m = await queue.get();
              if (m.type === "control.interrupt") {
                this.aborted = true;
                break outer;
              }
              if (m.type === "transcript_final") {
                this.messages.pop();
                this.pendingTranscriptFinal = m;
                this.llmStreaming = false;
                return;
              }
              if (m.type === "tool_result" && m.toolCallId === toolCallId) {
                toolResultMsg = m;
                break;
              }
            }
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
            // So the model can "see" the board: add a user message with the image (Gemini vision).
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
            break;
          }
        }

        if (accumulatedToolCalls.length === 0) {
          break;
        }
      }

      if (this.aborted) {
        if (fullText.trim().length >= MIN_PARTIAL_LENGTH) {
          this.messages.push({ role: "assistant", content: fullText.trim() });
          this.persistEvent("audio_out", fullText.trim(), { turnIndex: this.turnIndex, interrupted: true });
        }
        this.llmStreaming = false;
        return;
      }

      let match: RegExpExecArray | null = null;
      const re = SENTENCE_END;
      while ((match = re.exec(sentenceBuffer)) !== null) {
        const end = match.index + match[0].length;
        const sentence = sentenceBuffer.slice(0, end).trim();
        sentenceBuffer = sentenceBuffer.slice(end);
        if (sentence) {
          if (!ttsFirstSent) {
            ttsFirstSent = true;
            this.sendStatus("synthesizing");
            const audio = await this.runAura2WithTimeout(TTS_FIRST_CHUNK_TIMEOUT_MS, sentence);
            if (audio && !this.aborted) this.sendBinary(audio);
          } else {
            const audio = await runAura2(this.env as any, { text: sentence });
            if (audio && !this.aborted) this.sendBinary(audio);
          }
        }
      }
      re.lastIndex = 0;

      if (sentenceBuffer.trim() && !this.aborted) {
        const text = sentenceBuffer.trim();
        if (!ttsFirstSent) {
          this.sendStatus("synthesizing");
          const audio = await this.runAura2WithTimeout(TTS_FIRST_CHUNK_TIMEOUT_MS, text);
          if (audio && !this.aborted) this.sendBinary(audio);
        } else {
          const audio = await runAura2(this.env as any, { text });
          if (audio && !this.aborted) this.sendBinary(audio);
        }
      }

      this.messages.push({ role: "assistant", content: fullText });
      this.sendJson({ type: "llm_complete", text: fullText, ...(turnId ? { turnId } : {}) });
      this.persistEvent("audio_out", fullText, { turnIndex: this.turnIndex });

      this.stripImageMessages();
      await this.maybeCompact(systemPrompt);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error("[VoiceSessionDO] turn error", e);
      this.sendJson({ type: "llm_error", reason, ...(turnId ? { turnId } : {}) });
    } finally {
      this.llmStreaming = false;
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
    this.messageQueue = null;
    this.ws = null;
  }
}
