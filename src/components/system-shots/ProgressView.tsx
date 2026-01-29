import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { trpcClient } from "@/trpcClient"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Mastery bucket from API. */
type Mastery = "solid" | "learning" | "weak" | "unknown"

/** Track from API (v2). Must match server/system-shots/types.ts */
type Track =
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

/** Concept type from API (v2). */
type ConceptType = "principle" | "primitive" | "pattern" | "system"

/** Progress item shape from getProgress API (v2: includes type, track, difficulty_hint). */
interface ProgressItem {
  conceptId: string
  name: string
  difficultyTier?: number
  difficulty_hint?: "intro" | "core" | "advanced"
  type?: ConceptType
  track?: Track
  exposureCount: number
  accuracyEma: number
  failureStreak: number
  lastAt: number
  mastery: Mastery
}

const MASTERY_ORDER: Mastery[] = ["solid", "learning", "weak", "unknown"]
const MASTERY_LABELS: Record<Mastery, string> = {
  solid: "Solid",
  learning: "Learning",
  weak: "Weak",
  unknown: "Up next",
}

/** Human-readable track labels for filters and cards. */
const TRACK_LABELS: Record<Track, string> = {
  foundations: "Foundations",
  "distributed-systems": "Distributed Systems",
  storage: "Storage",
  "messaging-streaming": "Messaging & Streaming",
  scalability: "Scalability",
  reliability: "Reliability",
  "latency-performance": "Latency & Performance",
  "data-modeling": "Data Modeling",
  "system-archetypes": "System Archetypes",
  "deployment-environments": "Deployment",
  operability: "Operability",
  security: "Security",
}

const TYPE_LABELS: Record<ConceptType, string> = {
  principle: "Principle",
  primitive: "Primitive",
  pattern: "Pattern",
  system: "System",
}

const DIFFICULTY_LABELS: Record<"intro" | "core" | "advanced", string> = {
  intro: "Intro",
  core: "Core",
  advanced: "Advanced",
}

function groupByMastery(items: ProgressItem[]): Record<Mastery, ProgressItem[]> {
  const groups: Record<Mastery, ProgressItem[]> = {
    solid: [],
    learning: [],
    weak: [],
    unknown: [],
  }
  for (const item of items) {
    groups[item.mastery].push(item)
  }
  return groups
}

/** Get unique tracks present in items, sorted by display order. */
function getTracksInItems(items: ProgressItem[]): Track[] {
  const order: Track[] = [
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
  const seen = new Set(items.map((i) => i.track).filter(Boolean) as Track[])
  return order.filter((t) => seen.has(t))
}

export interface ProgressViewProps {
  onBack: () => void
}

export function ProgressView({ onBack }: ProgressViewProps) {
  const [trackFilter, setTrackFilter] = useState<Track | "all">("all")
  const [typeFilter, setTypeFilter] = useState<ConceptType | "all">("all")

  const { data, isLoading, isError } = useQuery({
    queryKey: ["system-shots", "progress"],
    queryFn: () => trpcClient.systemShots.getProgress.query(),
  })

  const items = data?.items ?? []
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (trackFilter !== "all" && item.track !== trackFilter) return false
      if (typeFilter !== "all" && item.type !== typeFilter) return false
      return true
    })
  }, [items, trackFilter, typeFilter])

  const groups = groupByMastery(filteredItems)
  const tracksInData = useMemo(() => getTracksInItems(items), [items])

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
      <div className="fixed top-0 left-0 right-0 z-30 h-0.5 w-full bg-muted/40" aria-hidden />

      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="fixed top-5 left-5 z-20 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-background/70 text-foreground shadow-sm backdrop-blur-md hover:bg-background/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] touch-manipulation transition-all duration-200"
        aria-label="Back to reels"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden pt-16 pb-8 px-4 sm:px-6">
        {isLoading && (
          <div className="flex min-h-[40dvh] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Loading progress…</p>
            </div>
          </div>
        )}

        {isError && (
          <div className="flex min-h-[40dvh] w-full items-center justify-center">
            <p className="text-muted-foreground">Could not load progress. Try again later.</p>
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Summary */}
            <section aria-label="Progress summary">
              <p className="text-sm text-muted-foreground font-medium">
                {MASTERY_ORDER.map((m) => {
                  const count = groups[m].length
                  const label = MASTERY_LABELS[m]
                  return count > 0 ? `${count} ${label}` : null
                })
                  .filter(Boolean)
                  .join(" · ")}
                {(trackFilter !== "all" || typeFilter !== "all") && (
                  <span className="ml-1">(filtered)</span>
                )}
              </p>
            </section>

            {/* Track filter */}
            <section aria-label="Filter by track">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Track
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTrackFilter("all")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    trackFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  All
                </button>
                {tracksInData.map((track) => (
                  <button
                    key={track}
                    type="button"
                    onClick={() => setTrackFilter(track)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      trackFilter === track
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {TRACK_LABELS[track]}
                  </button>
                ))}
              </div>
            </section>

            {/* Type filter */}
            <section aria-label="Filter by type">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Type
              </p>
              <div className="flex flex-wrap gap-2">
                {(["all", "principle", "primitive", "pattern", "system"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      typeFilter === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {t === "all" ? "All" : TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </section>

            {/* Mastery sections */}
            <div className="space-y-6">
              {MASTERY_ORDER.map((mastery) => {
                const list = groups[mastery]
                if (list.length === 0) return null
                const label = MASTERY_LABELS[mastery]
                return (
                  <section key={mastery} aria-labelledby={`progress-${mastery}`}>
                    <h2
                      id={`progress-${mastery}`}
                      className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3"
                    >
                      {label}
                    </h2>
                    <ul className="space-y-2">
                      {list.map((item) => (
                        <li
                          key={item.conceptId}
                          className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card/50 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-1.5 min-w-[0.375rem] max-w-12 shrink-0 rounded-full",
                                mastery === "solid" && "bg-emerald-500/80",
                                mastery === "learning" && "bg-amber-500/70",
                                mastery === "weak" && "bg-orange-500/70",
                                mastery === "unknown" && "bg-muted-foreground/30"
                              )}
                              style={{
                                width:
                                  mastery === "unknown"
                                    ? "0.375rem"
                                    : `${Math.max(8, Math.round(item.accuracyEma * 48))}px`,
                              }}
                              aria-hidden
                            />
                            <span className="text-sm font-medium text-foreground">{item.name}</span>
                          </div>
                          {(item.track || item.type || item.difficulty_hint) && (
                            <div className="flex flex-wrap gap-1.5 pl-5">
                              {item.track && (
                                <span
                                  className="rounded bg-muted/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                                  title="Track"
                                >
                                  {TRACK_LABELS[item.track]}
                                </span>
                              )}
                              {item.type && (
                                <span
                                  className="rounded bg-muted/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                                  title="Type"
                                >
                                  {TYPE_LABELS[item.type]}
                                </span>
                              )}
                              {item.difficulty_hint && (
                                <span
                                  className="rounded bg-muted/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                                  title="Difficulty"
                                >
                                  {DIFFICULTY_LABELS[item.difficulty_hint]}
                                </span>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>

            {filteredItems.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No concepts match the selected filters.
              </p>
            )}
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="flex min-h-[40dvh] w-full items-center justify-center">
            <p className="text-muted-foreground">No concepts yet. Answer reels to see progress.</p>
          </div>
        )}
      </div>
    </div>
  )
}
