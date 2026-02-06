import { useRef, useEffect, useCallback } from "react"
import type { ConceptInfo } from "./types"
import { cn } from "@/lib/utils"
import { mixpanelService, MixpanelEvents } from "@/lib/mixpanel"
import {
  Menu,
  X,
  ArrowLeft,
  TrendingUp,
  RefreshCcw,
  BookOpen,
  Database,
  Network,
  MessageSquare,
  Zap,
  Table,
  Layout,
  Server,
  Activity,
  Shield,
  Lock,
  type LucideIcon,
} from "lucide-react"
import { signIn } from "@/lib/auth-client"

/** Detect anonymous user (better-auth uses temp@ or temp-*@ email pattern). */
function isAnonymousUser(user: SessionUser): boolean {
  const email = user.email ?? ""
  return email.startsWith("temp@") || /^temp-[^@]+@/.test(email)
}

const TRACK_ICONS: Record<string, LucideIcon> = {
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

function getTopicIcon(topic: ConceptInfo): LucideIcon {
  const track = topic.track
  if (track && TRACK_ICONS[track]) return TRACK_ICONS[track]
  return BookOpen
}

export interface SessionUser {
  name?: string | null
  email?: string | null
}

interface FocusSidebarProps {
  /** Whether the sidebar is open (mobile only). */
  isOpen: boolean
  /** Called to close the sidebar (mobile only). */
  onClose: () => void
  /** Available topics for the sidebar. */
  topics: ConceptInfo[]
  /** Currently focused topic ID (null = mixed/all). */
  activeTopicId: string | null
  /** Called when user selects a topic. */
  onTopicSelect: (topicId: string) => void
  /** Called when user wants to return to mixed feed. */
  onClearFocus?: () => void
  /** Called when user taps "Back". */
  onBack: () => void
  /** Called when user taps "Progress". */
  onProgress: () => void
  /** Session for auth UI - user when logged in. */
  session?: { user?: SessionUser } | null
  /** Called when user taps "Refresh" to reload feed. */
  onRefresh?: () => void
}

/**
 * Calm, minimal sidebar for Focus Mode navigation.
 *
 * Hierarchy: (1) User/Auth, (2) Navigation, (3) Topics
 */
export function FocusSidebar({
  isOpen,
  onClose,
  topics,
  activeTopicId,
  onTopicSelect,
  onClearFocus,
  onBack,
  onProgress,
  session,
  onRefresh,
}: FocusSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const handleBackdropClick = useCallback(() => {
    onClose()
  }, [onClose])

  const handleTopicClick = (topicId: string) => {
    const topic = topics.find((t) => t.id === topicId)
    mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_TOPIC_SELECT, {
      topicId,
      topicName: topic?.name,
      track: topic?.track,
    })
    onTopicSelect(topicId)
    if (window.innerWidth < 768) {
      onClose()
    }
  }

  const handleAllClick = () => {
    mixpanelService.track(MixpanelEvents.SYSTEM_SHOTS_TOPIC_CLEAR)
    onClearFocus?.()
    if (window.innerWidth < 768) {
      onClose()
    }
  }

  const handleSignInGoogle = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: window.location.pathname + window.location.search,
    })
  }

  return (
    <>
      {/* Backdrop - mobile only */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/40 transition-opacity duration-300 md:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Sidebar - pt-14 to clear hamburger (40px + 16px) */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed top-0 left-0 h-full z-50 w-56 bg-muted/30 backdrop-blur-sm",
          "flex flex-col pt-14 pb-6 px-4 overflow-y-auto overscroll-contain",
          "transition-transform duration-300 ease-out",
          "md:translate-x-0 md:z-10",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label="Topic navigation"
      >
        {/* 1. User / Auth block - show Sign in with Google when no session or anonymous */}
        <div className="flex flex-col gap-2 mb-6">
          {session?.user && !isAnonymousUser(session.user) ? (
            <div className="text-sm">
              <p className="font-medium text-foreground truncate">
                {session.user.name || session.user.email || "Signed in"}
              </p>
              {session.user.email && session.user.name && (
                <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
              )}
            </div>
          ) : (
            <button
              onClick={handleSignInGoogle}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg",
                "text-sm font-medium bg-foreground text-background",
                "hover:bg-foreground/90 transition-colors"
              )}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>
          )}
        </div>

        {/* 2. Navigation */}
        <div className="flex flex-col gap-1 mb-6">
          <button
            onClick={onBack}
            className={cn(
              "flex items-center gap-2 text-left text-sm text-muted-foreground/80 hover:text-muted-foreground",
              "transition-opacity duration-200 py-1.5"
            )}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back
          </button>
          <button
            onClick={onProgress}
            className={cn(
              "flex items-center gap-2 text-left text-sm text-muted-foreground/80 hover:text-muted-foreground",
              "transition-opacity duration-200 py-1.5"
            )}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            Progress
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={cn(
                "flex items-center gap-2 text-left text-sm text-muted-foreground/80 hover:text-muted-foreground",
                "transition-opacity duration-200 py-1.5"
              )}
            >
              <RefreshCcw className="w-4 h-4 shrink-0" />
              Refresh
            </button>
          )}
        </div>

        {/* 3. Divider */}
        <div className="h-px bg-border/30 mb-6" />

        {/* 4. Topic List */}
        <nav className="flex-1 flex flex-col gap-1">
          {onClearFocus && (
            <button
              onClick={handleAllClick}
              className={cn(
                "flex items-center gap-2 text-left py-1.5 text-sm transition-opacity duration-200",
                activeTopicId === null
                  ? "text-foreground font-medium"
                  : "text-muted-foreground/70 hover:text-muted-foreground"
              )}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              All Topics
            </button>
          )}

          {topics.map((topic) => {
            const isActive = topic.id === activeTopicId
            const Icon = getTopicIcon(topic)
            return (
              <button
                key={topic.id}
                onClick={() => handleTopicClick(topic.id)}
                className={cn(
                  "flex items-center gap-2 text-left py-1.5 text-sm transition-opacity duration-200 capitalize",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/70 hover:text-muted-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {topic.name}
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

/**
 * Hamburger button to toggle sidebar. Placed at top-left of main content.
 * Visible on mobile and desktop when sidebar is closed.
 */
export function SidebarTrigger({
  isOpen,
  onToggle,
}: {
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-lg",
        "bg-muted/50 hover:bg-muted/80 backdrop-blur-sm",
        "transition-colors duration-200",
        "md:left-4"
      )}
      aria-label={isOpen ? "Close navigation" : "Open navigation"}
    >
      {isOpen ? (
        <X className="w-5 h-5 text-muted-foreground" />
      ) : (
        <Menu className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  )
}

export default FocusSidebar
