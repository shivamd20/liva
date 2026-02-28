/**
 * TTS adapter: Workers AI @cf/deepgram/aura-2-en.
 * Supports AbortSignal for cancellation during interrupt.
 * Voice selection: luna (default), asteria, stella, athena, hera, orion, arcas, perseus, angus, orpheus, helios, zeus
 */

const AURA2_MODEL = "@cf/deepgram/aura-2-en";
const TTS_TIMEOUT_MS = 30_000;
const TTS_RETRY_MAX = 3;
const TTS_RETRY_BASE_MS = 300;
const TTS_RETRY_MAX_MS = 3000;

export const AVAILABLE_VOICES = [
  "luna", "asteria", "stella", "athena", "hera",
  "orion", "arcas", "perseus", "angus", "orpheus", "helios", "zeus",
] as const;
export type Aura2Voice = typeof AVAILABLE_VOICES[number];

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

/**
 * Improves TTS prosody by adding punctuation cues that Aura-2 uses for
 * pause timing, emphasis, and intonation.
 */
export function formatForProsody(text: string): string {
  return text
    .replace(/\b(Sure|Got it|Right|Okay|Alright)\s/g, "$1, ")
    .replace(/\s*—\s*/g, " — ")
    .replace(/([.!?])\s*$/, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface Aura2Options {
  text: string;
  speaker?: Aura2Voice | string;
}

async function runAura2Once(
  env: { AI: { run: (model: string, input: unknown) => Promise<unknown> } },
  text: string,
  speaker: string,
  signal?: AbortSignal
): Promise<ArrayBuffer | null> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const result = await Promise.race([
    env.AI.run(AURA2_MODEL, { text: text.trim(), speaker }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TTS timed out")), TTS_TIMEOUT_MS)
    ),
    ...(signal ? [new Promise<never>((_, reject) => {
      if (signal.aborted) reject(new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })] : []),
  ]);
  if (result && typeof (result as any).arrayBuffer === "function") {
    return await (result as Response).arrayBuffer();
  }
  if (result && typeof (result as any).audio === "string") {
    const binaryString = atob((result as { audio: string }).audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
  }
  if (result && typeof (result as any).getReader === "function") {
    const stream = result as ReadableStream<Uint8Array>;
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value), (total += value.length);
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) out.set(c, off), (off += c.length);
    return out.buffer;
  }
  if (result && typeof (result as any).body === "object" && (result as Response).body != null) {
    return await new Response((result as Response).body).arrayBuffer();
  }
  return null;
}

export async function runAura2(
  env: { AI: { run: (model: string, input: unknown) => Promise<unknown> } },
  options: Aura2Options,
  signal?: AbortSignal
): Promise<ArrayBuffer | null> {
  const { text, speaker = "luna" } = options;
  if (!text?.trim()) return null;
  const formattedText = formatForProsody(text.trim());
  for (let attempt = 0; attempt < TTS_RETRY_MAX; attempt++) {
    try {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const out = await runAura2Once(env, formattedText, speaker, signal);
      return out;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      console.error("[TTS] Aura-2 error (attempt " + (attempt + 1) + ")", e);
      if (attempt < TTS_RETRY_MAX - 1) {
        const backoff = Math.min(TTS_RETRY_BASE_MS * Math.pow(2, attempt), TTS_RETRY_MAX_MS);
        await delay(backoff, signal);
      } else {
        return null;
      }
    }
  }
  return null;
}
