
export interface Template {
    id: string;
    name: string;
    category: string;
    description: string;
    icon: string; // Lucide icon name or similar
    content: string;
}

export const TEMPLATES: Template[] = [
    {
        id: "gitlab-system-design",
        name: "GitLab System Design",
        category: "System Design Interview",
        description: "Design a code hosting and CI/CD platform like GitLab. Focus on consistency, storage, and scalability.",
        icon: "GitGraph",
        content: `# System Design Interview Template: GitLab (Code Hosting and CI/CD Platform)

## 1. Interviewer Goals

Guide the candidate through designing a code hosting and CI/CD system similar to GitLab. Evaluate their ability to reason about scaling, storage, consistency, architecture trade offs, and operational reliability. Maintain strict control over scope and keep the conversation aligned to core platform needs.

## 2. Problem Statement for Candidate

Design a system like GitLab that supports:

* User accounts and repositories
* Git based version control operations
* Issue tracking
* CI/CD pipelines
* Permissions and access controls
* High availability and strong durability of code

Time limit: 30 45 minutes.
All off topic explorations must be redirected.

## 3. Expected Functional Requirements

* Create and manage repositories
* Push and pull operations
* Branching and merging workflows
* Viewing commits and diffs
* Pipeline execution for builds and tests
* User authentication and role based access
* Issue and merge request management

## 4. Expected Non Functional Requirements

* High reliability for repository data
* Horizontal scalability
* Global performance considerations for git operations
* Strong storage durability guarantees
* Isolation for CI runners
* Observability and debugging support

## 5. High Level Architecture the Candidate Should Reach

* API gateway and authentication layer
* Metadata service for repositories, users, issues
* Blob storage for git objects
* Compute layer for CI runners
* Queue for pipeline orchestration
* Caching for repository metadata and CI state
* Search indexing service

## 6. Key Deep Dive Areas

Interviewer should push candidate into these areas once basics are covered:

1. Storage design for git objects and metadata
2. Consistency models for push, merge, and concurrent edits
3. Scaling CI runners and handling queue backpressure
4. Isolation and security for user provided code in pipelines
5. Repository cloning performance and geo replication
6. Disaster recovery and multi region considerations

## 7. Steering Instructions

Use these phrases and strategies to keep the interview on track:

* If candidate goes too broad: "Focus specifically on repository storage and CI pipeline execution."
* If candidate dives too deep too early: "We will get into that later. First outline the entire system."
* If candidate misses reliability: "Explain how your design survives regional failure."
* If candidate misses security: "Walk through how untrusted pipeline code is isolated."
* If candidate is hand wavy: "Be explicit about where data lives, how it moves, and what guarantees exist."

## 8. Evaluation Rubric

### Architecture clarity

* Clear layering of services
* Consistent data flow

### Core system understanding

* Understands git semantics
* Understands CI execution lifecycle

### Tradeoff articulation

* Storage format choices
* Queue and runner scaling strategies
* Caching and replication decisions

### Reliability strategy

* Backup and restore
* Regional failover
* Consistency model justification

### Communication and pacing

* Structured thinking
* Good time management

Scoring: Strong, Acceptable, Weak.

## 9. Variations the Interviewer Can Introduce

Introduce one variation only after the base design is complete:

* Multi region active active repositories
* Sandbox security hardening for CI
* Monorepo scaling problems
* Extremely large binary asset handling

## 10. Closing

Interviewer ends by asking the candidate to summarize the design and identify the biggest bottleneck in their architecture.
`
    }
];
