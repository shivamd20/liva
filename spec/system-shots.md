# System Design Reels – Full Product + Architecture Blueprint

This document is the **single source of truth** for the product, UX, and system architecture. It is intentionally verbose and opinionated. Cursor should infer LLD and code from this without you needing to think again.

---

## 0. Product Preface (Read This First)

### 0.1 What This App Is

A **high-signal learning system** for senior engineers to achieve **long-term mastery of system design concepts** through short, repeated, cognitively efficient interactions.

It borrows the *interaction model* of Instagram Reels, **not** the content philosophy.

This is not:

* Interview hack prep
* Beginner education
* Social media
* AI demo

It *is*:

* Memory shaping
* Concept reinforcement
* Failure-driven learning
* Articulation training

---

### 0.2 Non‑Negotiable Constraints

* Offline-first is mandatory
* Deterministic evaluation only
* No live AI in the loop
* Session length ~3 minutes
* Infinite vertical feed
* Apple-level UX polish
* Ruthless scope discipline

If a feature violates any of the above, it is cut.

---

## 1. Mental Model of Learning (The Soul)

### 1.1 How We Believe Learning Happens

This system deliberately combines:

* **Spaced repetition** for memory retention
* **Failure-driven reinforcement** for prioritization
* **First-principles probing** to avoid rote answers
* **Pattern catalog exposure** for recognition
* **Teaching by articulation** to solidify understanding

No single reel does all of this. The *feed over time* does.

---

### 1.2 Atomic Learning Unit

The atomic unit is a **Reel**.

A reel is not a lesson. It is a **probe**.

Each reel:

* Tests exactly **one primary concept**
* May touch secondary concepts
* Produces a measurable signal

This prevents ambiguity in progress tracking and feed ranking.

---

### 1.3 Concept Graph

All knowledge is modeled as a **directed acyclic concept graph**.

Concept relationships include:

* Prerequisites
* Parent-child abstractions
* Overlaps
* Difficulty gradients

The graph is:

* Human-defined initially
* Immutable per version
* Used by feed generation and progress views

---

## 2. Progress Model

### 2.1 What Progress Means

Progress is **multi-dimensional**.

A user never has a single score. They have a **state per concept**.

Progress is defined by:

* Accuracy over time
* Exposure frequency
* Failure streaks
* Recency

---

### 2.2 Concept State (Logical Model)

For each (user, concept):

* Accuracy EMA
* Exposure count
* Last interaction timestamp
* Failure streak

From these, we derive (never store):

* Mastery bucket: unknown / weak / learning / solid

---

### 2.3 Failure Philosophy

Failure is **explicit and visible**.

* Wrong answers are shown clearly
* Explanations are immediate
* No punishment
* Reinforcement is silent and algorithmic

The feed reacts to failure. The user is never scolded.

---

## 3. Reel System

### 3.1 Supported Reel Types (V1)

Only the following exist in V1:

1. MCQ
2. Binary (yes/no)
3. Ordering / ranking
4. Free text input
5. Voice answer
6. Flash explanation (passive)

Anything else is deferred.

---

### 3.2 Reel Semantics

Each reel has:

* Prompt
* Interaction model
* Deterministic scoring rule
* Pre-generated explanation
* Difficulty rating
* Concept binding

Voice reels are treated as **text reels after transcription**.

---

### 3.3 Variations

Multiple reels may exist for the same concept.

Variations differ by:

* Wording
* Difficulty
* Interaction type

The feed uses variations to avoid memorization artifacts.

---

### 3.4 Locked v2 Ontology and Canon

The concept ontology and question bar are **locked** (v2 final):

* **Schema**: `ConceptV2` (type, track, difficulty_hint, requires_tags, related_tags, signals, typical_questions). No further fields; no renaming.
* **Canon**: A finite, frozen set of interview-relevant concepts lives in `server/system-shots/concepts.ts` (`CONCEPT_V2`). Single source of truth; DB seed derived from it.
* **Generation**: The interview-grade MCQ prompt lives in `server/system-shots/generate.ts`. It enforces tradeoffs, failure modes, and “why / what happens if” over trivia.
* **Progress UI**: Progress page supports tag-wise filters (by track and type) and structured layout; items include track, type, and difficulty_hint from the canon.

