# Monorail: Option 2: Audio + Video + Screen Capture  (High-Level Design)

## Goal

Build a **low-cost, scalable, per-session recording system** for audio, camera video, screen capture, and canvas-based visuals for tools like Monorail. The system must support long-running sessions, minimal idle cost, client-side compositing, and async processing 

Primary objectives:

* Order-of-magnitude lower cost than Stream
* No always-on live infrastructure
* Unified capture of audio + video + screen + canvas
* Durable, resumable uploads
* Clean path to post-processing and AI workflows

---

## Core Idea

Do **client-side media capture and compositing** using browser-native APIs. All tracks (audio, camera, screen, pointer, whiteboard) are **composed client-side** using `OffscreenCanvas` and uploaded as **time-sliced chunks** to object storage (R2).

Treat recordings as **data artifacts**, not live media streams.

No live ingest. No WHIP. No Stream control plane.

---

## High-Level Architecture

### Components

1. **Browser Client**

   * Captures microphone audio
   * Captures camera video (optional)
   * Captures screen or tab
   * Composites everything into a single media stream
   * Chunks and uploads media periodically

2. **Session Coordinator (Durable Object)**

   * Owns session lifecycle
   * Issues signed upload URLs
   * Tracks uploaded chunks per track or composite
   * Handles finalization and idempotency

3. **Object Storage (R2)**

   * Stores raw media chunks (audio/video)
   * Cheap, durable, scalable

4. **Processing Pipeline (Async)**

   * Stitch chunks
   * Remux / transcode
   * Generate final playback artifacts
   * Feed into transcription, summarization, indexing

---

## Client-Side Capture

### Media Sources

* **Audio**: `getUserMedia({ audio: true })`
* **Camera Video**: `getUserMedia({ video: true })`
* **Screen / Tab**: `getDisplayMedia()`

### Composition Strategy

* All visual sources are drawn into a **single OffscreenCanvas**
* Canvas output captured via `canvas.captureMediaStream()`
* Audio track merged via `MediaStream`

Result: **one composite MediaStream** that represents the full session state.

### Recording

* Use `MediaRecorder` on the composite stream
* Preferred format: `video/webm; codecs=vp9,opus` or `vp8,opus`
* Chunk interval: 2–10 seconds (tunable)

Each chunk is independent and resumable.

Failure loses seconds, not sessions.

---

## Upload Flow

1. Client requests `POST /session/{id}/upload-url`
2. Durable Object validates session and chunk index
3. DO generates **signed R2 PUT URL**
4. Client uploads chunk directly to R2
5. Client notifies DO of successful upload

No audio or video flows through Workers.

---

## Session State (Durable Object)

Stored metadata only:

* sessionId
* startTime
* mediaLayout (audio, camera, screen)
* chunkIndex counter
* list of uploaded chunk keys
* timing metadata
* session status (active, finalizing, done)

No binary media stored in Durable Object storage.

---

## Storage Layout (R2)

```
/media-sessions/
  {sessionId}/
    chunk-0001.webm
    chunk-0002.webm
    chunk-0003.webm
    metadata.json
```

/audio-sessions/
{sessionId}/
chunk-0001.webm
chunk-0002.webm
chunk-0003.webm
metadata.json

