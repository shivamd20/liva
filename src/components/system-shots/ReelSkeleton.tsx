import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const skeletonCardClass =
  "w-full max-w-2xl min-w-0 mx-auto rounded-2xl border-0 bg-card/95 shadow-2xl shadow-black/5 dark:shadow-black/20"

/** Neutral skeleton color (avoids bright accent blue). */
const skeletonBarClass = "bg-muted animate-pulse"

/** Reusable skeleton for reel-shaped loading state: card shape with header + option bars + bottom block. */
export function ReelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(skeletonCardClass, "flex flex-col gap-6 py-6", className)}
      aria-hidden
    >
      {/* Header: title placeholder */}
      <div className="space-y-2 pb-2 pt-3 px-3 min-w-0 sm:pb-6 sm:pt-8 sm:px-8 md:px-10">
        <Skeleton className={cn("h-5 w-full max-w-[90%] rounded-lg", skeletonBarClass)} />
        <Skeleton className={cn("h-5 max-w-[85%] w-full rounded-lg", skeletonBarClass)} />
      </div>

      {/* Content: option-shaped bars (mirror ReelMCQ options) */}
      <div className="space-y-2 px-3 pb-4 min-w-0 sm:space-y-3 sm:px-8 sm:pb-10 md:px-10">
        <ul className="space-y-2 min-w-0 sm:space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <li key={i} className="min-w-0">
              <Skeleton
                className={cn(
                  "h-10 w-full rounded-2xl sm:min-h-[52px] sm:h-[52px]",
                  skeletonBarClass
                )}
              />
            </li>
          ))}
        </ul>

        {/* Bottom block: reserved height to reduce layout shift when real card loads */}
        <div className="min-h-[4.5rem] flex flex-col justify-end gap-2 pt-2">
          <Skeleton className={cn("h-3 max-w-[66%] w-full rounded-md", skeletonBarClass)} />
          <Skeleton className={cn("h-9 w-full rounded-full", skeletonBarClass)} />
        </div>
      </div>
    </div>
  )
}
