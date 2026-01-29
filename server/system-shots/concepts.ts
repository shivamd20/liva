/**
 * Frozen canonical concepts (v2) – interview-complete, finite, immutable.
 * Single source of truth; DB seed derived from this.
 */
import type { ConceptV2, Concept, PracticeProblem, Signal } from "./types";

/** difficulty_hint → difficulty_tier for DB seed (intro=1, core=2, advanced=3). */
function hintToTier(hint: ConceptV2["difficulty_hint"]): number {
  return hint === "intro" ? 1 : hint === "core" ? 2 : 3;
}

/** Rows to insert into concepts table (id, name, difficulty_tier). */
export function getConceptSeedRows(): { id: string; name: string; difficultyTier: number }[] {
  return CONCEPT_V2.map((c) => ({
    id: c.id,
    name: c.name,
    difficultyTier: hintToTier(c.difficulty_hint),
  }));
}

/** Legacy shape for callers that expect Concept[]. */
export function getConceptSeed(): Concept[] {
  return getConceptSeedRows();
}

/** Frozen canonical concept set (v2). No further concepts; no renaming. */
export const CONCEPT_V2: ConceptV2[] = [
  {
    id: "back-of-envelope",
    name: "Back of the Envelope Estimation",
    type: "principle",
    track: "foundations",
    difficulty_hint: "intro",
    requires_tags: [],
    related_tags: ["qps", "storage", "bandwidth"],
    signals: ["interview_structuring", "cost_reasoning"],
    typical_questions: [
      "Estimate users, QPS, and storage for this system",
      "Which number matters most and why?",
    ],
  },
  {
    id: "cap",
    name: "CAP Theorem",
    type: "principle",
    track: "foundations",
    difficulty_hint: "intro",
    requires_tags: [],
    related_tags: ["consistency", "availability", "partition"],
    signals: ["consistency_reasoning", "tradeoff_reasoning"],
    typical_questions: [
      "Which two properties does your system choose?",
      "Is this actually a CAP tradeoff?",
    ],
  },
  {
    id: "tail-latency",
    name: "Tail Latency & Percentiles",
    type: "principle",
    track: "latency-performance",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["p99", "timeouts", "fanout"],
    signals: ["latency_reasoning", "scalability_instinct"],
    typical_questions: [
      "Why is P99 worse at scale?",
      "How do retries affect tail latency?",
    ],
  },
  {
    id: "consensus",
    name: "Consensus (Raft / Paxos)",
    type: "primitive",
    track: "distributed-systems",
    difficulty_hint: "advanced",
    requires_tags: [],
    related_tags: ["leader-election", "quorum"],
    signals: ["consistency_reasoning", "failure_mode_awareness"],
    typical_questions: ["Why is consensus hard?", "What failures can Raft tolerate?"],
  },
  {
    id: "leader-election",
    name: "Leader Election",
    type: "primitive",
    track: "distributed-systems",
    difficulty_hint: "core",
    requires_tags: ["consensus"],
    related_tags: ["zookeeper", "raft"],
    signals: ["failure_mode_awareness", "tradeoff_reasoning"],
    typical_questions: [
      "How do nodes agree on a leader?",
      "What happens during split brain?",
    ],
  },
  {
    id: "gossip",
    name: "Gossip Protocols",
    type: "primitive",
    track: "distributed-systems",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["membership", "eventual-consistency"],
    signals: ["scalability_instinct"],
    typical_questions: [
      "Why gossip instead of a central registry?",
      "How fast does gossip converge?",
    ],
  },
  {
    id: "lsm",
    name: "LSM Trees & Write Amplification",
    type: "pattern",
    track: "storage",
    difficulty_hint: "advanced",
    requires_tags: [],
    related_tags: ["sstables", "compaction"],
    signals: ["tradeoff_reasoning", "latency_reasoning"],
    typical_questions: [
      "Why LSM for write heavy systems?",
      "What causes write amplification?",
    ],
  },
  {
    id: "btree",
    name: "B-Trees",
    type: "pattern",
    track: "storage",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["indexes", "random-io"],
    signals: ["latency_reasoning"],
    typical_questions: [
      "Why B-Trees are good for disks?",
      "When are they worse than LSM?",
    ],
  },
  {
    id: "inverted-index",
    name: "Inverted Index",
    type: "primitive",
    track: "data-modeling",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["search", "ranking"],
    signals: ["latency_reasoning"],
    typical_questions: [
      "How does search scale?",
      "What is the write cost of indexing?",
    ],
  },
  {
    id: "message-queues",
    name: "Message Queues & Pub-Sub",
    type: "primitive",
    track: "distributed-systems",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["kafka", "sqs", "ordering"],
    signals: ["failure_mode_awareness", "scalability_instinct"],
    typical_questions: [
      "Why async instead of sync?",
      "How do you guarantee delivery?",
    ],
  },
  {
    id: "distributed-log",
    name: "Distributed Log",
    type: "pattern",
    track: "messaging-streaming",
    difficulty_hint: "advanced",
    requires_tags: [],
    related_tags: ["kafka", "offsets"],
    signals: ["tradeoff_reasoning"],
    typical_questions: [
      "Why logs instead of queues?",
      "How does partitioning affect ordering?",
    ],
  },
  {
    id: "sharding",
    name: "Sharding & Partitioning",
    type: "primitive",
    track: "distributed-systems",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["hashing", "range-partition"],
    signals: ["scalability_instinct", "tradeoff_reasoning"],
    typical_questions: [
      "How do you shard data?",
      "How do you rebalance shards?",
    ],
  },
  {
    id: "circuit-breaker",
    name: "Circuit Breaker",
    type: "pattern",
    track: "reliability",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["timeouts", "retries"],
    signals: ["failure_mode_awareness"],
    typical_questions: [
      "Why not retry forever?",
      "What happens if breakers are misconfigured?",
    ],
  },
  {
    id: "caching",
    name: "Caching (Read/Write Through, TTL, Invalidation)",
    type: "pattern",
    track: "latency-performance",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["redis", "memcached", "cache-invalidation"],
    signals: ["latency_reasoning", "tradeoff_reasoning"],
    typical_questions: [
      "What do you cache and where?",
      "How do you handle cache invalidation?",
    ],
  },
  {
    id: "cdn",
    name: "Content Delivery Networks (CDN)",
    type: "system",
    track: "latency-performance",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["edge", "geo-replication"],
    signals: ["latency_reasoning", "cost_reasoning"],
    typical_questions: [
      "What belongs at the edge?",
      "How does CDN reduce origin load?",
    ],
  },
  {
    id: "load-balancing",
    name: "Load Balancing",
    type: "primitive",
    track: "scalability",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["round-robin", "least-connections"],
    signals: ["scalability_instinct"],
    typical_questions: [
      "Where do you load balance?",
      "How do you avoid hot nodes?",
    ],
  },
  {
    id: "rate-limiting",
    name: "Rate Limiting & Quotas",
    type: "pattern",
    track: "reliability",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["token-bucket", "leaky-bucket"],
    signals: ["failure_mode_awareness"],
    typical_questions: [
      "How do you protect the system from abuse?",
      "Where do you enforce limits?",
    ],
  },
  {
    id: "consistent-hashing",
    name: "Consistent Hashing",
    type: "pattern",
    track: "distributed-systems",
    difficulty_hint: "core",
    requires_tags: ["sharding"],
    related_tags: ["ring", "virtual-nodes"],
    signals: ["tradeoff_reasoning"],
    typical_questions: [
      "Why consistent hashing?",
      "What happens when nodes join or leave?",
    ],
  },
  {
    id: "exactly-once",
    name: "Exactly-Once vs At-Least-Once Semantics",
    type: "principle",
    track: "distributed-systems",
    difficulty_hint: "advanced",
    requires_tags: [],
    related_tags: ["deduplication", "idempotency"],
    signals: ["consistency_reasoning"],
    typical_questions: [
      "Is exactly-once achievable?",
      "What tradeoffs does it introduce?",
    ],
  },
  {
    id: "replication",
    name: "Replication Strategies",
    type: "primitive",
    track: "reliability",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["leader-follower", "multi-leader"],
    signals: ["failure_mode_awareness"],
    typical_questions: [
      "How do replicas stay in sync?",
      "What happens on replica lag?",
    ],
  },
  {
    id: "failover",
    name: "Failover & Disaster Recovery",
    type: "pattern",
    track: "reliability",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["rpo", "rto"],
    signals: ["operability_awareness"],
    typical_questions: [
      "How do you handle region failure?",
      "What is your recovery strategy?",
    ],
  },
  {
    id: "observability",
    name: "Observability (Logs, Metrics, Traces)",
    type: "principle",
    track: "operability",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["sli", "slo"],
    signals: ["operability_awareness"],
    typical_questions: [
      "How do you debug production issues?",
      "What do you alert on?",
    ],
  },
  {
    id: "authn-authz",
    name: "Authentication & Authorization",
    type: "primitive",
    track: "security",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["oauth", "jwt"],
    signals: ["security_awareness"],
    typical_questions: [
      "How do users authenticate?",
      "How do you enforce access control?",
    ],
  },
  {
    id: "multi-tenancy",
    name: "Multi-Tenant Isolation",
    type: "pattern",
    track: "security",
    difficulty_hint: "advanced",
    requires_tags: [],
    related_tags: ["row-level-security"],
    signals: ["security_awareness", "scalability_instinct"],
    typical_questions: [
      "How do you isolate tenants?",
      "What happens during noisy neighbor issues?",
    ],
  },
  {
    id: "design-search",
    name: "Design a Search System",
    type: "system",
    track: "system-archetypes",
    difficulty_hint: "advanced",
    requires_tags: [
      "inverted-index",
      "caching",
      "sharding",
      "tail-latency",
    ],
    related_tags: ["elasticsearch", "google-search"],
    signals: [
      "tradeoff_reasoning",
      "latency_reasoning",
      "interview_structuring",
    ],
    typical_questions: [
      "How would you design Google Search?",
      "How do you balance freshness vs relevance?",
    ],
  },
  {
    id: "read-heavy",
    name: "Read Heavy Systems",
    type: "system",
    track: "system-archetypes",
    difficulty_hint: "core",
    requires_tags: ["caching", "replication"],
    related_tags: ["cdn"],
    signals: ["scalability_instinct"],
    typical_questions: [
      "Where do you cache?",
      "How do you invalidate data?",
    ],
  },
  {
    id: "write-heavy",
    name: "Write Heavy Systems",
    type: "system",
    track: "system-archetypes",
    difficulty_hint: "core",
    requires_tags: ["lsm"],
    related_tags: ["logging"],
    signals: ["tradeoff_reasoning"],
    typical_questions: [
      "How do you handle burst writes?",
      "What consistency can you relax?",
    ],
  },
  {
    id: "on-prem",
    name: "On Prem System Design",
    type: "system",
    track: "deployment-environments",
    difficulty_hint: "core",
    requires_tags: [],
    related_tags: ["capacity-planning", "upgrades"],
    signals: ["operability_awareness", "cost_reasoning"],
    typical_questions: [
      "What changes without managed services?",
      "How do you handle failures manually?",
    ],
  },
];

