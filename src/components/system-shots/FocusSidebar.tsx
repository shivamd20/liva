import { useRef, useEffect, useCallback } from "react"
import type { ConceptInfo } from "./types"
import { cn } from "@/lib/utils"

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
}

/**
 * Calm, minimal sidebar for Focus Mode navigation.
 * 
 * Purpose: Answer three questions only:
 * 1. Where am I?
 * 2. How am I doing?
 * 3. What topic do I want to focus on?
 * 
 * Design: Quiet, supportive, never competing with the reel.
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

    // Close on click outside (mobile)
    const handleBackdropClick = useCallback(() => {
        onClose()
    }, [onClose])

    // Handle topic selection
    const handleTopicClick = (topicId: string) => {
        onTopicSelect(topicId)
        // Close sidebar on mobile after selection
        if (window.innerWidth < 768) {
            onClose()
        }
    }

    // Handle clear focus (return to all topics)
    const handleAllClick = () => {
        onClearFocus?.()
        if (window.innerWidth < 768) {
            onClose()
        }
    }

    return (
        <>
            {/* Backdrop - mobile only, dims reel when sidebar open */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-background/40 transition-opacity duration-300 md:hidden",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={handleBackdropClick}
                aria-hidden="true"
            />

            {/* Sidebar */}
            <aside
                ref={sidebarRef}
                className={cn(
                    // Base styles - soft, neutral, narrow
                    "fixed top-0 left-0 h-full z-50 w-56 bg-muted/30 backdrop-blur-sm",
                    "flex flex-col py-6 px-4 overflow-y-auto overscroll-contain",
                    // Transition - slow, soft, no bounce
                    "transition-transform duration-300 ease-out",
                    // Desktop: always visible
                    "md:translate-x-0 md:z-10",
                    // Mobile: slide in/out
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
                role="navigation"
                aria-label="Topic navigation"
            >
                {/* 1. Utility Actions */}
                <div className="flex flex-col gap-3 mb-6">
                    <button
                        onClick={onBack}
                        className={cn(
                            "text-left text-sm text-muted-foreground/80 hover:text-muted-foreground",
                            "transition-opacity duration-200"
                        )}
                    >
                        ← Back
                    </button>
                    <button
                        onClick={onProgress}
                        className={cn(
                            "text-left text-sm text-muted-foreground/80 hover:text-muted-foreground",
                            "transition-opacity duration-200"
                        )}
                    >
                        Progress
                    </button>
                </div>

                {/* 2. Divider */}
                <div className="h-px bg-border/30 mb-6" />

                {/* 3. Topic List */}
                <nav className="flex-1 flex flex-col gap-1">
                    {/* "All Topics" option */}
                    {onClearFocus && (
                        <button
                            onClick={handleAllClick}
                            className={cn(
                                "text-left py-1.5 text-sm transition-opacity duration-200",
                                activeTopicId === null
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground/70 hover:text-muted-foreground"
                            )}
                        >
                            All Topics
                        </button>
                    )}

                    {/* Topic items */}
                    {topics.map((topic) => {
                        const isActive = topic.id === activeTopicId
                        return (
                            <button
                                key={topic.id}
                                onClick={() => handleTopicClick(topic.id)}
                                className={cn(
                                    "text-left py-1.5 text-sm transition-opacity duration-200 capitalize",
                                    isActive
                                        ? "text-foreground font-medium"
                                        : "text-muted-foreground/70 hover:text-muted-foreground"
                                )}
                            >
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
 * Mobile affordance to open the sidebar.
 * A subtle, nearly invisible touch target on the left edge.
 */
export function SidebarTrigger({ onOpen }: { onOpen: () => void }) {
    return (
        <button
            onClick={onOpen}
            className={cn(
                "fixed left-0 top-1/2 -translate-y-1/2 z-30 md:hidden",
                "w-3 h-24 rounded-r-lg",
                "bg-muted/20 hover:bg-muted/40 active:bg-muted/50",
                "transition-colors duration-200"
            )}
            aria-label="Open navigation"
        >
            {/* Subtle visual hint */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-muted-foreground/20 rounded-full" />
        </button>
    )
}

export default FocusSidebar
