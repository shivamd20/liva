import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { trpcClient } from "@/trpcClient"
import { ArrowLeft, Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { mixpanelService, MixpanelEvents } from "@/lib/mixpanel"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Mastery = "solid" | "learning" | "weak" | "unknown"
type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
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

/** Per-level expectations for a concept. */
interface LevelExpectation {
  level: MasteryLevel
  mustDemonstrate: string[]
  commonMistakes: string[]
  disqualifiers?: string[]
}

interface ProgressItem {
  conceptId: string
  name: string
  difficulty_hint?: "intro" | "core" | "advanced"
  track?: Track
  exposureCount: number
  accuracyEma: number
  stabilityScore: number
  mastery: Mastery
  masteryLevel: MasteryLevel
  /** Custom mastery level definitions for this concept. */
  masterySpec?: LevelExpectation[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_ORDER: Track[] = [
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

const TRACK_LABELS: Record<Track, string> = {
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

const DIFFICULTY_LABELS: Record<string, string> = {
  intro: "Intro",
  core: "Core",
  advanced: "Advanced",
}

/** 7-level mastery system labels. */
const MASTERY_LEVEL_LABELS: Record<MasteryLevel, string> = {
  0: "New",
  1: "Recognizer",
  2: "Explainer",
  3: "Applier",
  4: "Integrator",
  5: "Tradeoff",
  6: "Expert",
  7: "Mastered",
}

/** 7-level mastery colors for visual indicator. */
const MASTERY_LEVEL_COLORS: Record<MasteryLevel, string> = {
  0: "bg-muted-foreground/40",
  1: "bg-slate-400",
  2: "bg-blue-400",
  3: "bg-cyan-500",
  4: "bg-teal-500",
  5: "bg-amber-500",
  6: "bg-orange-500",
  7: "bg-emerald-500",
}

/** Group mastery levels into tiers for summary display. */
const getMasteryTier = (level: MasteryLevel): "beginner" | "intermediate" | "advanced" => {
  if (level <= 2) return "beginner"
  if (level <= 4) return "intermediate"
  return "advanced"
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function groupByTrack(items: ProgressItem[]): Map<Track, ProgressItem[]> {
  const groups = new Map<Track, ProgressItem[]>()
  for (const track of TRACK_ORDER) {
    const trackItems = items.filter((i) => i.track === track)
    if (trackItems.length > 0) {
      groups.set(track, trackItems.sort((a, b) => a.name.localeCompare(b.name)))
    }
  }
  return groups
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

/** Progress summary with bar and tier counts based on 7-level mastery system */
function ProgressSummary({ items }: { items: ProgressItem[] }) {
  const stats = useMemo(() => {
    let beginner = 0  // Levels 0-2: New, Recognizer, Explainer
    let intermediate = 0  // Levels 3-4: Applier, Integrator
    let advanced = 0  // Levels 5-7: Tradeoff, Expert, Mastered
    let totalScore = 0

    for (const item of items) {
      const tier = getMasteryTier(item.masteryLevel)
      if (tier === "beginner") beginner++
      else if (tier === "intermediate") intermediate++
      else advanced++
      
      // Score: each level contributes to progress (0-7 scale normalized to 0-100%)
      totalScore += item.masteryLevel
    }

    // Progress: average mastery level as percentage (max level 7 = 100%)
    const maxPossibleScore = items.length * 7
    const progress = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0
    
    return { total: items.length, beginner, intermediate, advanced, progress }
  }, [items])

  return (
    <div className="px-5 py-6">
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden mb-3">
        <div
          className="h-full bg-foreground/80 rounded-full transition-all duration-500"
          style={{ width: `${stats.progress}%` }}
        />
      </div>
      
      {/* Stats row - grouped by tiers */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5" title="Advanced (L5-7)">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {stats.advanced}
        </span>
        <span className="flex items-center gap-1.5" title="Intermediate (L3-4)">
          <span className="h-2 w-2 rounded-full bg-teal-500" />
          {stats.intermediate}
        </span>
        <span className="flex items-center gap-1.5" title="Beginner (L0-2)">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          {stats.beginner}
        </span>
      </div>
      
      {/* Progress percentage */}
      <div className="text-center mt-2">
        <span className="text-xs text-muted-foreground/60">{stats.progress}% toward interview-ready</span>
      </div>
    </div>
  )
}

/** Expandable level breakdown showing all mastery levels and progress */
function LevelBreakdown({
  masterySpec,
  currentLevel,
}: {
  masterySpec?: LevelExpectation[]
  currentLevel: MasteryLevel
}) {
  const [expanded, setExpanded] = useState(false)

  if (!masterySpec || masterySpec.length === 0) {
    return null
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          const newExpanded = !expanded
          mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_PROGRESS_LEVEL_BREAKDOWN_EXPAND, {
            expanded: newExpanded,
            currentLevel,
          })
          setExpanded(newExpanded)
        }}
        className="text-xs text-primary flex items-center gap-1"
      >
        {expanded ? "Hide" : "View"} all levels
        <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {masterySpec.map((spec) => {
            const isCompleted = spec.level < currentLevel
            const isCurrent = spec.level === currentLevel
            const isNext = spec.level === currentLevel + 1
            const isFuture = spec.level > currentLevel + 1

            return (
              <div
                key={spec.level}
                className={cn(
                  "p-3 rounded-lg border text-left",
                  isCompleted && "bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
                  isCurrent && "bg-amber-50/30 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
                  isNext && "bg-blue-50/30 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
                  isFuture && "opacity-40 border-border/50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "h-2 w-2 rounded-full",
                    MASTERY_LEVEL_COLORS[spec.level]
                  )} />
                  <span className="font-medium text-sm">
                    L{spec.level} {MASTERY_LEVEL_LABELS[spec.level]}
                  </span>
                  {isCompleted && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">✓</span>
                  )}
                  {isCurrent && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Current</span>
                  )}
                  {isNext && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Next</span>
                  )}
                </div>

                {spec.mustDemonstrate.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                    {spec.mustDemonstrate.slice(0, 3).map((d, i) => (
                      <li key={i} className="list-disc list-outside">{d}</li>
                    ))}
                    {spec.mustDemonstrate.length > 3 && (
                      <li className="text-muted-foreground/60">+{spec.mustDemonstrate.length - 3} more...</li>
                    )}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Single concept row - displays progress info */
function ConceptRow({
  item,
  expanded,
  onToggle,
}: {
  item: ProgressItem
  expanded: boolean
  onToggle: () => void
}) {
  // Use 7-level mastery color
  const masteryColor = MASTERY_LEVEL_COLORS[item.masteryLevel]

  // Get next level unlock hint from mastery spec
  const nextLevel = Math.min(item.masteryLevel + 1, 7) as MasteryLevel
  const nextSpec = item.masterySpec?.find(s => s.level === nextLevel)
  const nextUnlockHint = nextSpec?.mustDemonstrate[0]

  const subtitle = [
    item.difficulty_hint && DIFFICULTY_LABELS[item.difficulty_hint],
    `L${item.masteryLevel} ${MASTERY_LEVEL_LABELS[item.masteryLevel]}`,
  ].filter(Boolean).join(" · ")

  return (
    <div className="bg-card/50 transition-colors">
      {/* Main row - tappable */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 min-h-[56px] text-left active:bg-muted/30 transition-colors"
      >
        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", masteryColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {nextUnlockHint && item.masteryLevel < 7 && (
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 truncate">
              Next: {nextUnlockHint}
            </p>
          )}
        </div>
        <ChevronDown 
          className={cn(
            "h-5 w-5 text-muted-foreground/60 transition-transform shrink-0",
            expanded && "rotate-180"
          )} 
        />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-border/30">
          {/* Stats */}
          <div className="py-3 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold">{item.exposureCount}</p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{Math.round(item.accuracyEma * 100)}%</p>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{Math.round(item.stabilityScore * 100)}%</p>
              <p className="text-xs text-muted-foreground">Stability</p>
            </div>
          </div>

          {/* Level breakdown - expandable view of all mastery levels */}
          <LevelBreakdown
            masterySpec={item.masterySpec}
            currentLevel={item.masteryLevel}
          />
        </div>
      )}
    </div>
  )
}

/** Sticky track section header */
function TrackHeader({ track, count }: { track: Track; count: number }) {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-5 py-3 border-b border-border/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {TRACK_LABELS[track]}
        </span>
        <span className="text-xs text-muted-foreground/60">
          {count} concepts
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgressViewProps {
  onBack: () => void
}

export function ProgressView({ onBack }: ProgressViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Fetch progress
  const { data: progressData, isLoading, isError } = useQuery({
    queryKey: ["system-shots", "progress"],
    queryFn: () => trpcClient.systemShots.getProgress.query(),
  })

  const items = progressData?.items ?? []
  const groupedItems = useMemo(() => groupByTrack(items), [items])

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
      {/* Minimal header */}
      <div className="shrink-0 flex items-center justify-between px-2 py-2 border-b border-border/30">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-2 -ml-1 text-primary active:opacity-70"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-[17px]">Back</span>
        </button>
        
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold">
          Learning
        </h1>
        
        <div className="w-20" />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading && (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="flex min-h-[50vh] items-center justify-center px-8">
            <p className="text-center text-muted-foreground">
              Could not load progress. Pull down to retry.
            </p>
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <>
            {/* Progress summary */}
            <ProgressSummary items={items} />

            {/* Concepts grouped by track */}
            {Array.from(groupedItems.entries()).map(([track, trackItems]) => (
              <div key={track}>
                <TrackHeader track={track} count={trackItems.length} />
                <div className="divide-y divide-border/30">
                  {trackItems.map((item) => (
                    <ConceptRow
                      key={item.conceptId}
                      item={item}
                      expanded={expandedId === item.conceptId}
                      onToggle={() => {
                        const willExpand = expandedId !== item.conceptId
                        if (willExpand) {
                          mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_PROGRESS_CONCEPT_EXPAND, {
                            conceptId: item.conceptId,
                            conceptName: item.name,
                            track: item.track,
                            masteryLevel: item.masteryLevel,
                            exposureCount: item.exposureCount,
                          })
                        }
                        setExpandedId(expandedId === item.conceptId ? null : item.conceptId)
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
            
            {/* Bottom padding for safe area */}
            <div className="h-8" />
          </>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="flex min-h-[50vh] items-center justify-center px-8">
            <p className="text-center text-muted-foreground">
              No concepts yet. Answer some questions to see your progress.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
