import type { ApiReel } from "./types"

// #region agent log
const DEBUG_LOG = (loc: string, msg: string, data: Record<string, unknown>, hyp: string) => {
  fetch('http://127.0.0.1:7242/ingest/eb26fd3f-def7-4467-b4e3-673c03fa8800',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:loc,message:msg,data,timestamp:Date.now(),sessionId:'debug-session',hypothesisId:hyp})}).catch(()=>{});
};
// #endregion

/** Parse SSE stream: each event is "data: {JSON}\n\n". Content chunks have type 'content' and delta/content = stringified reel. */
export async function consumeReelsStream(
  url: string,
  onReel: (reel: ApiReel) => void,
  onError: (err: string) => void
): Promise<void> {
  // #region agent log
  DEBUG_LOG('reelsStream.ts:consumeReelsStream', 'Stream fetch starting', { url }, 'H1');
  // #endregion
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) {
    onError(res.status === 401 ? "Unauthorized" : `Failed to load reels: ${res.status}`)
    return
  }
  const reader = res.body?.getReader()
  if (!reader) {
    onError("No response body")
    return
  }
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith("data: ")) continue
        const payload = line.slice(6)
        if (payload === "[DONE]") return
        try {
          const chunk = JSON.parse(payload) as {
            type?: string
            delta?: string
            content?: string
            error?: { message?: string }
          }
          if (chunk.type === "error" || chunk.error) {
            onError(chunk.error?.message ?? "Stream error")
            return
          }
          if (chunk.type === "content") {
            const raw = chunk.delta ?? chunk.content ?? ""
            const reel = JSON.parse(raw) as ApiReel
            if (reel?.id && reel?.prompt) onReel(reel)
          }
        } catch {
          // skip malformed
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
