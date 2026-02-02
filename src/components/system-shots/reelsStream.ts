import type { ApiReel } from "./types"
import { authFetch } from "@/lib/auth-fetch"

/**
 * Consume an SSE stream of reels.
 * 
 * Each event is "data: {JSON}\n\n". Content chunks have type 'content'
 * and delta/content = stringified reel.
 * 
 * @param url - The stream URL
 * @param onReel - Callback for each reel received
 * @param onError - Callback for errors
 * @param signal - Optional AbortSignal for cancellation
 */
export async function consumeReelsStream(
  url: string,
  onReel: (reel: ApiReel) => void,
  onError: (err: string) => void,
  signal?: AbortSignal
): Promise<void> {
  // Check if already aborted
  if (signal?.aborted) {
    console.log(`[reelsStream] Request aborted before start`)
    return
  }

  // Use authFetch to wait for session and retry on 401
  // Pass the abort signal to the fetch request
  const res = await authFetch(url, { signal })

  // Check abort after fetch
  if (signal?.aborted) {
    console.log(`[reelsStream] Request aborted after fetch`)
    return
  }

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
      // Check abort signal before each read
      if (signal?.aborted) {
        console.log(`[reelsStream] Stream aborted during read`)
        return
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""

      for (const part of parts) {
        // Check abort between processing events
        if (signal?.aborted) {
          console.log(`[reelsStream] Stream aborted during processing`)
          return
        }

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
