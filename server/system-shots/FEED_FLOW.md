# System Shots Feed Architecture

This document details the end-to-end flow of the System Shots feed, including streaming, generation, deduplication, and the specific logic for reel surfacing and pagination.

## 1. High-Level Architecture

The feed is built on an **infinite streaming architecture** using Server-Sent Events (SSE). It is designed to be offline-capable (future-proof) and deterministic.

**Core Components:**
- **Client (`useReelsFeed`)**: Manages stream consumption, buffering, and focus state.
- **Worker (`server/index.ts`)**: Routes `/api/system-shots/reels/stream` to the user's specific `LearningMemoryDO`.
- **Durable Object (`LearningMemoryDO`)**: The "Brain". Maintains the reel database, event log, and topic state.
- **LLM Generator (`generate.ts`)**: Statelessly generates batches of reels on demand.

---

## 2. Streaming Protocol

**Endpoint:** `GET /api/system-shots/reels/stream`

**Headers:** `Accept: text/event-stream`

**Query Parameters:**
- `cursor` (optional): The ID of the last reel received. If omitted, starts a fresh session (initial load).
- `focus` (optional): `conceptId` to filter the feed for Focus Mode.
- `excludeIds` (optional): Comma-separated list of reel IDs to **never** return (e.g., currently visible reels or recently consumed ones).

**Response:**
A stream of JSON events:
```json
{ "type": "content", "content": "{\"id\": \"...\", ...}" }
{ "type": "content", "content": "{\"id\": \"...\", ...}" }
{ "type": "done", "finishReason": "stop" }
```

---

## 3. Feed Logic & Lifecycle

### 3.1. Initialization & Buffering
When a stream request arrives (especially without a cursor), the DO checks its **Fresh Reel Buffer**:

1.  **Count Fresh Reels**: Checks how many reels are `consumed_at IS NULL` AND (`skipped_at IS NULL` OR past cooldown).
2.  **Ensure Buffer**: If the count is below `BUFFER_THRESHOLD` (e.g., 5), it triggers a generation cycle.
    - **Context Assembly**: Gathers `TopicState` (mastery, failure streaks), skip counts, and recent problem IDs.
    - **LLM Call**: Calls `generateReelsStream` / `generateReelsBatch` to create `BUFFER_REFILL_COUNT` (e.g., 10) new reels.
    - **Persistence**: Newly generated reels are saved to SQLite.

### 3.2. Pagination & Ordering (The "Smart Cursor")
The feed does **not** widely randomize. It follows a strict priority queue to ensure high-priority items (like skipped reels) are seen first.

**Ordering Logic:**
1.  **Skipped Reels First**: Reels with `skipped_at != NULL` are prioritized.
    - Ordered by `skipped_at` (oldest skip first).
2.  **Fresh Reels Second**:
    - Ordered by `created_at` (ascending/FIFO).
    - Tie-breaker: `id`.

**Cursor Handling**:
The cursor is the `id` of the last reel.
- When `cursor` is provided, the DO finds that reel's sort orders (`skipped_at`, `created_at`) and queries for items **after** that point in the 4-tuple sort key:
  `(is_skipped, skipped_at, created_at, id)`

### 3.3. Deduplication Strategy
To prevent the LLM from generating duplicates (which wastes user time), we implement **Content-Based Deduplication**:

- **Detection**: Before inserting a generated reel, we check for an existing reel with the same:
  - `concept_id`
  - `prompt` (exact match)
  - `options` (exact JSON match)
  - `correct_index`
- **Resolution (`persistOrGetReel`)**:
  - If a duplicate exists, we **discard the new generation** and reuse the existing reel ID.
  - **Crucially**: We check if the existing reel was skipped recently. If it was skipped within `SKIP_COOLDOWN_MS`, we **do not yield it** in the current stream, effectively "hiding" the duplicate until it's ready to resurface.

### 3.4. Resurfacing Rules (Skipped Reels)
When a user skips a reel, we don't want to show it again immediately, but we don't want to lose it forever.

- **Action**: `submitAnswer({ skipped: true })` sets `skipped_at = NOW` and increments `skip_count`.
- **Cooldown**: `SKIP_COOLDOWN_MS` = **3 Days**.
- **Query Filter**: The feed query filters for:
  `skipped_at IS NULL OR skipped_at <= (NOW - 3 days)`
- **Priority**: Once a skipped reel "matures" (passes 3 days), it immediately jumps to the **front of the queue** (because of the "Skipped Reels First" ordering).

---

## 4. Focus Mode
Focus Mode forces the feed to allow only a specific concept.

- **Activation**: Client passes `focus=concept-id`.
- **Generation**: `ensureBuffer` is scoped to *only* generate reels for that concept.
- **Querying**: The main SQL query adds `AND concept_id = ?`.
- **Adaptive Difficulty**: The DO tracks a separate `FocusState` (performance trend, target difficulty) to adjust the difficulty of generated reels dynamically (1 → 2 → 3) based on recent pass/fail rates.

---

## 5. Edge Cases & Robustness

- **Empty Stream**: If the DB is empty and generation fails (or yields 0 valid reels due to excludes), the stream yields 0 items. The client (`useReelsFeed`) handles this by retrying or showing a "caught up" state.
- **Cursor Invalid**: If a cursor ID is not found (e.g., deleted), the feed falls back to the **start** of the queue (first page) to recover gracefully.
- **Client Disconnect**: The stream is read-only using `toServerSentEventsStream` (which handles backpressure, though DO cancellation on disconnect is platform-dependent).
- **Race/Duplicate Calls**: The client hook (`useReelsFeed`) uses a `generationRef` and `loadingSegmentsRef` to strictly prevent parallel fetches for the same segment, ensuring exactly-once stream consumption per scroll event.
