# Prompt for Cursor: Build a Multimodal Conversation Durable Object

Your task is to generate the complete implementation of a **Cloudflare Durable Object** that acts as a robust, append-only multimodal conversation timeline engine. This Durable Object will serve as the authoritative state for a single conversation, handling text, audio, and (future) video events, along with metadata and summarization/compaction.

The implementation must be clean, modular, production-safe, token-efficient, and extensible.

---

## Core Requirements

### 1. Event-based Architecture

Implement an append-only event system. Each event represents a unit in the conversation timeline.

**Event fields:**

* `id` (string, uuid)
* `timestamp` (int, epoch ms)
* `type` (string: `text_in`, `text_out`, `audio_in`, `audio_out`, `video_frame`, `summary`, `tool_result`, etc)
* `payload` (blob or text)
* `metadata` (JSON string)

Use the Durable Object SQLite (D1-style) as the backend.

### 2. Tables

Create two tables inside the DO:

**events**

```
id TEXT PRIMARY KEY,
timestamp INTEGER,
type TEXT,
payload BLOB,
metadata TEXT
```

**state**

```
key TEXT PRIMARY KEY,
value TEXT
```

`state` will hold pointers: last summary cursor, total tokens, total bytes, etc.

---

## Public API (exposed via fetch router)

### `POST /append`

Append an event to the timeline.
Request body:

```
{
  "type": "text_in" | "audio_in" | ...,
  "payload": string | base64,
  "metadata": object
}
```

### `GET /events?from=<id>&limit=<n>`

Fetch chronological events.

### `POST /summarize`

Trigger compaction.
Implementation notes:

* Load unsummarized events.
* Call a summarization function (mock or placeholder) that produces a condensed text summary.
* Insert a new synthetic `summary` event.
* Delete or mark old events as summarized.
* Update summary cursor in `state`.

### `GET /history`

Returns compacted history: summary events plus any recent non-summarized events.

### `DELETE /conversation`

Deletes all tables and resets DO state.

---

## Compaction Logic

Implement a summarization workflow inside the DO:

1. Load all events since last summary cursor.
2. Combine payloads into a text block or structured representation.
3. Call a summarizer function (stub for now).
4. Create a `summary` event with:

   * `type = "summary"`
   * `payload = summary text`
   * `metadata = { covers: [first_event_id, last_event_id] }`
5. Delete original events or insert a flag marking them summarized.
6. Update summary cursor.

---

## Utilities

Implement helper functions:

* `getState(key)` and `setState(key, value)`
* `encodePayload(event)` and `decodePayload(event)`
* `loadEvents({ from, limit })`
* `getCompactedHistory()`

---

## Video Support (Future-proofing)

Implement placeholders for video event ingestion:

* Store frames as references to R2 or downsampled thumbnails.
* Use payload type `base64` for now.

---

## Additional Requirements

### Code style:

* Typescript, fully typed, modern patterns.
* Modularize logic: separate router, database layer, summarization layer.
* No mutation of events; only append or compact.
* Strong error handling.
* Graceful JSON parsing.

### Non-functional:

* Must run on Cloudflare Workers + Durable Objects.
* Should be simple to extend for embeddings, audio encoders, or tool events.

---

## What Cursor Should Generate

1. A complete Durable Object class implementing all APIs.
2. Routing logic using a fetch handler.
3. SQLite schema initialization.
4. Summarization stub function.
5. Helper utilities.
6. Example `curl` commands for testing.

---

## Acceptance Checklist

Cursor should output code that satisfies:

* Append-only event ingestion.
* Clean summary mechanism.
* Structured event model.
* Proper DO state management.
* JSON-safe fetch API.
* Extensible multimodal design.
