# System Shots – Server Module

High-level design, schema, workflows, and component reference for the **System Shots** learning engine (system design reels). This module is the server-side core for concept canon, reel generation, tRPC API, and shared types. Stateful behavior lives in **LearningMemoryDO**; this directory is the single source of truth for ontology, generation prompts, and API surface.

---

## Table of Contents

1. [Overview](#1-overview)
2. [High-Level Design (HLD)](#2-high-level-design-hld)
3. [Schema](#3-schema)
4. [Workflows](#4-workflows)
5. [Components & Files](#5-components--files)
6. [API (tRPC)](#6-api-trpc)
7. [Config / env](#7-config--env)
8. [References](#8-references)

---

## 1. Overview

**System Shots** is a high-signal learning system for senior engineers: short, repeated interactions (reels) that probe **one primary concept** per reel. It is **not** interview hack prep or social media; it is memory shaping, concept reinforcement, and failure-driven learning.

**Constraints (non-negotiable):**

- Offline-first capable
- Deterministic evaluation only (no live AI in the loop)
- Session length ~3 minutes; infinite vertical feed
- Apple-level UX; ruthless scope discipline

This `server/system-shots` directory provides:

- **Locked v2 ontology**: `ConceptV2`, tracks, signals, concept canon in `concepts.ts`
- **Reel generation**: LLM-powered MCQ generation in `generate.ts` (interview-grade, tradeoff/failure focused)
- **Shared types**: Reels, concepts, events, progress, mastery in `types.ts`
- **Feed**: SSE-only via `GET /api/system-shots/reels/stream` (Worker → LearningMemoryDO `/stream` → `streamReels`). See [FEED_FLOW.md](./FEED_FLOW.md) for the streaming protocol and lifecycle.
- **tRPC router**: `submitAnswer`, `getProgress`, `getAvailableTopics` in `router.ts` (no feed procedures; feed is SSE-only)

Stateful storage, event log, topic state, and stream logic live in **LearningMemoryDO** (`server/do/LearningMemoryDO.ts`), which imports from this module.

---

## 2. High-Level Design (HLD)

### 2.1 Architecture Principles

| Principle | Meaning |
|-----------|--------|
| **Event sourcing** | Answers, skips, and reel-shown are stored as events; topic state and mastery are derived. |
| **Edge-first** | Worker + Durable Object on Cloudflare; no separate app server. |
| **Stateless UI** | UI consumes tRPC; all session state is in the DO or derived from events. |
| **Deterministic compute** | Same event log ⇒ same feed order and progress. No runtime AI evaluation. |

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client (React)                                  │
│  Feed: GET /api/system-shots/reels/stream (SSE)  │  tRPC: submitAnswer,     │
│  useReelsFeed + reelsStream.ts                   │  getProgress,            │
│                                                  │  getAvailableTopics      │
└───────────────────────┬─────────────────────────┬───────────────────────────┘
                        │ SSE                     │ tRPC
                        ▼                         ▼
        ┌───────────────────────────┐   ┌─────────────────────────────────────┐
        │ Worker (server/index.ts)  │   │ router.ts (systemShotsRouter)        │
        │ Auth → DO idFromName(userId)   │ submitAnswer, getProgress,           │
        │ path /stream              │   │ getAvailableTopics → DO or CONCEPT_V2│
        └─────────────┬─────────────┘   └─────────────────┬───────────────────┘
                      │                                   │
                      ▼                                   ▼
        ┌─────────────────────────────────────────────────────────────────────┐
        │ LearningMemoryDO (server/do/LearningMemoryDO.ts)                    │
        │ fetch() /stream → streamReels() → generateReelsStream, persistOrGetReel│
        │ submitAnswer(), getProgress()                                        │
        └─────────────────────────────┬───────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌──────────────────┐       ┌─────────────────────┐     ┌──────────────────┐
│ concepts.ts      │       │ generate.ts          │     │ types.ts          │
│ CONCEPT_V2,      │       │ generateReelsStream │     │ Reel, ConceptV2,  │
│ getConceptSeed   │       │ (LLM, Zod parse)     │     │ Progress, events  │
└──────────────────┘       └─────────────────────┘     └──────────────────┘
```

### 2.3 End-to-End Data Flow

- **Feed:** Browser → Worker (auth) → LearningMemoryDO `/stream` → `streamReels()` → `generateReelsStream()` + `persistOrGetReel()` → SSE chunks → client `reelsStream.ts` + `useReelsFeed` → SystemShotsPage renders reels.
- **Actions:** Browser → tRPC → router → LearningMemoryDO (`submitAnswer`, `getProgress`) or CONCEPT_V2 (`getAvailableTopics`).
- **No** getReels, getNextReel, or mock branch in the current flow.

### 2.4 Responsibilities Summary

| Component | Responsibility |
|-----------|----------------|
| **types.ts** | Shared TypeScript types: `Reel`, `ConceptV2`, `Track`, `Signal`, event payloads, `ProgressItem`, `Mastery`. |
| **concepts.ts** | Frozen v2 concept canon (`CONCEPT_V2`), practice problems (`PRACTICE_PROBLEMS_V1`), seed rows for DB, concept→signals map, adaptive problem ordering. |
| **generate.ts** | `generateReelsBatch(env, topicState, concepts, count)`: one LLM call, Zod-validated JSON, returns array of reels (MCQ only in V1). |
| **router.ts** | tRPC procedures: submitAnswer, getProgress, getAvailableTopics; delegates to LearningMemoryDO or CONCEPT_V2. |
| **LearningMemoryDO** | Event log, reels table, topic_state, concepts seed; **feed** via `streamReels()` → `generateReelsStream()` + `persistOrGetReel()`; submitAnswer, getProgress. |

---

## 3. Schema

### 3.1 Locked v2 Ontology (ConceptV2)

Defined in `types.ts`; canonical data in `concepts.ts`. **No further fields; no renaming.**

```ts
interface ConceptV2 {
  id: string;
  name: string;
  type: ConceptType;           // "principle" | "primitive" | "pattern" | "system"
  track: Track;                // e.g. "foundations" | "distributed-systems" | "storage" | ...
  difficulty_hint: "intro" | "core" | "advanced";
  requires_tags: string[];    // prerequisite concept IDs
  related_tags: string[];
  signals: Signal[];          // for feed/mastery: tradeoff_reasoning, failure_mode_awareness, ...
  typical_questions: string[];
}
```

**ConceptType:** `principle` | `primitive` | `pattern` | `system`  
**Track:** `foundations` | `distributed-systems` | `storage` | `messaging-streaming` | `scalability` | `reliability` | `latency-performance` | `data-modeling` | `system-archetypes` | `deployment-environments` | `operability` | `security`  
**Signal:** `tradeoff_reasoning` | `failure_mode_awareness` | `scalability_instinct` | `latency_reasoning` | `consistency_reasoning` | `cost_reasoning` | `operability_awareness` | `interview_structuring` | `security_awareness`

### 3.2 Reel (API/DB shape)

```ts
interface Reel {
  id: string;
  conceptId: string;
  type: ReelType;             // "mcq" | "flash" | "binary" | "ordering" | "free_text" | "voice"
  prompt: string;
  options: string[] | null;    // MCQ: length 4
  correctIndex: number | null;
  explanation: string;
  difficulty: number;          // 1 | 2 | 3
  createdAt?: number;
  consumedAt?: number | null;
}
```

V1 generation produces **MCQ only**; other types are reserved for future use.

### 3.3 Event Types (event-sourced)

| Event type | Payload | When |
|------------|---------|------|
| `reel_generated` | `ReelGeneratedPayload` (reelId, conceptId, type, createdAt) | When a batch is generated and persisted. |
| `reel_shown` | `ReelShownPayload` (reelId, conceptId, shownAt) | When a reel is yielded to the client (e.g. in stream). |
| `answer_submitted` | `AnswerSubmittedPayload` (reelId, conceptId, selectedIndex, correct, skipped?, timestamp) | On submitAnswer. |

All stored in LearningMemoryDO `events` table; topic state is updated from `answer_submitted` (and derived mastery is not stored).

### 3.4 Topic State (per concept, in DO)

Derived from events; updated on each non-skipped answer.

```ts
interface TopicStateRow {
  conceptId: string;
  exposureCount: number;
  accuracyEma: number;        // EMA with alpha 0.2
  failureStreak: number;
  lastAt: number;
}
```

### 3.5 Mastery (derived, not stored)

```ts
type Mastery = "solid" | "learning" | "weak" | "unknown";
```

- **unknown**: `exposureCount === 0`
- **weak**: `accuracyEma < 0.5` OR `failureStreak >= 2`
- **solid**: `exposureCount >= 3` AND `accuracyEma >= 0.7` AND `failureStreak < 2`
- **learning**: otherwise

### 3.6 Progress Item (API response)

```ts
interface ProgressItem {
  conceptId: string;
  name: string;
  difficultyTier?: number;
  difficulty_hint?: "intro" | "core" | "advanced";
  type?: ConceptType;
  track?: Track;
  exposureCount: number;
  accuracyEma: number;
  failureStreak: number;
  lastAt: number;
  mastery: Mastery;
}
```

### 3.7 Durable Object Tables (LearningMemoryDO)

- **concepts**: `id`, `name`, `difficulty_tier` (seed from `getConceptSeedRows()`).
- **events**: `id`, `event_type`, `payload` (JSON), `created_at`.
- **topic_state**: `concept_id`, `exposure_count`, `accuracy_ema`, `failure_streak`, `last_at`.
- **reels**: `id`, `concept_id`, `type`, `prompt`, `options` (JSON), `correct_index`, `explanation`, `difficulty`, `created_at`, `consumed_at`, `skipped_at`.

---

## 4. Workflows

### 4.1 Feed: SSE stream (primary)

1. Client calls `GET /api/system-shots/reels/stream` (optional query: `cursor`, `focus`, `excludeIds`). Worker auth-checks and forwards to LearningMemoryDO with path `/stream`.
2. **LearningMemoryDO** `streamReels()`: calls `generateReelsStream(env, topicState, concepts, count, options)` to generate reels on demand; for each reel, `persistOrGetReel()` deduplicates and persists; yields SSE chunks `{ type: "content", content: JSON.stringify(reel) }`; ends with `{ type: "done", finishReason: "stop" }`.
3. Client consumes the stream in `reelsStream.ts` and `useReelsFeed`; SystemShotsPage renders segments. See [FEED_FLOW.md](./FEED_FLOW.md) for protocol and lifecycle details.

### 4.2 Submit Answer

1. Client calls `systemShots.submitAnswer({ reelId, selectedIndex, correct, skipped? })`.
2. DO looks up reel; if missing (e.g. already consumed or mock id), no-op.
3. Appends `answer_submitted` event.
4. If **skipped**: set `reels.skipped_at = now` (reel stays unconsumed; replayed later, ordered first).
5. If **not skipped**: set `reels.consumed_at = now` and update `topic_state` for the concept (exposure_count++, accuracy EMA, failure_streak).

### 4.3 Get Progress

1. Client calls `systemShots.getProgress()`.
2. DO reads concepts left-joined with topic_state; for each row, derives `mastery` from exposure/accuracy/streak; enriches with ConceptV2 metadata (difficulty_hint, type, track) from canon.
3. Returns `{ items: ProgressItem[] }`.

---

## 5. Components & Files

| File | Purpose |
|------|--------|
| **types.ts** | Reel, ConceptV2, Track, Signal, ConceptType, event payloads, TopicStateRow, ProgressItem, Mastery, PracticeProblem. |
| **concepts.ts** | `CONCEPT_V2` (frozen list), `PRACTICE_PROBLEMS_V1`, `getConceptSeedRows()`, `getConceptSeed()`, `getConceptToSignalsMap()`, `getAdaptiveProblemSequence(signalGaps)`. |
| **generate.ts** | `generateReelsStream` / `generateReelsBatch` — LLM MCQ generation, Zod schema, UUID assignment. |
| **router.ts** | tRPC `systemShotsRouter`: `submitAnswer`, `getProgress`, `getAvailableTopics`. |
| **FEED_FLOW.md** | Canonical feed doc: SSE protocol, cursor/focus/excludeIds, streamReels lifecycle, deduplication. |

**External dependency:** `server/do/LearningMemoryDO.ts` — implements storage, event log, topic state; feed via `streamReels()` → `generateReelsStream`; `submitAnswer`, `getProgress`; imports types and concepts from this directory.

---

## 6. API (tRPC)

Mount: `systemShots` (see `server/trpc.ts`). **Feed is SSE-only** (see [FEED_FLOW.md](./FEED_FLOW.md)); tRPC is for actions and metadata only.

| Procedure | Type | Input | Output |
|-----------|------|--------|--------|
| **submitAnswer** | mutation | `{ reelId, selectedIndex, correct, skipped? }` | `{ ok: true }` |
| **getProgress** | query | — | `{ items: ProgressItem[] }` |
| **getAvailableTopics** | query | — | `ConceptInfo[]` (id, name, track, difficulty from CONCEPT_V2) |

All procedures are **protected** (require authenticated user). `ctx.userId` is used to get the LearningMemoryDO id (`idFromName(userId)`).

---

## 7. Config / env

The worker and LearningMemoryDO do not define System Shots–specific env vars. They use the app’s existing bindings (auth, `GEMINI_API_KEY` for generation, etc.). For the full list of vars and bindings, see the project root [wrangler.jsonc](../../wrangler.jsonc).

---

## 8. References

- **Feed (SSE):** [FEED_FLOW.md](./FEED_FLOW.md) — streaming protocol, cursor/focus/excludeIds, streamReels, deduplication.
- **Product & architecture spec:** [spec/system-shots.md](../../spec/system-shots.md) — mental model, progress model, reel types, feed philosophy, offline-first, determinism, scope kill list.
- **Durable Object:** [server/do/LearningMemoryDO.ts](../do/LearningMemoryDO.ts) — streamReels, submitAnswer, getProgress, tables, event log, topic state.
- **tRPC mount:** [server/trpc.ts](../trpc.ts) — `systemShots: systemShotsRouter`.
