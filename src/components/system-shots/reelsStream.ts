import type { ApiReel } from "./types"
import { authFetch } from "@/lib/auth-fetch"

/** Request timeout (fetch) in ms. */
const REQUEST_TIMEOUT_MS = 90_000
/** Read timeout (no chunk received) in ms. */
const READ_TIMEOUT_MS = 45_000

/**
 * Consume an SSE stream of reels.
 * Request is aborted after REQUEST_TIMEOUT_MS; stream read is aborted if no chunk for READ_TIMEOUT_MS.
 *
 * Single failure contract: every failure path calls onError exactly once then returns (or throws).
 * Failure paths: fetch throws (network/timeout), !res.ok, no body, reader.read() throws (e.g. read timeout),
 * and server-sent error chunk. User abort (signal) exits without onError. Success: stream ends or [DONE].
 *
 * @param url - The stream URL
 * @param onReel - Callback for each reel received
 * @param onError - Callback for errors (called exactly once on any failure)
 * @param signal - Optional AbortSignal for cancellation
 */
export async function consumeReelsStream(
  url: string,
  onReel: (reel: ApiReel) => void,
  onError: (err: string) => void,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) return

  const controller = new AbortController()
  const userAbort = () => controller.abort()
  if (signal) signal.addEventListener("abort", userAbort)

  const requestTimeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await authFetch(url, { signal: controller.signal })
  } catch (err: unknown) {
    clearTimeout(requestTimeoutId)
    if (signal) signal.removeEventListener("abort", userAbort)
    const isAbort = (err as Error)?.name === "AbortError"
    onError(isAbort && signal?.aborted ? "Request aborted" : isAbort ? "Request timed out" : `Network error: ${(err as Error)?.message ?? "unknown"}`)
    return
  }
  clearTimeout(requestTimeoutId)
  if (signal) signal.removeEventListener("abort", userAbort)

  if (signal?.aborted) return

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
  let readTimeoutId: ReturnType<typeof setTimeout> | null = null

  const clearReadTimeout = () => {
    if (readTimeoutId !== null) {
      clearTimeout(readTimeoutId)
      readTimeoutId = null
    }
  }
  const scheduleReadTimeout = () => {
    clearReadTimeout()
    readTimeoutId = setTimeout(() => {
      readTimeoutId = null
      reader.cancel()
    }, READ_TIMEOUT_MS)
  }

  try {
    scheduleReadTimeout()
    while (true) {
      if (signal?.aborted) {
        clearReadTimeout()
        return
      }

      let result: ReadableStreamReadResult<Uint8Array>
      try {
        result = await reader.read()
      } catch (readErr: unknown) {
        clearReadTimeout()
        const isAbort = (readErr as Error)?.name === "AbortError"
        onError(isAbort ? "Stream timed out" : `Stream read error: ${(readErr as Error)?.message ?? "unknown"}`)
        return
      }

      clearReadTimeout()
      const { done, value } = result
      if (done) break

      scheduleReadTimeout()
      buffer += decoder.decode(value, { stream: true })
      // console.log(`[reelsStream] read chunk: ${value.length} bytes, buffer len: ${buffer.length}`)
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
            clearReadTimeout()
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
    clearReadTimeout()
    reader.releaseLock()
  }
}
