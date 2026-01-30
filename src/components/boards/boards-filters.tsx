interface BoardsFiltersProps {
  filter: "all" | "owned" | "shared"
  onFilterChange: (filter: "all" | "owned" | "shared") => void
  sortBy: "lastAccessed" | "lastUpdated" | "alphabetical" | "created"
  onSortChange: (sort: "lastAccessed" | "lastUpdated" | "alphabetical" | "created") => void
  visibility: "all" | "public" | "private"
  onVisibilityChange: (visibility: "all" | "public" | "private") => void
}

export default function BoardsFilters({
  filter,
  onFilterChange,
  sortBy,
  onSortChange,
  visibility,
  onVisibilityChange
}: BoardsFiltersProps) {
  const filters = [
    { id: "all" as const, label: "All" },
    { id: "owned" as const, label: "Owned by you" },
    { id: "shared" as const, label: "Shared with you" },
  ]

  const sortOptions = [
    { id: "lastAccessed" as const, label: "Last opened" },
    { id: "lastUpdated" as const, label: "Last updated" },
    { id: "created" as const, label: "Date created" },
    { id: "alphabetical" as const, label: "Alphabetical" },
  ]

  const visibilityOptions = [
    { id: "all" as const, label: "All visibility" },
    { id: "public" as const, label: "Public" },
    { id: "private" as const, label: "Private" },
  ]

  return (
    <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      {/* Left: Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50 ${filter === f.id
                ? "bg-foreground text-primary-foreground shadow-md"
                : "bg-foreground/[0.04] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Right: Sort and visibility dropdowns */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Sort select */}
        <div className="relative flex-shrink-0">
          <label className="sr-only" htmlFor="sort-select">Sort by</label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as typeof sortBy)}
            className="appearance-none px-4 py-2 pr-10 text-sm font-medium bg-foreground/[0.04] border border-border/50 rounded-xl text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200"
          >
            {sortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Visibility select */}
        <div className="relative flex-shrink-0">
          <label className="sr-only" htmlFor="visibility-select">Visibility</label>
          <select
            id="visibility-select"
            value={visibility}
            onChange={(e) => onVisibilityChange(e.target.value as typeof visibility)}
            className="appearance-none px-4 py-2 pr-10 text-sm font-medium bg-foreground/[0.04] border border-border/50 rounded-xl text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200"
          >
            {visibilityOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </section>
  )
}
