import { useMemo, useState, useCallback, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { trpcClient } from "@/trpcClient"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Loader2, ChevronDown, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Mastery = "solid" | "learning" | "weak" | "unknown"
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

type DifficultyOverride = -1 | 0 | 1
type PriorityBias = -1 | 0 | 1

interface ProgressItem {
  conceptId: string
  name: string
  difficulty_hint?: "intro" | "core" | "advanced"
  track?: Track
  exposureCount: number
  accuracyEma: number
  mastery: Mastery
}

interface UserConceptPrefs {
  conceptId: string
  enabled: boolean
  difficultyOverride: DifficultyOverride
  priorityBias: PriorityBias
}

interface UserTopicOverlay {
  id: string
  title: string
  description: string
  mappedConceptIds: string[]
  createdAt: number
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

const MASTERY_LABELS: Record<Mastery, string> = {
  solid: "Mastered",
  learning: "Learning",
  weak: "Needs work",
  unknown: "New",
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function getDefaultPrefs(conceptId: string): UserConceptPrefs {
  return { conceptId, enabled: true, difficultyOverride: 0, priorityBias: 0 }
}

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

/** Simple progress summary with bar and counts */
function ProgressSummary({
  items,
  prefsMap,
}: {
  items: ProgressItem[]
  prefsMap: Map<string, UserConceptPrefs>
}) {
  const stats = useMemo(() => {
    let enabled = 0, solid = 0, learning = 0, weak = 0, unknown = 0

    for (const item of items) {
      const prefs = prefsMap.get(item.conceptId)
      if (prefs?.enabled === false) continue
      enabled++
      if (item.mastery === "solid") solid++
      else if (item.mastery === "learning") learning++
      else if (item.mastery === "weak") weak++
      else unknown++
    }

    const progress = enabled > 0 ? Math.round(((solid + learning * 0.5) / enabled) * 100) : 0
    return { enabled, solid, learning, weak, unknown, progress }
  }, [items, prefsMap])

  return (
    <div className="px-5 py-6">
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden mb-3">
        <div
          className="h-full bg-foreground/80 rounded-full transition-all duration-500"
          style={{ width: `${stats.progress}%` }}
        />
      </div>
      
      {/* Stats row */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {stats.solid}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {stats.learning}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          {stats.weak}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          {stats.unknown}
        </span>
      </div>
    </div>
  )
}

/** iOS-style segmented control */
function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  disabled?: boolean
}) {
  return (
    <div className={cn(
      "inline-flex rounded-lg bg-muted/50 p-1",
      disabled && "opacity-50"
    )}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-all min-h-[44px] min-w-[60px]",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground active:bg-background/50"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** Setting row for expanded concept */
function SettingRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/** Single concept row - Apple style */
function ConceptRow({
  item,
  prefs,
  expanded,
  onToggle,
  onPrefsChange,
}: {
  item: ProgressItem
  prefs: UserConceptPrefs
  expanded: boolean
  onToggle: () => void
  onPrefsChange: (prefs: UserConceptPrefs) => void
}) {
  const masteryColor = {
    solid: "bg-emerald-500",
    learning: "bg-amber-500",
    weak: "bg-orange-500",
    unknown: "bg-muted-foreground/40",
  }[item.mastery]

  const subtitle = [
    item.difficulty_hint && DIFFICULTY_LABELS[item.difficulty_hint],
    MASTERY_LABELS[item.mastery],
  ].filter(Boolean).join(" · ")

  return (
    <div className={cn(
      "bg-card/50 transition-colors",
      !prefs.enabled && "opacity-50"
    )}>
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
        </div>
        <ChevronDown 
          className={cn(
            "h-5 w-5 text-muted-foreground/60 transition-transform shrink-0",
            expanded && "rotate-180"
          )} 
        />
      </button>

      {/* Expanded settings */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-border/30">
          <SettingRow label="Include in feed">
            <Switch
              checked={prefs.enabled}
              onCheckedChange={(checked) => onPrefsChange({ ...prefs, enabled: checked })}
            />
          </SettingRow>
          
          <SettingRow label="Difficulty">
            <SegmentedControl
              value={prefs.difficultyOverride}
              onChange={(v) => onPrefsChange({ ...prefs, difficultyOverride: v })}
              options={[
                { value: -1 as const, label: "Easier" },
                { value: 0 as const, label: "Auto" },
                { value: 1 as const, label: "Harder" },
              ]}
              disabled={!prefs.enabled}
            />
          </SettingRow>
          
          <SettingRow label="Focus">
            <SegmentedControl
              value={prefs.priorityBias}
              onChange={(v) => onPrefsChange({ ...prefs, priorityBias: v })}
              options={[
                { value: -1 as const, label: "Less" },
                { value: 0 as const, label: "Normal" },
                { value: 1 as const, label: "More" },
              ]}
              disabled={!prefs.enabled}
            />
          </SettingRow>
        </div>
      )}
    </div>
  )
}

/** Sticky track section header */
function TrackHeader({ track, count, total }: { track: Track; count: number; total: number }) {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-5 py-3 border-b border-border/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {TRACK_LABELS[track]}
        </span>
        <span className="text-xs text-muted-foreground/60">
          {count}/{total}
        </span>
      </div>
    </div>
  )
}

/** Simple add topic button that expands inline */
function AddTopicSection({
  overlays,
  onAdd,
  onRemove,
}: {
  overlays: UserTopicOverlay[]
  onAdd: (title: string, description: string) => void
  onRemove: (id: string) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) return
    onAdd(title.trim(), description.trim())
    setTitle("")
    setDescription("")
    setIsAdding(false)
  }

  return (
    <div className="px-5 py-6">
      {/* Existing overlays */}
      {overlays.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Personal Topics
          </p>
          {overlays.map((o) => (
            <div key={o.id} className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{o.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{o.description}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(o.id)}
                className="p-2 -m-2 text-muted-foreground active:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add button / form */}
      {!isAdding ? (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground active:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add personal topic
        </button>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Topic name"
            autoFocus
            className="w-full bg-transparent border-b border-border/50 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description"
            className="w-full bg-transparent border-b border-border/50 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30"
          />
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="flex-1 py-3 text-sm text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!title.trim() || !description.trim()}
              className="flex-1 py-3 text-sm font-medium disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
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
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [localPrefs, setLocalPrefs] = useState<Map<string, UserConceptPrefs>>(new Map())
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch progress
  const { data: progressData, isLoading: progressLoading, isError: progressError } = useQuery({
    queryKey: ["system-shots", "progress"],
    queryFn: () => trpcClient.systemShots.getProgress.query(),
  })

  // Fetch preferences
  const { data: prefsData, isLoading: prefsLoading } = useQuery({
    queryKey: ["system-shots", "preferences"],
    queryFn: () => trpcClient.systemShots.getPreferences.query(),
  })

  // Initialize local prefs from server
  useEffect(() => {
    if (prefsData && localPrefs.size === 0) {
      const map = new Map<string, UserConceptPrefs>()
      for (const pref of prefsData.conceptPrefs) {
        map.set(pref.conceptId, pref)
      }
      setLocalPrefs(map)
    }
  }, [prefsData, localPrefs.size])

  const items = progressData?.items ?? []
  const overlays = prefsData?.topicOverlays ?? []
  const groupedItems = useMemo(() => groupByTrack(items), [items])

  // Auto-save mutation
  const saveMutation = useMutation({
    mutationFn: (prefs: UserConceptPrefs[]) =>
      trpcClient.systemShots.batchUpdateConceptPrefs.mutate({ prefs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-shots", "preferences"] })
      setIsSaving(false)
    },
    onError: () => setIsSaving(false),
  })

  // Debounced auto-save
  const scheduleAutoSave = useCallback((newPrefs: Map<string, UserConceptPrefs>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setIsSaving(true)
    saveTimeoutRef.current = setTimeout(() => {
      const changedPrefs = Array.from(newPrefs.values())
      if (changedPrefs.length > 0) {
        saveMutation.mutate(changedPrefs)
      } else {
        setIsSaving(false)
      }
    }, 800)
  }, [saveMutation])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Topic mutations
  const addOverlayMutation = useMutation({
    mutationFn: (input: { title: string; description: string; mappedConceptIds: string[] }) =>
      trpcClient.systemShots.addTopicOverlay.mutate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["system-shots", "preferences"] }),
  })

  const removeOverlayMutation = useMutation({
    mutationFn: (id: string) => trpcClient.systemShots.removeTopicOverlay.mutate({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["system-shots", "preferences"] }),
  })

  // Handlers
  const handlePrefsChange = useCallback((conceptId: string, prefs: UserConceptPrefs) => {
    setLocalPrefs((prev) => {
      const next = new Map(prev).set(conceptId, prefs)
      scheduleAutoSave(next)
      return next
    })
  }, [scheduleAutoSave])

  const handleAddOverlay = useCallback((title: string, description: string) => {
    addOverlayMutation.mutate({ title, description, mappedConceptIds: [] })
  }, [addOverlayMutation])

  const handleRemoveOverlay = useCallback((id: string) => {
    removeOverlayMutation.mutate(id)
  }, [removeOverlayMutation])

  const isLoading = progressLoading || prefsLoading

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
        
        <div className="w-20 flex justify-end pr-2">
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading && (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {progressError && (
          <div className="flex min-h-[50vh] items-center justify-center px-8">
            <p className="text-center text-muted-foreground">
              Could not load progress. Pull down to retry.
            </p>
          </div>
        )}

        {!isLoading && !progressError && items.length > 0 && (
          <>
            {/* Progress summary */}
            <ProgressSummary items={items} prefsMap={localPrefs} />

            {/* Concepts grouped by track */}
            {Array.from(groupedItems.entries()).map(([track, trackItems]) => {
              const enabledCount = trackItems.filter(
                (i) => localPrefs.get(i.conceptId)?.enabled !== false
              ).length
              
              return (
                <div key={track}>
                  <TrackHeader track={track} count={enabledCount} total={trackItems.length} />
                  <div className="divide-y divide-border/30">
                    {trackItems.map((item) => (
                      <ConceptRow
                        key={item.conceptId}
                        item={item}
                        prefs={localPrefs.get(item.conceptId) ?? getDefaultPrefs(item.conceptId)}
                        expanded={expandedId === item.conceptId}
                        onToggle={() => setExpandedId(
                          expandedId === item.conceptId ? null : item.conceptId
                        )}
                        onPrefsChange={(prefs) => handlePrefsChange(item.conceptId, prefs)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Add topics section */}
            <AddTopicSection
              overlays={overlays}
              onAdd={handleAddOverlay}
              onRemove={handleRemoveOverlay}
            />
            
            {/* Bottom padding for safe area */}
            <div className="h-8" />
          </>
        )}

        {!isLoading && !progressError && items.length === 0 && (
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
