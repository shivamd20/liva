# Concept Mastery Levels (Updated Plan)

This plan adds **explicit, inspectable sub-states** per concept so that:

* the LLM knows *what to generate next*
* you can show *where the user is* and *why*
* promotion is based on **observable signals**, not vibes

This does **not** change your canonical concept list. It layers structure on top of it.

---

## 1. Core Model: Concept × MasteryLevel

Every `ConceptV2` gets the same mastery ladder. Promotion is gated by **demonstrable capabilities**, not completion counts.

Each level has:

* **Name** (user-facing)
* **Definition** (what this level *means*)
* **User can reliably do** (capability contract)
* **LLM generation focus** (what content to emit)
* **Promotion signals** (objective checks)

---

## 2. Canonical Mastery Ladder (7 levels)

### Level 0 – Unseen

**Meaning**: Concept has not entered working memory.

User can:

* nothing meaningful

LLM generates:

* ultra-short intuition
* one concrete real-world analogy

Promotion signals:

* user engages with ≥1 explainer

---

### Level 1 – Recognizer

**Meaning**: User can recognize the term and its rough domain.

User can:

* identify where the concept applies
* reject obviously wrong uses

LLM generates:

* crisp definition
* “this is NOT X” contrasts
* one interview framing question

Promotion signals:

* correct multiple-choice discrimination
* basic recall in free-form text

---

### Level 2 – Explainer

**Meaning**: User can explain the concept cleanly to another engineer.

User can:

* give a 30–60 second explanation
* name 2–3 core components or forces

LLM generates:

* structured explanation
* component breakdown
* first-order tradeoffs

Promotion signals:

* explanation graded for clarity
* covers ≥80% of expected components

---

### Level 3 – Applier

**Meaning**: User can apply the concept correctly in isolation.

User can:

* choose this concept when designing
* apply it to a toy system

LLM generates:

* constrained design prompts
* “where would you use this?” exercises
* light numerical or config choices

Promotion signals:

* correct inclusion in design
* no conceptual misuse

---

### Level 4 – Integrator

**Meaning**: User can compose this concept with others.

User can:

* explain interactions with adjacent concepts
* reason about second-order effects

LLM generates:

* multi-concept scenarios
* failure-mode prompts
* tradeoff matrices

Promotion signals:

* correct interaction reasoning
* identifies at least one downside

---

### Level 5 – Tradeoff Driver

**Meaning**: User uses the concept to *drive decisions*.

User can:

* justify why this over alternatives
* adapt the concept to constraints

LLM generates:

* ambiguous design problems
* “what would you sacrifice?” prompts
* cost, latency, reliability tension

Promotion signals:

* explicit tradeoff articulation
* consistent reasoning under variation

---

### Level 6 – Failure-Aware Expert

**Meaning**: User understands where this concept breaks.

User can:

* predict failure modes
* describe mitigation strategies

LLM generates:

* incident-style prompts
* postmortem analysis
* misconfiguration scenarios

Promotion signals:

* accurate failure identification
* realistic mitigations

---

### Level 7 – Interview-Grade Mastery

**Meaning**: Concept is interview-usable under pressure.

User can:

* lead with this concept unprompted
* defend it against pushback

LLM generates:

* adversarial interviewer questions
* follow-up chains
* time-boxed explanations

Promotion signals:

* survives adversarial questioning
* no major gaps under stress

---

## 3. Concept-Specific Overrides (Critical)

The ladder is universal, but **each concept defines what counts at each level**.

Add per-concept metadata:

```ts
ConceptMasterySpec {
  conceptId: string;
  levelExpectations: {
    level: number;
    mustDemonstrate: string[];
    commonMistakes: string[];
    disqualifiers?: string[];
  }[];
}
```

Example excerpts:

### CAP Theorem

* Level 2: must correctly define partition tolerance
* Level 4: must explain why most systems are CP or AP by necessity
* Level 6: must reject fake CAP tradeoffs

### Tail Latency

* Level 3: must explain fanout amplification
* Level 5: must reason about retries vs hedging
* Level 6: must identify p99 regressions in incident scenario

---

## 4. Progress Visualization Model

Expose mastery as:

* **Primary level** (0–7)
* **Confidence band** (thin / solid / brittle)
* **Next unlock** (explicit capability)

Example:

> Tail Latency
> Level 4 – Integrator
> Missing: correct retry vs timeout tradeoff

This avoids fake progress bars.

---

## 5. Feed Generation Rules (High Signal)

The feed always targets:

1. lowest-level blocking concept
2. highest interview signal gap
3. nearest promotion condition

Generation formula:

```
TargetLevel = min(userLevel + 1, 7)
Emit content that tests EXACT promotion signals for TargetLevel
```

No random explanations. Every card is promotion-oriented.

---

## 6. Why This Works

* deterministic promotion
* LLM knows what "good" looks like
* interview readiness becomes measurable
* scales cleanly across all concepts

This turns your concept graph into a **competency lattice**, not a syllabus.

If you want next steps: I would formalize 3–4 concepts fully as exemplars and let the rest inherit.
