# Liva Audio Recorder — HLD + LLD

This document defines a **self‑contained, Excalidraw‑coupled recording library** intended to be embedded alongside an Excalidraw board.

It is designed as a **library‑like module**: minimal API surface, no UI opinions, and strong lifecycle guarantees.

Scope: **Audio + Excalidraw board events + pointer events**. No video rendering, no evaluation logic.

---

## 1. Design Goals

• Drop‑in library • Explicit coupling to Excalidraw instance • Passive recording (auto‑start) • Single permission prompt • No pause • Optional mute / unmute • Audio + board + pointer capture • Event‑based, not frame‑based • Timestamped on a single monotonic clock • Resilient to re‑renders and resize • Independent of React lifecycle • Deterministic replay • R2‑backed raw logs

---

## 2. High Level Architecture (HLD)

### 2.1 Core Components

1. **RecordingSessionController**
2. **MicCaptureEngine**
3. **ExcalidrawEventRecorder**
4. **PointerEventRecorder**
5. **EventBuffer**
6. **UploadPipeline**
7. **R2 Storage**
8. **ReplayEngine (logical)**

Each component is isolated, stateless where possible, and coordinated only via the session controller.

---

### 2.2 Lifecycle Overview

1. Library is initialized with Excalidraw API reference
2. Session controller creates `sessionId` and `t0`
3. Mic permission requested once
4. Audio recording auto‑starts
5. Excalidraw change events are subscribed
6. Pointer events are subscribed
7. Audio, board, and pointer events are timestamped
8. Events buffered locally
9. Buffered events uploaded asynchronously to R2
10. Session finalized and manifest written

---

## 3. Low Level Design (LLD)

### 3.1 RecordingSessionController

**Responsibility** • Owns full recording lifecycle • Generates `sessionId` • Owns monotonic session clock (`t0`) • Starts and stops all sub‑recorders

**State**

```
RecordingSession {
  sessionId
  startTime
  muted: boolean
  status: active | stopped
}
```

**Public API**

```
init(excalidrawAPI)
start()
stop()
mute()
unmute()
getSessionId()
```

Rules: • init() must be called once • start() is idempotent • stop() is terminal

---

### 3.2 MicCaptureEngine

(unchanged from previous version)

---

### 3.3 ExcalidrawEventRecorder

**Responsibility** • Capture semantic board mutations • Avoid full state snapshots per frame

**Input** • Excalidraw imperative API reference • `onChange(elements, appState, files)` callback

**Recorded Event Model**

```
BoardEvent {
  t: number
  type: add | update | delete
  elements: ExcalidrawElement[]
  appStateMinimal
}
```

**Rules** • Record only on Excalidraw change callbacks • Never record on React re‑render • Elements recorded are post‑normalization

---

### 3.4 PointerEventRecorder

**Responsibility** • Capture pointer position and tool usage

**Input** • Pointer events emitted by Excalidraw

**Event Model**

```
PointerEvent {
  t: number
  x: number
  y: number
  tool
  buttons
}
```

• Throttled to ~30Hz max

---

### 3.5 EventBuffer

**Responsibility** • Buffer heterogeneous event streams • Preserve ordering by timestamp

**Streams** • audio • board • pointer

Append‑only, flushed independently.

---

### 3.6 UploadPipeline

**Responsibility** • Upload raw event logs and audio chunks • Never block recording

**Storage Layout**

```
/recordings/{sessionId}/
  ├── audio/chunk_XXX.webm
  ├── board/events.jsonl
  ├── pointer/events.jsonl
  └── manifest.json
```

---

### 3.7 Manifest

```
manifest.json {
  sessionId
  startedAt
  endedAt
  audioChunks
  boardEventCount
  pointerEventCount
  status
}
```

---

### 3.2 MicCaptureEngine

**Responsibility** • Capture raw microphone audio • Encode audio using MediaRecorder • Emit audio chunks

**Implementation** • `navigator.mediaDevices.getUserMedia({ audio: true })` • `MediaRecorder` with codec `audio/webm;codecs=opus`

**Configuration** • Chunk duration: 2–5 seconds

**Behavior** • Starts immediately after permission • Emits `AudioChunk` events • Continues running across UI re‑renders

**Failure Handling** • Permission denied → emit silent chunks + error flag • MediaRecorder crash → restart once

---

### 3.3 AudioChunk Model

```
AudioChunk {
  sessionId
  chunkId
  startOffsetMs
  durationMs
  blob
}
```

• `startOffsetMs` = `performance.now() - sessionStartTime` • No reliance on wall clock

---

### 3.4 ChunkBuffer

**Responsibility** • Temporarily store chunks • Decouple recording from upload

**Implementation Options** • In‑memory queue • IndexedDB fallback

**Behavior** • Append‑only • Ordered by chunkId • Flushes when size threshold reached

---

### 3.5 UploadPipeline

**Responsibility** • Upload chunks to R2 • Retry on failure • Maintain ordering

**Upload Path**

```
/recordings/{sessionId}/audio/chunk_{chunkId}.webm
```

**Rules** • Upload is async and non‑blocking • Recording must never wait on upload • Retries with exponential backoff

---

### 3.6 Manifest File

Generated on session stop.

```
manifest.json {
  sessionId
  startedAt
  endedAt
  chunkCount
  codec
  status: complete | incomplete
}
```

Stored at:

```
/recordings/{sessionId}/manifest.json
```

---

## 4. Replay Engine (Logical)

### 4.1 Responsibilities

• Load raw event logs • Reconstruct Excalidraw state deterministically • Stream audio chunks • Provide time‑indexed replay primitives

Replay does **not** require video generation.

---

### 4.2 Playback Strategy

**Sequential streaming** • Fetch chunk 0 • Decode and play • Pre‑fetch next chunk • Continue until end

**Sync Model** • Playback driven by chunk order • Optional timestamp validation

---

### 4.3 Playback API

```
play(sessionId)
stop()
seek(offsetMs)
```

Seek loads nearest chunk.

---

## 5. R2 Storage Layout

```
/recordings/{sessionId}/
  ├── audio/
  │   ├── chunk_000.webm
  │   ├── chunk_001.webm
  ├── board/events.jsonl
  ├── pointer/events.jsonl
  └── manifest.json
```

All files are append‑only until session finalization.

---

## 6. Resilience Guarantees

• UI re‑renders do not affect recording • Window resize has no effect • Temporary network loss tolerated • Page refresh marks session incomplete

---

## 7. Security & Privacy

• Explicit browser permission • No background recording • No camera access • Clear session boundaries

---

## 8. MVP Exit Criteria

The coupled recording library is complete when: • Audio records passively • Excalidraw board changes are captured semantically • Pointer movement is captured • All streams share a single timeline • Raw data uploads to R2 reliably • A replay engine can reconstruct the session

End of document.