/** Canonical system design practice problems (40). Each tagged with required concepts. */
export const PRACTICE_PROBLEMS_V1: PracticeProblem[] = [
  { id: "url-shortener", name: "Design URL Shortener", requiredConceptIds: ["sharding", "caching", "consistent-hashing", "back-of-envelope"], category: "core" },
  { id: "twitter", name: "Design Twitter / X", requiredConceptIds: ["message-queues", "sharding", "caching", "tail-latency"], category: "core" },
  { id: "instagram", name: "Design Instagram", requiredConceptIds: ["caching", "cdn", "sharding"], category: "core" },
  { id: "news-feed", name: "Design Facebook News Feed", requiredConceptIds: ["caching", "message-queues", "sharding", "tail-latency"], category: "core" },
  { id: "whatsapp", name: "Design WhatsApp", requiredConceptIds: ["message-queues", "replication", "consensus", "failover"], category: "core" },
  { id: "youtube", name: "Design YouTube", requiredConceptIds: ["cdn", "caching", "sharding", "distributed-log"], category: "core" },
  { id: "netflix", name: "Design Netflix", requiredConceptIds: ["cdn", "caching", "rate-limiting", "observability"], category: "core" },
  { id: "uber", name: "Design Uber", requiredConceptIds: ["message-queues", "caching", "sharding", "tail-latency", "replication"], category: "core" },
  { id: "google-drive", name: "Design Google Drive", requiredConceptIds: ["sharding", "replication", "caching", "consistency-reasoning"], category: "core" },
  { id: "dropbox", name: "Design Dropbox", requiredConceptIds: ["replication", "caching", "sharding", "failover"], category: "core" },
  { id: "distributed-fs", name: "Design Distributed File System", requiredConceptIds: ["sharding", "replication", "consensus", "failover"], category: "storage" },
  { id: "kv-store", name: "Design Key-Value Store", requiredConceptIds: ["sharding", "consistent-hashing", "replication", "cap"], category: "storage" },
  { id: "object-storage", name: "Design Object Storage (S3)", requiredConceptIds: ["sharding", "replication", "caching", "cdn"], category: "storage" },
  { id: "timeseries-db", name: "Design Time-Series Database", requiredConceptIds: ["lsm", "sharding", "caching"], category: "storage" },
  { id: "logging-system", name: "Design Logging System", requiredConceptIds: ["distributed-log", "sharding", "message-queues"], category: "storage" },
  { id: "metrics-collection", name: "Design Metrics Collection System", requiredConceptIds: ["observability", "sharding", "caching", "tail-latency"], category: "storage" },
  { id: "search-engine", name: "Design Search Engine", requiredConceptIds: ["inverted-index", "sharding", "caching", "design-search"], category: "storage" },
  { id: "recommendation-system", name: "Design Recommendation System", requiredConceptIds: ["caching", "sharding", "message-queues", "tail-latency"], category: "storage" },
  { id: "rate-limiter", name: "Design Rate Limiter", requiredConceptIds: ["rate-limiting", "caching", "sharding"], category: "scalability" },
  { id: "load-balancer", name: "Design Load Balancer", requiredConceptIds: ["load-balancing", "failover", "observability"], category: "scalability" },
  { id: "api-gateway", name: "Design API Gateway", requiredConceptIds: ["rate-limiting", "authn-authz", "load-balancing"], category: "scalability" },
  { id: "cdn-design", name: "Design CDN", requiredConceptIds: ["cdn", "caching", "failover", "observability"], category: "scalability" },
  { id: "web-crawler", name: "Design Web Crawler", requiredConceptIds: ["message-queues", "rate-limiting", "sharding", "caching"], category: "scalability" },
  { id: "ad-serving", name: "Design Ad Serving System", requiredConceptIds: ["caching", "tail-latency", "rate-limiting", "cdn"], category: "scalability" },
  { id: "chat-system", name: "Design Chat System", requiredConceptIds: ["message-queues", "replication", "caching"], category: "messaging" },
  { id: "notification-system", name: "Design Notification System", requiredConceptIds: ["message-queues", "rate-limiting", "caching"], category: "messaging" },
  { id: "message-queue-design", name: "Design Message Queue", requiredConceptIds: ["message-queues", "replication", "exactly-once", "distributed-log"], category: "messaging" },
  { id: "event-streaming", name: "Design Event Streaming Platform", requiredConceptIds: ["distributed-log", "sharding", "exactly-once"], category: "messaging" },
  { id: "payment-processing", name: "Design Payment Processing System", requiredConceptIds: ["exactly-once", "replication", "failover", "authn-authz"], category: "messaging" },
  { id: "monitoring-system", name: "Design Monitoring System", requiredConceptIds: ["observability", "message-queues", "caching"], category: "reliability" },
  { id: "alerting-system", name: "Design Alerting System", requiredConceptIds: ["observability", "failover", "message-queues"], category: "reliability" },
  { id: "feature-flags", name: "Design Feature Flag System", requiredConceptIds: ["caching", "observability", "multi-tenancy"], category: "reliability" },
  { id: "config-management", name: "Design Config Management System", requiredConceptIds: ["replication", "observability", "failover"], category: "reliability" },
  { id: "backup-restore", name: "Design Backup & Restore System", requiredConceptIds: ["replication", "failover", "sharding"], category: "reliability" },
  { id: "multi-region-db", name: "Design Multi-Region Database", requiredConceptIds: ["replication", "cap", "failover", "consensus"], category: "advanced" },
  { id: "global-cache", name: "Design Global Cache", requiredConceptIds: ["caching", "consistent-hashing", "failover", "observability"], category: "advanced" },
  { id: "fraud-detection", name: "Design Fraud Detection System", requiredConceptIds: ["message-queues", "observability", "authn-authz", "tail-latency"], category: "advanced" },
  { id: "realtime-analytics", name: "Design Real-Time Analytics Platform", requiredConceptIds: ["distributed-log", "sharding", "caching", "tail-latency"], category: "advanced" },
  { id: "feed-ranking", name: "Design Recommendation Feed Ranking", requiredConceptIds: ["caching", "message-queues", "tail-latency", "sharding"], category: "advanced" },
  { id: "search-autocomplete", name: "Design Search Autocomplete", requiredConceptIds: ["inverted-index", "caching", "tail-latency"], category: "advanced" },
];

