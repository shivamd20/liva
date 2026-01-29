export type ReelType = "mcq" | "flash";

export type BaseReel = {
  id: string;
  type: ReelType;
  prompt: string;
  explanation: string;
};

export type MCQReel = BaseReel & {
  type: "mcq";
  options: string[];
  correctIndex: number;
};

export type FlashReel = BaseReel & {
  type: "flash";
};

export type Reel = MCQReel | FlashReel;

export const mockReels: Reel[] = [
  {
    id: "1",
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
  },
  {
    id: "2",
    type: "flash",
    prompt: "Event Sourcing",
    explanation:
      "Event sourcing stores state changes as an immutable log of events. The current state is derived by replaying events. Benefits: full audit trail, time travel, easy replication. Used in financial systems and collaboration tools.",
  },
  {
    id: "3",
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
  },
  {
    id: "4",
    type: "flash",
    prompt: "Consistent Hashing",
    explanation:
      "Consistent hashing maps keys and nodes to a ring. Adding or removing a node only remaps K/N keys (N = nodes). Used in caches and distributed storage to minimize reshuffling.",
  },
  {
    id: "5",
    type: "mcq",
    prompt: "What does idempotency guarantee for an API?",
    options: [
      "Same request can be applied multiple times with the same effect as once",
      "Requests are processed in order",
      "Responses are cached indefinitely",
      "Only one client can call at a time",
    ],
    correctIndex: 0,
    explanation:
      "Idempotency means repeating the same request (e.g. with an idempotency key) produces the same outcome. Critical for retries and at-least-once delivery.",
  },
  {
    id: "6",
    type: "flash",
    prompt: "Circuit Breaker",
    explanation:
      "A circuit breaker stops calling a failing dependency after a threshold (open state), then allows limited probes (half-open) before fully resuming (closed). Prevents cascade failures.",
  },
  {
    id: "7",
    type: "mcq",
    prompt: "In a pub/sub system, what is a dead-letter queue (DLQ) for?",
    options: [
      "Messages that failed processing after retries",
      "High-priority messages only",
      "Messages from inactive subscribers",
      "Duplicate messages",
    ],
    correctIndex: 0,
    explanation:
      "DLQs hold messages that could not be processed after max retries (poison pills, bugs). They allow inspection and replay without blocking the main queue.",
  },
];
