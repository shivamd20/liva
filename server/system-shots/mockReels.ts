/**
 * Server-side mock reels for testing (no DO/LLM). Same content as client mock, in API Reel shape.
 * Concept IDs from v2 canon only.
 */
import type { Reel } from "./types";

export const MOCK_REELS: Reel[] = [
  {
    id: "1",
    conceptId: "cap",
    type: "mcq",
    prompt: "In a distributed system, what is the primary trade-off in CAP theorem?",
    options: [
      "You can have at most two of: consistency, availability, partition tolerance",
      "You can have all three with enough nodes",
      "Partition tolerance is optional in practice",
      "Availability is always sacrificed first",
    ],
    correctIndex: 0,
    explanation:
      "CAP states that during a network partition, you must choose between consistency and availability. Partition tolerance is assumed (networks fail); you trade off the other two.",
    difficulty: 1,
  },
  {
    id: "2",
    conceptId: "tail-latency",
    type: "mcq",
    prompt: "Why does P99 latency often degrade at scale?",
    options: [
      "Fan-out and retries amplify tail latency",
      "P99 is always equal to P50 at scale",
      "Networks get faster with more nodes",
      "Caching eliminates tail latency",
    ],
    correctIndex: 0,
    explanation:
      "With fan-out (e.g. one request hitting many backends) and retries, the slowest component dominates. One slow node or retry can push P99 up.",
    difficulty: 2,
  },
  {
    id: "3",
    conceptId: "lsm",
    type: "mcq",
    prompt: "Which strategy reduces write amplification in an LSM-tree?",
    options: [
      "Larger memtable flush size",
      "Smaller bloom filters",
      "More compaction levels",
      "Synchronous writes only",
    ],
    correctIndex: 0,
    explanation:
      "Larger memtable flushes mean fewer flushes and thus fewer compactions. Smaller bloom filters and more levels increase read/write overhead. Sync writes don't reduce amplification.",
    difficulty: 2,
  },
  {
    id: "4",
    conceptId: "circuit-breaker",
    type: "mcq",
    prompt: "Why not retry a failing dependency indefinitely?",
    options: [
      "Retries can cascade and overload the failing service; circuit breaker stops calls",
      "Retries always succeed after N attempts",
      "Circuit breakers increase latency",
      "There is no downside to infinite retries",
    ],
    correctIndex: 0,
    explanation:
      "Repeated retries keep load on a failing dependency and can amplify outages. A circuit breaker opens and stops calls, allowing recovery.",
    difficulty: 1,
  },
  {
    id: "5",
    conceptId: "sharding",
    type: "mcq",
    prompt: "What is a major risk during shard rebalancing?",
    options: [
      "Hot partitions and uneven load while keys move",
      "Shards become read-only",
      "Consistency is automatically strong",
      "No risk; rebalancing is instantaneous",
    ],
    correctIndex: 0,
    explanation:
      "During rebalance, some shards can be overloaded (hot partitions), and moving keys can cause temporary inconsistency or latency spikes.",
    difficulty: 2,
  },
  {
    id: "6",
    conceptId: "consensus",
    type: "mcq",
    prompt: "What class of failures can Raft tolerate?",
    options: [
      "Minority of nodes failing (e.g. 1 of 3); not split brain or majority loss",
      "Any number of node failures",
      "Network partitions with no limit",
      "Byzantine (arbitrary) node behavior",
    ],
    correctIndex: 0,
    explanation:
      "Raft tolerates fewer than half of nodes failing. It does not tolerate split brain (multiple leaders) or Byzantine failures without extensions.",
    difficulty: 3,
  },
  {
    id: "7",
    conceptId: "distributed-log",
    type: "mcq",
    prompt: "Why use a log instead of a traditional queue for event streaming?",
    options: [
      "Logs preserve order per partition and allow multiple consumers to replay",
      "Queues are always faster",
      "Logs cannot be partitioned",
      "Queues provide stronger ordering guarantees",
    ],
    correctIndex: 0,
    explanation:
      "A log is append-only and ordered per partition; multiple consumers can read at their own offset. Queues typically hand off messages to one consumer.",
    difficulty: 2,
  },
];