/** Concept id → signals (for adaptive sequencing and gap targeting). */
export function getConceptToSignalsMap(): Record<string, Signal[]> {
  const map: Record<string, Signal[]> = {};
  for (const c of CONCEPT_V2) {
    map[c.id] = [...c.signals];
  }
  return map;
}

/**
 * Adaptive problem sequence: order problems by how well they cover the given signal gaps.
 * Problems that require concepts emitting the missing signals are preferred and ordered first.
 */
export function getAdaptiveProblemSequence(signalGaps: string[]): string[] {
  if (signalGaps.length === 0) return PRACTICE_PROBLEMS_V1.map((p) => p.id);
  const gapSet = new Set(signalGaps);
  const conceptToSignals = getConceptToSignalsMap();
  const score = (problemId: string): number => {
    const problem = PRACTICE_PROBLEMS_V1.find((p) => p.id === problemId);
    if (!problem) return 0;
    let hits = 0;
    for (const conceptId of problem.requiredConceptIds) {
      const signals = conceptToSignals[conceptId] ?? [];
      for (const s of signals) {
        if (gapSet.has(s)) hits += 1;
      }
    }
    return hits;
  };
  return [...PRACTICE_PROBLEMS_V1]
    .map((p) => p.id)
    .sort((a, b) => score(b) - score(a));
}
