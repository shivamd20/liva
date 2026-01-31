/**
 * Frozen canonical concepts (v2) – interview-complete, finite, immutable.
 * Single source of truth; DB seed derived from this.
 * v3: Added custom mastery level specifications per concept.
 */
import type { ConceptV2, Concept, PracticeProblem, Signal, LevelExpectation, MasteryLevel } from "./types";

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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know that estimation is needed in system design", "Identify key metrics: users, QPS, storage"], commonMistakes: ["Skipping estimation entirely"] },
      { level: 2, mustDemonstrate: ["Calculate QPS from DAU and usage patterns", "Estimate storage from record size × count"], commonMistakes: ["Off by orders of magnitude", "Forgetting to state assumptions"] },
      { level: 3, mustDemonstrate: ["Estimate bandwidth from QPS × payload size", "Identify which number is the bottleneck"], commonMistakes: ["Not sanity-checking results"] },
      { level: 4, mustDemonstrate: ["Connect estimates to design decisions", "Explain how QPS affects server count"], commonMistakes: ["Estimation disconnected from design"] },
      { level: 5, mustDemonstrate: ["Use estimation to justify architecture choices", "Trade off cost vs performance via numbers"], commonMistakes: ["Over-engineering without numbers"] },
      { level: 6, mustDemonstrate: ["Identify when estimates break down", "Adjust for burst traffic and growth"], commonMistakes: ["Assuming steady-state only"] },
      { level: 7, mustDemonstrate: ["Lead with estimation unprompted", "Defend numbers under interviewer probing"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Identify CAP as a distributed systems concept", "Know it involves consistency, availability, partition tolerance"], commonMistakes: ["Confusing with ACID"] },
      { level: 2, mustDemonstrate: ["Correctly define partition tolerance", "Explain why you can't have all three simultaneously"], commonMistakes: ["Thinking partition tolerance is optional"] },
      { level: 3, mustDemonstrate: ["Identify whether a given system is CP or AP", "Apply CAP reasoning to a design choice"], commonMistakes: ["Claiming a system is CA in distributed setting"] },
      { level: 4, mustDemonstrate: ["Explain interaction with replication strategies", "Reason about CAP in multi-region setups"], commonMistakes: ["Ignoring network partition scenarios"] },
      { level: 5, mustDemonstrate: ["Justify CP vs AP choice for given requirements", "Articulate what you sacrifice and why"], commonMistakes: ["Over-simplifying real systems as purely CP or AP"] },
      { level: 6, mustDemonstrate: ["Identify when CAP framing is misleading", "Describe failure modes of CP/AP choices"], commonMistakes: ["Not considering partial failures"] },
      { level: 7, mustDemonstrate: ["Defend CAP tradeoff under interviewer pushback", "Lead with CAP reasoning unprompted"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know difference between p50, p95, p99", "Understand why tail latency matters"], commonMistakes: ["Only considering average latency"] },
      { level: 2, mustDemonstrate: ["Explain why p99 gets worse with fanout", "Calculate probability of hitting slow path"], commonMistakes: ["Ignoring tail in SLA discussions"] },
      { level: 3, mustDemonstrate: ["Explain fanout amplification effect", "Set appropriate timeouts based on percentiles"], commonMistakes: ["Setting timeouts based on average"] },
      { level: 4, mustDemonstrate: ["Reason about retries vs hedging trade-off", "Explain cascading failures from tail latency"], commonMistakes: ["Aggressive retries making things worse"] },
      { level: 5, mustDemonstrate: ["Design systems that bound tail latency", "Use hedged requests appropriately"], commonMistakes: ["Over-provisioning instead of fixing root cause"] },
      { level: 6, mustDemonstrate: ["Identify p99 regressions in incident scenario", "Describe mitigation strategies for latency spikes"], commonMistakes: ["Missing correlation with GC or compaction"] },
      { level: 7, mustDemonstrate: ["Lead latency discussion unprompted", "Defend latency budget allocation under pressure"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know consensus is about agreement in distributed systems", "Recognize Raft/Paxos as consensus algorithms"], commonMistakes: ["Confusing with leader election only"] },
      { level: 2, mustDemonstrate: ["Explain why consensus is hard (FLP impossibility)", "Describe quorum concept"], commonMistakes: ["Thinking consensus is just voting"] },
      { level: 3, mustDemonstrate: ["Explain Raft's leader election and log replication", "Identify when consensus is needed"], commonMistakes: ["Using consensus where eventual consistency suffices"] },
      { level: 4, mustDemonstrate: ["Explain interaction with network partitions", "Reason about liveness vs safety trade-offs"], commonMistakes: ["Assuming consensus always makes progress"] },
      { level: 5, mustDemonstrate: ["Choose appropriate consensus for requirements", "Articulate latency cost of consensus"], commonMistakes: ["Over-using consensus without considering alternatives"] },
      { level: 6, mustDemonstrate: ["Predict failure modes (split brain, stale reads)", "Describe recovery scenarios"], commonMistakes: ["Ignoring Byzantine failures when relevant"] },
      { level: 7, mustDemonstrate: ["Defend consensus choice under pressure", "Explain Raft vs Paxos trade-offs fluently"], commonMistakes: [] },
    ],
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know why systems need a single leader", "Identify leader election as a coordination problem"], commonMistakes: ["Thinking any node can be leader anytime"] },
      { level: 2, mustDemonstrate: ["Explain how nodes agree on a leader", "Describe role of heartbeats and timeouts"], commonMistakes: ["Ignoring network delays in timeout settings"] },
      { level: 3, mustDemonstrate: ["Explain split-brain scenario", "Describe fencing mechanisms"], commonMistakes: ["Not handling split-brain at all"] },
      { level: 4, mustDemonstrate: ["Choose between ZooKeeper, etcd, or Raft", "Reason about leader lease duration"], commonMistakes: ["Rolling your own leader election"] },
      { level: 5, mustDemonstrate: ["Design leader election for specific requirements", "Trade off availability vs consistency"], commonMistakes: ["Over-complicating with unnecessary coordination"] },
      { level: 6, mustDemonstrate: ["Predict failure scenarios during leader transition", "Describe graceful and ungraceful failover"], commonMistakes: ["Assuming instant failover"] },
      { level: 7, mustDemonstrate: ["Defend leader election design under pushback", "Lead with coordination concerns unprompted"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know gossip is for decentralized information spread", "Recognize use in membership and failure detection"], commonMistakes: ["Confusing with broadcast"] },
      { level: 2, mustDemonstrate: ["Explain epidemic/rumor spreading model", "Describe O(log N) convergence property"], commonMistakes: ["Expecting instant propagation"] },
      { level: 3, mustDemonstrate: ["Apply gossip for cluster membership", "Configure fanout and interval appropriately"], commonMistakes: ["Setting fanout too low for reliability"] },
      { level: 4, mustDemonstrate: ["Explain gossip vs central registry trade-offs", "Reason about consistency during network partitions"], commonMistakes: ["Using gossip for strong consistency needs"] },
      { level: 5, mustDemonstrate: ["Choose gossip for appropriate use cases", "Design protocol with right consistency guarantees"], commonMistakes: ["Over-engineering simple coordination problems"] },
      { level: 6, mustDemonstrate: ["Predict failure modes (slow convergence, zombies)", "Describe mitigation for gossip storms"], commonMistakes: ["Ignoring bandwidth overhead at scale"] },
      { level: 7, mustDemonstrate: ["Defend gossip choice under interviewer pressure", "Explain Cassandra/Dynamo gossip usage"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know LSM is used in write-heavy databases", "Recognize Cassandra, LevelDB as LSM-based"], commonMistakes: ["Confusing with B-Trees"] },
      { level: 2, mustDemonstrate: ["Explain memtable → SSTable flow", "Describe compaction purpose"], commonMistakes: ["Not understanding immutability of SSTables"] },
      { level: 3, mustDemonstrate: ["Explain write amplification causes", "Compare LSM read vs write performance"], commonMistakes: ["Ignoring compaction overhead"] },
      { level: 4, mustDemonstrate: ["Reason about leveled vs size-tiered compaction", "Explain bloom filters for read optimization"], commonMistakes: ["Not tuning compaction for workload"] },
      { level: 5, mustDemonstrate: ["Choose LSM vs B-Tree for requirements", "Trade off write amplification vs space amplification"], commonMistakes: ["Using LSM for read-heavy workloads"] },
      { level: 6, mustDemonstrate: ["Predict compaction storms and latency spikes", "Describe tombstone accumulation issues"], commonMistakes: ["Ignoring operational complexity"] },
      { level: 7, mustDemonstrate: ["Defend LSM choice under pressure", "Explain RocksDB tuning options fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know B-Trees are used in databases for indexing", "Recognize MySQL, PostgreSQL use B-Trees"], commonMistakes: ["Confusing with binary trees"] },
      { level: 2, mustDemonstrate: ["Explain why B-Trees minimize disk seeks", "Describe O(log N) lookup property"], commonMistakes: ["Not understanding page-based structure"] },
      { level: 3, mustDemonstrate: ["Explain why B-Trees are good for random reads", "Compare with LSM for write patterns"], commonMistakes: ["Using B-Trees for append-only workloads"] },
      { level: 4, mustDemonstrate: ["Reason about index selectivity", "Explain covering indexes"], commonMistakes: ["Creating too many indexes"] },
      { level: 5, mustDemonstrate: ["Choose B-Tree vs LSM for requirements", "Design composite indexes effectively"], commonMistakes: ["Ignoring write amplification from updates"] },
      { level: 6, mustDemonstrate: ["Predict fragmentation and rebalancing issues", "Describe page splits impact"], commonMistakes: ["Not considering maintenance overhead"] },
      { level: 7, mustDemonstrate: ["Defend B-Tree choice fluently", "Explain PostgreSQL vs MySQL index differences"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know inverted index maps terms to documents", "Recognize use in search engines"], commonMistakes: ["Confusing with regular database index"] },
      { level: 2, mustDemonstrate: ["Explain posting list structure", "Describe tokenization and stemming"], commonMistakes: ["Ignoring text preprocessing importance"] },
      { level: 3, mustDemonstrate: ["Explain how inverted index enables fast search", "Calculate index size vs document count"], commonMistakes: ["Not considering index update cost"] },
      { level: 4, mustDemonstrate: ["Reason about TF-IDF and relevance scoring", "Explain sharding strategies for search"], commonMistakes: ["Ignoring ranking in search design"] },
      { level: 5, mustDemonstrate: ["Design search system with inverted index", "Trade off indexing latency vs query latency"], commonMistakes: ["Real-time indexing when not needed"] },
      { level: 6, mustDemonstrate: ["Predict index corruption and recovery", "Describe segment merge strategies"], commonMistakes: ["Not planning for index rebuilds"] },
      { level: 7, mustDemonstrate: ["Defend search architecture under pressure", "Explain Elasticsearch internals fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know queues decouple producers and consumers", "Recognize Kafka, SQS, RabbitMQ"], commonMistakes: ["Confusing queues with databases"] },
      { level: 2, mustDemonstrate: ["Explain at-least-once vs at-most-once delivery", "Describe consumer groups"], commonMistakes: ["Assuming exactly-once is easy"] },
      { level: 3, mustDemonstrate: ["Choose async over sync communication", "Design idempotent consumers"], commonMistakes: ["Not handling duplicate messages"] },
      { level: 4, mustDemonstrate: ["Reason about ordering guarantees", "Explain dead letter queues"], commonMistakes: ["Expecting global ordering across partitions"] },
      { level: 5, mustDemonstrate: ["Design queue topology for requirements", "Trade off throughput vs latency vs ordering"], commonMistakes: ["Over-engineering simple use cases"] },
      { level: 6, mustDemonstrate: ["Predict queue backlog and consumer lag issues", "Describe poison message handling"], commonMistakes: ["Ignoring backpressure"] },
      { level: 7, mustDemonstrate: ["Defend messaging architecture under pressure", "Explain Kafka vs SQS trade-offs fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know distributed log is append-only ordered storage", "Recognize Kafka as distributed log"], commonMistakes: ["Confusing with message queues"] },
      { level: 2, mustDemonstrate: ["Explain log compaction vs retention", "Describe offset-based consumption"], commonMistakes: ["Not understanding offset management"] },
      { level: 3, mustDemonstrate: ["Explain partition ordering guarantees", "Apply log for event sourcing"], commonMistakes: ["Expecting global ordering"] },
      { level: 4, mustDemonstrate: ["Reason about log vs queue trade-offs", "Design consumer checkpointing"], commonMistakes: ["Replaying entire log unnecessarily"] },
      { level: 5, mustDemonstrate: ["Design event-driven architecture with logs", "Trade off retention vs storage cost"], commonMistakes: ["Treating log as permanent storage"] },
      { level: 6, mustDemonstrate: ["Predict partition imbalance and hot spots", "Describe leader election in Kafka"], commonMistakes: ["Ignoring replication factor impact"] },
      { level: 7, mustDemonstrate: ["Defend log-based architecture under pressure", "Explain Kafka internals fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know sharding splits data across machines", "Recognize sharding as scaling strategy"], commonMistakes: ["Confusing with replication"] },
      { level: 2, mustDemonstrate: ["Explain hash vs range partitioning", "Describe shard key selection"], commonMistakes: ["Choosing bad shard keys"] },
      { level: 3, mustDemonstrate: ["Apply sharding to a database design", "Calculate shard count from data size"], commonMistakes: ["Too few or too many shards"] },
      { level: 4, mustDemonstrate: ["Reason about cross-shard queries", "Explain hot spot mitigation"], commonMistakes: ["Ignoring scatter-gather cost"] },
      { level: 5, mustDemonstrate: ["Design sharding strategy for requirements", "Trade off query flexibility vs scale"], commonMistakes: ["Premature sharding"] },
      { level: 6, mustDemonstrate: ["Predict rebalancing challenges", "Describe online shard migration"], commonMistakes: ["Assuming rebalancing is simple"] },
      { level: 7, mustDemonstrate: ["Defend sharding design under pressure", "Explain Vitess/CockroachDB sharding"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know circuit breakers prevent cascade failures", "Recognize pattern from Hystrix, resilience4j"], commonMistakes: ["Confusing with retries"] },
      { level: 2, mustDemonstrate: ["Explain closed, open, half-open states", "Describe failure threshold triggers"], commonMistakes: ["Not understanding state transitions"] },
      { level: 3, mustDemonstrate: ["Apply circuit breaker to service calls", "Configure appropriate thresholds"], commonMistakes: ["Setting thresholds too sensitive or too lenient"] },
      { level: 4, mustDemonstrate: ["Reason about circuit breaker vs retry interaction", "Explain fallback strategies"], commonMistakes: ["Retrying through open breaker"] },
      { level: 5, mustDemonstrate: ["Design circuit breaker for microservices", "Trade off fail-fast vs availability"], commonMistakes: ["Opening breakers on non-critical paths"] },
      { level: 6, mustDemonstrate: ["Predict misconfigured breaker failures", "Describe monitoring and alerting"], commonMistakes: ["Silent breaker trips"] },
      { level: 7, mustDemonstrate: ["Defend circuit breaker design under pressure", "Explain bulkhead pattern interaction"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know caching reduces latency and load", "Recognize Redis, Memcached as cache systems"], commonMistakes: ["Treating cache as source of truth"] },
      { level: 2, mustDemonstrate: ["Explain cache-aside vs read/write-through", "Describe TTL-based expiration"], commonMistakes: ["Not setting TTLs"] },
      { level: 3, mustDemonstrate: ["Choose what to cache and where", "Apply cache invalidation strategies"], commonMistakes: ["Caching everything"] },
      { level: 4, mustDemonstrate: ["Reason about cache consistency", "Explain thundering herd problem"], commonMistakes: ["Ignoring cache stampede"] },
      { level: 5, mustDemonstrate: ["Design multi-layer caching strategy", "Trade off freshness vs performance"], commonMistakes: ["Over-caching causing stale data issues"] },
      { level: 6, mustDemonstrate: ["Predict cache corruption scenarios", "Describe cache warming strategies"], commonMistakes: ["Cold start after cache flush"] },
      { level: 7, mustDemonstrate: ["Defend caching architecture under pressure", "Explain cache invalidation complexity fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know CDN caches content at edge locations", "Recognize Cloudflare, CloudFront as CDNs"], commonMistakes: ["Confusing with load balancers"] },
      { level: 2, mustDemonstrate: ["Explain edge caching and origin shield", "Describe cache-control headers"], commonMistakes: ["Not setting proper cache headers"] },
      { level: 3, mustDemonstrate: ["Decide what content belongs at edge", "Configure CDN cache rules"], commonMistakes: ["Caching personalized content"] },
      { level: 4, mustDemonstrate: ["Reason about CDN cost vs latency", "Explain cache purging strategies"], commonMistakes: ["Over-purging cache"] },
      { level: 5, mustDemonstrate: ["Design CDN strategy for global users", "Trade off edge compute vs origin"], commonMistakes: ["Putting too much logic at edge"] },
      { level: 6, mustDemonstrate: ["Predict CDN failure scenarios", "Describe origin failover"], commonMistakes: ["No fallback when CDN fails"] },
      { level: 7, mustDemonstrate: ["Defend CDN architecture under pressure", "Explain edge computing trade-offs fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know load balancer distributes traffic", "Recognize L4 vs L7 load balancing"], commonMistakes: ["Confusing with DNS round-robin"] },
      { level: 2, mustDemonstrate: ["Explain round-robin, least-connections, weighted", "Describe health checks"], commonMistakes: ["Not configuring health checks"] },
      { level: 3, mustDemonstrate: ["Choose load balancing algorithm for workload", "Configure session affinity when needed"], commonMistakes: ["Using sticky sessions unnecessarily"] },
      { level: 4, mustDemonstrate: ["Reason about hot spot prevention", "Explain consistent hashing for caches"], commonMistakes: ["Uneven load distribution"] },
      { level: 5, mustDemonstrate: ["Design load balancing for microservices", "Trade off simplicity vs features"], commonMistakes: ["Over-engineering load balancer config"] },
      { level: 6, mustDemonstrate: ["Predict load balancer failure scenarios", "Describe active-passive failover"], commonMistakes: ["Single point of failure"] },
      { level: 7, mustDemonstrate: ["Defend load balancing design under pressure", "Explain service mesh load balancing"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know rate limiting protects from abuse", "Recognize per-user and global limits"], commonMistakes: ["Confusing with throttling"] },
      { level: 2, mustDemonstrate: ["Explain token bucket vs leaky bucket", "Describe sliding window algorithm"], commonMistakes: ["Not understanding algorithm trade-offs"] },
      { level: 3, mustDemonstrate: ["Apply rate limiting at API gateway", "Configure appropriate limits"], commonMistakes: ["Setting limits too tight or loose"] },
      { level: 4, mustDemonstrate: ["Reason about distributed rate limiting", "Explain eventual consistency in counters"], commonMistakes: ["Expecting exact limits in distributed setup"] },
      { level: 5, mustDemonstrate: ["Design rate limiting for multi-tenant system", "Trade off fairness vs simplicity"], commonMistakes: ["One tenant starving others"] },
      { level: 6, mustDemonstrate: ["Predict rate limit bypass scenarios", "Describe graceful degradation"], commonMistakes: ["Hard failures on limit hit"] },
      { level: 7, mustDemonstrate: ["Defend rate limiting design under pressure", "Explain adaptive rate limiting"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know consistent hashing minimizes remapping", "Recognize use in distributed caches"], commonMistakes: ["Confusing with regular hashing"] },
      { level: 2, mustDemonstrate: ["Explain hash ring and key placement", "Describe why only K/N keys move on change"], commonMistakes: ["Not understanding ring structure"] },
      { level: 3, mustDemonstrate: ["Apply consistent hashing for cache cluster", "Calculate expected key redistribution"], commonMistakes: ["Not using virtual nodes"] },
      { level: 4, mustDemonstrate: ["Reason about virtual nodes for balance", "Explain bounded-load consistent hashing"], commonMistakes: ["Uneven distribution without vnodes"] },
      { level: 5, mustDemonstrate: ["Design consistent hashing for requirements", "Trade off complexity vs load balance"], commonMistakes: ["Over-engineering simple cases"] },
      { level: 6, mustDemonstrate: ["Predict hot spot scenarios", "Describe replication on ring"], commonMistakes: ["Ignoring node heterogeneity"] },
      { level: 7, mustDemonstrate: ["Defend consistent hashing under pressure", "Explain Dynamo's approach fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know the three delivery guarantees", "Recognize at-least-once is most common"], commonMistakes: ["Assuming exactly-once is easy"] },
      { level: 2, mustDemonstrate: ["Explain why exactly-once is hard", "Describe idempotency requirement"], commonMistakes: ["Confusing message vs effect semantics"] },
      { level: 3, mustDemonstrate: ["Design idempotent operations", "Apply deduplication for at-least-once"], commonMistakes: ["Not handling retries properly"] },
      { level: 4, mustDemonstrate: ["Reason about end-to-end exactly-once", "Explain Kafka transactions"], commonMistakes: ["Thinking broker guarantees are enough"] },
      { level: 5, mustDemonstrate: ["Choose delivery guarantee for requirements", "Trade off complexity vs correctness"], commonMistakes: ["Over-engineering when idempotency suffices"] },
      { level: 6, mustDemonstrate: ["Predict duplicate processing scenarios", "Describe failure recovery with guarantees"], commonMistakes: ["Silent correctness bugs"] },
      { level: 7, mustDemonstrate: ["Defend delivery guarantee choice under pressure", "Explain two-phase commit limitations"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know replication provides fault tolerance", "Recognize leader-follower pattern"], commonMistakes: ["Confusing with sharding"] },
      { level: 2, mustDemonstrate: ["Explain sync vs async replication", "Describe replication lag"], commonMistakes: ["Assuming async is strongly consistent"] },
      { level: 3, mustDemonstrate: ["Apply leader-follower for read scaling", "Configure replication factor"], commonMistakes: ["Too few replicas"] },
      { level: 4, mustDemonstrate: ["Reason about multi-leader conflicts", "Explain quorum reads/writes"], commonMistakes: ["Ignoring conflict resolution"] },
      { level: 5, mustDemonstrate: ["Design replication strategy for requirements", "Trade off consistency vs availability"], commonMistakes: ["Wrong consistency for use case"] },
      { level: 6, mustDemonstrate: ["Predict replication lag impact", "Describe split-brain scenarios"], commonMistakes: ["No monitoring for lag"] },
      { level: 7, mustDemonstrate: ["Defend replication design under pressure", "Explain CRDTs and conflict resolution fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know failover switches to backup system", "Recognize RPO and RTO terms"], commonMistakes: ["No failover plan"] },
      { level: 2, mustDemonstrate: ["Explain RPO (data loss) vs RTO (downtime)", "Describe active-passive vs active-active"], commonMistakes: ["Confusing RPO and RTO"] },
      { level: 3, mustDemonstrate: ["Design failover for single component", "Configure health checks for automated failover"], commonMistakes: ["Manual failover only"] },
      { level: 4, mustDemonstrate: ["Reason about region-level failover", "Explain data synchronization challenges"], commonMistakes: ["Ignoring data consistency during failover"] },
      { level: 5, mustDemonstrate: ["Design disaster recovery for requirements", "Trade off cost vs recovery objectives"], commonMistakes: ["Over-engineering DR for non-critical systems"] },
      { level: 6, mustDemonstrate: ["Predict failover failure scenarios", "Describe chaos engineering for DR"], commonMistakes: ["Untested failover procedures"] },
      { level: 7, mustDemonstrate: ["Defend DR strategy under pressure", "Explain multi-region active-active fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know observability is logs, metrics, traces", "Recognize SLI/SLO concepts"], commonMistakes: ["Confusing monitoring with observability"] },
      { level: 2, mustDemonstrate: ["Explain three pillars of observability", "Describe structured logging"], commonMistakes: ["Unstructured log messages"] },
      { level: 3, mustDemonstrate: ["Design metrics for a service", "Apply distributed tracing"], commonMistakes: ["Too many or too few metrics"] },
      { level: 4, mustDemonstrate: ["Reason about alert fatigue", "Explain cardinality in metrics"], commonMistakes: ["High-cardinality label explosion"] },
      { level: 5, mustDemonstrate: ["Design observability strategy for microservices", "Trade off detail vs cost"], commonMistakes: ["Over-instrumenting"] },
      { level: 6, mustDemonstrate: ["Predict debugging challenges", "Describe correlation across systems"], commonMistakes: ["Missing trace context propagation"] },
      { level: 7, mustDemonstrate: ["Defend observability design under pressure", "Explain SLO-based alerting fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know authentication verifies identity", "Distinguish authn from authz"], commonMistakes: ["Confusing authentication and authorization"] },
      { level: 2, mustDemonstrate: ["Explain OAuth 2.0 flows", "Describe JWT structure"], commonMistakes: ["Storing sensitive data in JWT"] },
      { level: 3, mustDemonstrate: ["Apply OAuth for third-party login", "Design RBAC for API"], commonMistakes: ["Rolling own auth"] },
      { level: 4, mustDemonstrate: ["Reason about token refresh and revocation", "Explain stateless vs stateful sessions"], commonMistakes: ["No token revocation strategy"] },
      { level: 5, mustDemonstrate: ["Design auth for microservices", "Trade off security vs usability"], commonMistakes: ["Over-complicated auth flow"] },
      { level: 6, mustDemonstrate: ["Predict auth bypass scenarios", "Describe secure token storage"], commonMistakes: ["XSS/CSRF vulnerabilities"] },
      { level: 7, mustDemonstrate: ["Defend auth design under pressure", "Explain OIDC and SAML fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know multi-tenancy shares infrastructure", "Recognize isolation requirements"], commonMistakes: ["No tenant isolation"] },
      { level: 2, mustDemonstrate: ["Explain shared vs dedicated resources", "Describe tenant ID propagation"], commonMistakes: ["Missing tenant context"] },
      { level: 3, mustDemonstrate: ["Apply row-level security", "Design tenant-aware data model"], commonMistakes: ["SQL injection exposing other tenants"] },
      { level: 4, mustDemonstrate: ["Reason about noisy neighbor problem", "Explain resource quotas"], commonMistakes: ["One tenant affecting others"] },
      { level: 5, mustDemonstrate: ["Design isolation strategy for requirements", "Trade off efficiency vs isolation"], commonMistakes: ["Over-isolating small tenants"] },
      { level: 6, mustDemonstrate: ["Predict data leakage scenarios", "Describe tenant migration"], commonMistakes: ["Cross-tenant data exposure"] },
      { level: 7, mustDemonstrate: ["Defend multi-tenancy under pressure", "Explain Salesforce-style isolation fluently"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know search requires inverted index", "Recognize Elasticsearch as search engine"], commonMistakes: ["Using SQL LIKE for search"] },
      { level: 2, mustDemonstrate: ["Explain crawling, indexing, ranking pipeline", "Describe basic relevance scoring"], commonMistakes: ["Ignoring ranking complexity"] },
      { level: 3, mustDemonstrate: ["Design basic search architecture", "Apply sharding for index"], commonMistakes: ["Single node search at scale"] },
      { level: 4, mustDemonstrate: ["Reason about freshness vs relevance", "Explain query understanding"], commonMistakes: ["No near-realtime indexing consideration"] },
      { level: 5, mustDemonstrate: ["Design search for specific requirements", "Trade off recall vs precision"], commonMistakes: ["Over-optimizing one metric"] },
      { level: 6, mustDemonstrate: ["Predict search quality degradation", "Describe search abuse scenarios"], commonMistakes: ["No spam detection"] },
      { level: 7, mustDemonstrate: ["Lead search design discussion", "Defend architecture under interviewer pressure"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know read-heavy means more reads than writes", "Recognize caching as key strategy"], commonMistakes: ["Optimizing writes for read-heavy system"] },
      { level: 2, mustDemonstrate: ["Explain caching and read replicas", "Describe cache invalidation strategies"], commonMistakes: ["Not planning for cache misses"] },
      { level: 3, mustDemonstrate: ["Design multi-tier caching", "Apply read replicas for scale"], commonMistakes: ["Single cache layer"] },
      { level: 4, mustDemonstrate: ["Reason about cache consistency", "Explain CDN for static content"], commonMistakes: ["Stale data in cache too long"] },
      { level: 5, mustDemonstrate: ["Design for specific read pattern", "Trade off consistency vs latency"], commonMistakes: ["Over-caching mutable data"] },
      { level: 6, mustDemonstrate: ["Predict cache stampede scenarios", "Describe cache warming strategies"], commonMistakes: ["Cold cache after failure"] },
      { level: 7, mustDemonstrate: ["Lead read-heavy design discussion", "Defend architecture under pressure"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know write-heavy means high write throughput", "Recognize LSM trees for writes"], commonMistakes: ["Using B-Tree for write-heavy"] },
      { level: 2, mustDemonstrate: ["Explain write batching and buffering", "Describe async vs sync writes"], commonMistakes: ["Sync writes for all operations"] },
      { level: 3, mustDemonstrate: ["Design write path with queues", "Apply write-ahead logging"], commonMistakes: ["No durability guarantees"] },
      { level: 4, mustDemonstrate: ["Reason about consistency relaxation", "Explain eventual consistency trade-offs"], commonMistakes: ["Strong consistency when not needed"] },
      { level: 5, mustDemonstrate: ["Design for burst write patterns", "Trade off latency vs throughput"], commonMistakes: ["Not handling backpressure"] },
      { level: 6, mustDemonstrate: ["Predict write amplification issues", "Describe compaction storms"], commonMistakes: ["Ignoring storage overhead"] },
      { level: 7, mustDemonstrate: ["Lead write-heavy design discussion", "Defend architecture under pressure"], commonMistakes: [] },
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
    masterySpec: [
      { level: 0, mustDemonstrate: [], commonMistakes: [] },
      { level: 1, mustDemonstrate: ["Know on-prem means no cloud managed services", "Recognize operational differences"], commonMistakes: ["Assuming cloud patterns apply directly"] },
      { level: 2, mustDemonstrate: ["Explain capacity planning needs", "Describe hardware failure handling"], commonMistakes: ["No spare capacity planning"] },
      { level: 3, mustDemonstrate: ["Design with fixed capacity", "Apply manual failover procedures"], commonMistakes: ["Assuming auto-scaling"] },
      { level: 4, mustDemonstrate: ["Reason about upgrade strategies", "Explain blue-green on-prem"], commonMistakes: ["Big bang deployments"] },
      { level: 5, mustDemonstrate: ["Design for on-prem constraints", "Trade off cost vs redundancy"], commonMistakes: ["Over-provisioning or under-provisioning"] },
      { level: 6, mustDemonstrate: ["Predict hardware failure scenarios", "Describe disaster recovery on-prem"], commonMistakes: ["No DR site"] },
      { level: 7, mustDemonstrate: ["Lead on-prem design discussion", "Explain hybrid cloud trade-offs"], commonMistakes: [] },
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

/**
 * Get all practice problems that require a given concept.
 */
export function getPracticeProblemsForConcept(conceptId: string): PracticeProblem[] {
  return PRACTICE_PROBLEMS_V1.filter((p) => p.requiredConceptIds.includes(conceptId));
}

/**
 * Get a practice problem by ID.
 */
export function getPracticeProblemById(problemId: string): PracticeProblem | undefined {
  return PRACTICE_PROBLEMS_V1.find((p) => p.id === problemId);
}

/**
 * Get a concept by ID from the canonical list.
 */
export function getConceptById(conceptId: string): ConceptV2 | undefined {
  return CONCEPT_V2.find((c) => c.id === conceptId);
}

/**
 * Build a map of concept ID to concept for fast lookups.
 */
export function getConceptMap(): Map<string, ConceptV2> {
  return new Map(CONCEPT_V2.map((c) => [c.id, c]));
}

/**
 * Build a map of problem ID to problem for fast lookups.
 */
export function getProblemMap(): Map<string, PracticeProblem> {
  return new Map(PRACTICE_PROBLEMS_V1.map((p) => [p.id, p]));
}

/**
 * Get the mastery spec for a concept by ID.
 */
export function getMasterySpec(conceptId: string): LevelExpectation[] | undefined {
  const concept = CONCEPT_V2.find((c) => c.id === conceptId);
  return concept?.masterySpec;
}

/**
 * Get the level expectation for a specific concept and level.
 */
export function getLevelExpectation(conceptId: string, level: MasteryLevel): LevelExpectation | undefined {
  const spec = getMasterySpec(conceptId);
  return spec?.find((s) => s.level === level);
}

/**
 * Get the target level expectation for LLM generation (current level + 1, capped at 7).
 */
export function getTargetLevelExpectation(conceptId: string, currentLevel: MasteryLevel): LevelExpectation | undefined {
  const targetLevel = Math.min(currentLevel + 1, 7) as MasteryLevel;
  return getLevelExpectation(conceptId, targetLevel);
}