```

Optimized for parallel access and cleanup.

---

## Session Finalization

Triggered by:

- user clicks Stop
- idle timeout
- tab close (best-effort)

Flow:

1. Client calls `POST /session/{id}/finalize`
2. DO marks session immutable
3. Async job scheduled for processing

---

## Media Processing Pipeline

### Steps

1. Fetch chunks from R2
2. Validate ordering and continuity
3. Remux or stitch into single timeline
4. Optional transcoding (MP4 for playback)
5. Generate derivatives (audio-only, thumbnails, previews)

Processing options:

- Workers + WASM FFmpeg (short sessions)
- External worker / batch job (long sessions)

---

## Cost Characteristics

### What You Pay For

- R2 storage (cheap)
- R2 operations
- Workers CPU (light)

### What You Avoid

- Live ingest minutes
- Idle streaming cost
- Stream recording multipliers

Cost scales with **actual data**, not wall-clock time.

---

## Resilience & Failure Handling

Resilience is achieved by assuming **everything can fail independently**: browser, network, tab lifecycle, uploads, processing. The system is designed so failures degrade output quality, not destroy sessions.

### Client-Side Resilience

**Chunked recording (primary defense)**
- Small chunks (2–10s) limit blast radius
- Each chunk is independently uploadable
- Recorder restart does not invalidate previous data

**Local write-ahead buffer**
- Keep last N chunks in memory (or IndexedDB if needed)
- Retry uploads with backoff on transient failures
- Never block recording on upload success

**Monotonic chunk indexing**
- Chunk index increments locally
- Gaps are allowed and detectable
- Late uploads accepted if index unused

**Heartbeat + liveness**
- Client sends periodic heartbeat to DO
- Missed heartbeats imply tab crash or network loss
- DO can auto-finalize after grace period

---

### Network & Upload Resilience

**Signed URL retry model**
- Signed PUT URLs are short-lived
- Client requests new URL on 403/expiry
- Uploads are idempotent per chunk key

**At-least-once semantics**
- Duplicate chunk uploads overwrite same object key
- DO treats upload confirmation as idempotent

**Backpressure handling**
- If uploads lag, client can:
  - increase chunk duration
  - temporarily reduce frame rate
  - drop non-critical overlays

---

### Durable Object Resilience

**Single-writer authority**
- One DO per session ensures consistent ordering
- All state transitions are serialized

**Idempotent APIs**
- `upload-url`, `confirm-upload`, `finalize` are safe to retry
- DO checks session status before mutating state

**Soft finalization**
- Session can be finalized multiple times
- First finalize wins, others are no-ops

---

### Storage-Level Resilience (R2)

**Immutable chunk objects**
- Once written, chunks are never modified
- Prevents corruption from partial writes

**Continuity validation**
- Processing pipeline detects:
  - missing chunks
  - out-of-order chunks
  - timestamp drift

**Partial output tolerance**
- Processing proceeds even with gaps
- Final media contains skips instead of failure

---

### Processing Pipeline Resilience

**Two-phase processing**
1. Validation phase (cheap)
2. Stitching/transcoding phase (expensive)

**Checkpointing**
- Intermediate artifacts stored in R2
- Processing can resume after crash

**Timeout isolation**
- Long sessions routed to batch workers
- Short sessions handled inline

---

### Catastrophic Scenarios (Handled Explicitly)

- **Tab crash**: last few seconds lost, session finalizes
- **Network loss**: chunks queue locally, upload later
- **Permission revoked**: recording stops, session finalizes
- **Client freeze**: heartbeat timeout triggers finalize

---

### What This Architecture Guarantees

- No single failure deletes a session
- Worst case: partial recording, not total loss
- Costs remain bounded even under failure
- System recovers without human intervention

---

## Security Model

- Signed URLs with short TTL
- Session-bound permissions
- No public write access
- No long-lived credentials on client

---

## Trade-offs (Explicit)

### Pros

- Massive cost reduction
- Simple mental model
- Scales with usage
- Works for long sessions

### Cons

- No true live playback
- Slight client complexity
- Async processing latency

---

## When to Add Live Media Later

If you later need live observers:

- Add optional WebRTC SFU
- Keep this pipeline as default

Do not regress to Stream-first.

---

## Summary

This design treats **audio, video, screen, and canvas output as a single composited data artifact**, captured client-side and uploaded cheaply in chunks. OffscreenCanvas gives full control over visuals without live infra cost.

It aligns with developer-tool economics, supports long sessions, and avoids Cloudflare Stream entirely.

This is the architecture you use when you want power, control, and predictable bills.

```