---

## 4. Feed Philosophy (The Product)

### 4.1 What the Feed Is

The feed is a **personalized cognitive reinforcement engine**.

It optimizes for:

* Weakness exposure
* Memory decay prevention
* Momentum preservation

Not for novelty or entertainment.

---

### 4.2 Ranking Signals (Ordered)

1. Recently failed concepts
2. Recently learned concepts
3. Streak continuation
4. Explicit user interest
5. Novelty

Failure dominates. Always.

---

### 4.3 Reinforcement Rules

If a concept is failed repeatedly:

* Increase exposure frequency
* Change reel type
* Reduce difficulty
* Rephrase prompts

Never repeat the same reel consecutively.

---

### 4.4 User Control

User controls are minimal:

* Skip reel
* Mark concept as "revise later"
* Enter revision mode

No feed micromanagement.

---

## 5. Offline‑First Model

### 5.1 What Works Offline

Offline mode supports:

* Viewing reels
* Answering reels
* Storing answers

Offline does NOT support:

* Feed recomputation
* New content generation

---

### 5.2 Offline Bundles

On session start, preload:

* 50–100 reels
* Associated explanations

Hard cap: ~10MB per user.

---

### 5.3 Sync Model

All interactions are logged as **events**.

On reconnect:

* Client flushes events
* Server recomputes derived state
* Last-write-wins at event level

---

## 6. System Architecture (HLD)

### 6.1 Core Principles

* Event sourcing
* Edge-first
* Stateless UI
* Deterministic compute

---

### 6.2 Major Components

1. Web Client (Next.js)
2. Durable Objects (stateful core)
3. Content store (reels + concepts)
4. Feed engine

---

### 6.3 Durable Object Responsibilities

* UserDO

  * Event log
  * Concept states
  * Feed cursor

* ContentDO

  * Concepts
  * Reels

* FeedDO

  * Feed ranking logic
  * Bundle generation

One UserDO per user.

---

## 7. UI / UX System

### 7.1 Core Interaction

* Vertical swipe only
* One reel per screen
* No visible chrome during answering
* Immediate feedback
* Auto-advance

---

### 7.2 Feedback Design

After answer:

* Correct: subtle confirmation
* Wrong: clear explanation

No celebration. No shaming.

---

### 7.3 Visual Language

* Minimal
* Text-first
* High contrast
* Dark and light modes

Motion is purposeful, never decorative.

---

### 7.4 Key Screens

1. Reel feed
2. Offline indicator
3. Progress overview (concept-based)
4. Revision mode

No dashboards. No charts in V1.

---

## 8. Data Model Philosophy

### 8.1 Events as Truth

Everything is derived from events:

* Answers
* Skips
* Views

State is a cache.

---

### 8.2 Determinism Guarantee

Given the same event log:

* Feed order is reproducible
* Progress is reproducible

This is mandatory for trust.

---

## 9. AI Usage Policy

AI is used **only offline** to:

* Generate reels
* Generate explanations
* Generate rubrics
* Suggest concept relationships

No runtime inference.

---

## 10. Scope Kill List

Explicitly excluded:

* Social features
* Leaderboards
* Live AI evaluation
* Diagramming
* Creator tools
* Notifications

---

## 11. Build Strategy (Cursor-Oriented)

This document is intentionally **over-specified** so that:

* Cursor can infer LLD
* You can one-shot generation
* You minimize decision fatigue

You should not redesign anything while building.

---

## 12. Final Product Bar

If built correctly:

* It feels calm, serious, and precise
* It rewards competence
* It quietly exposes weakness

If it feels fun, viral, or noisy, you failed.
