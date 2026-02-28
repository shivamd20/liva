import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Database,
  Network,
  MessageSquare,
  Activity,
  Shield,
  Zap,
  Table,
  Layout,
  Server,
  Lock,
} from "lucide-react"

/** Canonical track IDs for system-shots (matches server concepts). */
export type Track =
  | "foundations"
  | "distributed-systems"
  | "storage"
  | "messaging-streaming"
  | "scalability"
  | "reliability"
  | "latency-performance"
  | "data-modeling"
  | "system-archetypes"
  | "deployment-environments"
  | "operability"
  | "security"

export const TRACK_ORDER: Track[] = [
  "foundations",
  "distributed-systems",
  "storage",
  "messaging-streaming",
  "scalability",
  "reliability",
  "latency-performance",
  "data-modeling",
  "system-archetypes",
  "deployment-environments",
  "operability",
  "security",
]

export const TRACK_LABELS: Record<Track, string> = {
  foundations: "Foundations",
  "distributed-systems": "Distributed Systems",
  storage: "Storage",
  "messaging-streaming": "Messaging & Streaming",
  scalability: "Scalability",
  reliability: "Reliability",
  "latency-performance": "Performance",
  "data-modeling": "Data Modeling",
  "system-archetypes": "System Archetypes",
  "deployment-environments": "Deployment",
  operability: "Operability",
  security: "Security",
}

export const TRACK_ICONS: Record<Track, LucideIcon> = {
  foundations: BookOpen,
  "distributed-systems": Network,
  storage: Database,
  "messaging-streaming": MessageSquare,
  scalability: Activity,
  reliability: Shield,
  "latency-performance": Zap,
  "data-modeling": Table,
  "system-archetypes": Layout,
  "deployment-environments": Server,
  operability: Activity,
  security: Lock,
}
