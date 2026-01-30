import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react"
import { useNavigate, useSearchParams, useLocation } from "react-router-dom"
import BoardsHeader from "./boards-header"
import BoardsFilters from "./boards-filters"
import BoardsGrid from "./boards-grid"
import EmptyState from "./empty-state"
import { LoadingScreen } from "../LoadingScreen"

// Lazy load heavy conditional views to reduce initial bundle size
const IntegrationsPage = lazy(() => import("../IntegrationsPage"))
const VideosPage = lazy(() => import("../videos/VideosPage"))
const SystemShotsPage = lazy(() => import("@/components/system-shots/SystemShotsPage"))
import { useBoardsList, useUpdateBoard, useDeleteBoard, useDuplicateBoard, useRemoveSharedBoard } from "../../hooks/useBoards"
import { Board } from "../../types"
import { BoardIndexEntry } from "../../boards"
import * as Dialog from "@radix-ui/react-dialog"
import { X, AlertTriangle, Copy, Plus, Loader2 } from "lucide-react"
import { HistoryModal } from "../HistoryModal"
import { useSession, signIn } from "../../lib/auth-client"
import { mixpanelService, MixpanelEvents } from "../../lib/mixpanel"
import { LandingPageContent } from "../../components/LandingPage"
import Footer from "../../components/footer"
import { ChevronDown, ChevronUp } from "lucide-react"

export default function BoardsPage() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchParams, setSearchParams] = useSearchParams()

  const isIntegrationsView = location.pathname === '/app/integrations';
  const isVideosView = location.pathname === '/app/videos';
  const isSystemShotsView = location.pathname === '/app/system-shots';

  // Filter state
  const [filter, setFilter] = useState<"all" | "owned" | "shared">("all")
  const [sortBy, setSortBy] = useState<"lastAccessed" | "lastUpdated" | "alphabetical" | "created">("lastAccessed")
  const [visibility, setVisibility] = useState<"all" | "public" | "private">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Use paginated boards list
  const {
    data: boardsData,
    isPending: isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useBoardsList({
    search: debouncedSearch || undefined,
    filter,
    visibility,
    sortBy,
    sortOrder: sortBy === 'alphabetical' ? 'asc' : 'desc',
  })

  const updateBoard = useUpdateBoard()
  const deleteBoard = useDeleteBoard()
  const duplicateBoard = useDuplicateBoard()
  const removeSharedBoard = useRemoveSharedBoard()

  // Flatten paginated data
  const boardEntries = useMemo(() => {
    if (!boardsData?.pages) return []
    return boardsData.pages.flatMap(page => page.items)
  }, [boardsData])

  const totalCount = boardsData?.pages?.[0]?.totalCount ?? 0

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (isFetchingNextPage) return
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage()
      }
    })

    if (node) observerRef.current.observe(node)
  }, [isFetchingNextPage, hasNextPage, fetchNextPage])

  // Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isRemoveSharedModalOpen, setIsRemoveSharedModalOpen] = useState(false)

  const [isLearnMoreExpanded, setIsLearnMoreExpanded] = useState(false)

  // Selected board states
  const [boardToDelete, setBoardToDelete] = useState<{ id: string; title: string } | null>(null)
  const [boardToRename, setBoardToRename] = useState<BoardIndexEntry | null>(null)
  const [boardToDuplicate, setBoardToDuplicate] = useState<BoardIndexEntry | null>(null)
  const [boardForHistory, setBoardForHistory] = useState<{ id: string; title: string } | null>(null)
  const [boardToRemove, setBoardToRemove] = useState<BoardIndexEntry | null>(null)

  // Input states
  const [renameTitle, setRenameTitle] = useState("")
  const [duplicateTitle, setDuplicateTitle] = useState("")

  // Check for create param and redirect if needed (legacy support or deep links)
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      navigate('/new', { replace: true });
    }
  }, [searchParams, navigate]);

  // Convert entry to Board for mutations that need it
  const entryToBoard = (entry: BoardIndexEntry): Board => ({
    id: entry.noteId,
    title: entry.title || 'Untitled',
    content: '',
    excalidrawElements: [],
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    userId: entry.ownerUserId,
    access: entry.visibility,
  })

  // Handlers
  const handleRenameClick = (entry: BoardIndexEntry) => {
    setBoardToRename(entry)
    setRenameTitle(entry.title || "Untitled")
    setIsRenameModalOpen(true)
  }

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTitle.trim() || !boardToRename) return

    const board = entryToBoard(boardToRename)
    updateBoard.mutate({ ...board, title: renameTitle.trim() }, {
      onSuccess: () => {
        setIsRenameModalOpen(false)
        setBoardToRename(null)
        setRenameTitle("")
        mixpanelService.track(MixpanelEvents.BOARD_RENAME, { boardId: boardToRename.noteId, newTitle: renameTitle.trim() });
      }
    })
  }

  const handleDeleteClick = (entry: BoardIndexEntry) => {
    setBoardToDelete({ id: entry.noteId, title: entry.title || 'Untitled' })
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (boardToDelete) {
      deleteBoard.mutate(boardToDelete.id)
      mixpanelService.track(MixpanelEvents.BOARD_DELETE, { boardId: boardToDelete.id, source: 'Boards Page' });
      setIsDeleteModalOpen(false)
      setBoardToDelete(null)
    }
  }

  const handleDuplicateClick = (entry: BoardIndexEntry) => {
    setBoardToDuplicate(entry)
    setDuplicateTitle(`${entry.title || 'Untitled'} (Copy)`)
    setIsDuplicateModalOpen(true)
  }

  const handleDuplicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!duplicateTitle.trim() || !boardToDuplicate) return

    // Need to fetch full board content for duplication
    const board = entryToBoard(boardToDuplicate)
    duplicateBoard.mutate({ board, title: duplicateTitle.trim() }, {
      onSuccess: () => {
        setIsDuplicateModalOpen(false)
        setBoardToDuplicate(null)
        setDuplicateTitle("")
        mixpanelService.track(MixpanelEvents.BOARD_DUPLICATE, { sourceId: boardToDuplicate.noteId });
      }
    })
  }

  const handleHistoryClick = (entry: BoardIndexEntry) => {
    setBoardForHistory({ id: entry.noteId, title: entry.title || "Untitled" })
    mixpanelService.track(MixpanelEvents.BOARD_HISTORY_OPEN, { boardId: entry.noteId, source: 'Boards Page' });
    setIsHistoryModalOpen(true)
  }

  const handleRemoveSharedClick = (entry: BoardIndexEntry) => {
    setBoardToRemove(entry)
    setIsRemoveSharedModalOpen(true)
  }

  const handleRemoveSharedConfirm = () => {
    if (boardToRemove) {
      removeSharedBoard.mutate(boardToRemove.noteId, {
        onSuccess: () => {
          setIsRemoveSharedModalOpen(false)
          setBoardToRemove(null)
        }
      })
    }
  }

  const isEmpty = totalCount === 0 && !isLoading

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isSystemShotsView) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <Suspense fallback={<LoadingScreen />}>
          <SystemShotsPage onBack={() => navigate("/boards")} />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="min-h-screen min-w-screen bg-background text-foreground">
      <BoardsHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {isIntegrationsView ? (
            <Suspense fallback={<LoadingScreen />}>
              <IntegrationsPage />
            </Suspense>
          ) : isVideosView ? (
            <Suspense fallback={<LoadingScreen />}>
              <VideosPage />
            </Suspense>
          ) : (
            <>
              <section className="mb-12">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                  <div className="space-y-3">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground text-balance">
                      Your boards
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-xl text-pretty leading-relaxed">
                      Create, organize, and revisit your collaborative whiteboards. Premium real-time boards backed by
                      Cloudflare Durable Objects.
                    </p>
                  </div>

                  {!isEmpty && (
                    <button
                      className="group relative inline-flex items-center gap-2.5 px-6 py-3.5 text-base font-semibold text-primary-foreground rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
                      onClick={() => navigate('/new')}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-accent to-blue-500 rounded-2xl transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-r from-accent to-blue-500 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
                      <span className="relative z-10 flex items-center gap-2.5">
                        <Plus className="w-5 h-5" />
                        Create new board
                      </span>
                    </button>
                  )}
                </div>
              </section>



              {/* Check if any filters are applied */}
              {(() => {
                const hasFiltersApplied = debouncedSearch || filter !== 'all' || visibility !== 'all';
                const noResults = boardEntries.length === 0 && !isLoading;

                if (noResults && !hasFiltersApplied) {
                  // No boards at all - show full empty state
                  return (
                    <div className="space-y-16">
                      <EmptyState onCreateClick={() => navigate('/new')} />
                      <div id="learn-more" className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-background px-3 text-base font-semibold leading-6 text-gray-900">Learn More About Liva</span>
                        </div>
                      </div>
                      <LandingPageContent />
                    </div>
                  );
                }

                if (noResults && hasFiltersApplied) {
                  // Filters applied but no results
                  return (
                    <>
                      <BoardsFilters
                        filter={filter}
                        onFilterChange={setFilter}
                        sortBy={sortBy}
                        onSortChange={setSortBy}
                        visibility={visibility}
                        onVisibilityChange={setVisibility}
                      />
                      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">No results found</h3>
                        <p className="text-muted-foreground max-w-sm mb-6">
                          {debouncedSearch
                            ? `No boards matching "${debouncedSearch}"`
                            : "No boards match your current filters"}
                        </p>
                        <button
                          onClick={() => {
                            setSearchQuery('')
                            setFilter('all')
                            setVisibility('all')
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Clear all filters
                        </button>
                      </div>
                    </>
                  );
                }

                // Has boards - show normal view
                return (
                  <>
                    <BoardsFilters
                      filter={filter}
                      onFilterChange={setFilter}
                      sortBy={sortBy}
                      onSortChange={setSortBy}
                      visibility={visibility}
                      onVisibilityChange={setVisibility}
                    />
                    <BoardsGrid
                      entries={boardEntries}
                      onCreateClick={() => navigate('/new')}
                      onRename={handleRenameClick}
                      onDelete={handleDeleteClick}
                      onDuplicate={handleDuplicateClick}
                      onHistory={handleHistoryClick}
                      onRemoveShared={handleRemoveSharedClick}
                    />

                    {/* Load more trigger */}
                    {hasNextPage && (
                      <div
                        ref={loadMoreRef}
                        className="flex justify-center py-8"
                      >
                        {isFetchingNextPage && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Loading more boards...</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-24 pt-12 border-t border-border">
                      <div className="flex justify-center mb-8">
                        <button
                          onClick={() => setIsLearnMoreExpanded(!isLearnMoreExpanded)}
                          className="flex items-center gap-2 px-6 py-3 rounded-full bg-secondary/50 hover:bg-secondary text-foreground font-medium transition-colors"
                        >
                          {isLearnMoreExpanded ? (
                            <>
                              Hide Details <ChevronUp className="w-4 h-4" />
                            </>
                          ) : (
                            <>
                              Learn More About Liva <ChevronDown className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>

                      {isLearnMoreExpanded && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                          <LandingPageContent />
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      </main>
      <Footer />

      {/* Delete Confirmation Modal */}
      <Dialog.Root open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md z-50 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <Dialog.Title className="text-xl font-bold text-gray-900 mb-2">
                Delete Board?
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete <span className="font-semibold text-gray-900">"{boardToDelete?.title}"</span>? This action cannot be undone.
              </Dialog.Description>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteBoard.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteBoard.isPending ? 'Deleting...' : 'Delete Board'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Remove Shared Board Modal */}
      <Dialog.Root open={isRemoveSharedModalOpen} onOpenChange={setIsRemoveSharedModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md z-50 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-amber-600" />
              </div>
              <Dialog.Title className="text-xl font-bold text-gray-900 mb-2">
                Remove from Your List?
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-600 mb-6">
                Remove <span className="font-semibold text-gray-900">"{boardToRemove?.title || 'Untitled'}"</span> from your boards? You can access it again via the share link.
              </Dialog.Description>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setIsRemoveSharedModalOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveSharedConfirm}
                  disabled={removeSharedBoard.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {removeSharedBoard.isPending ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Rename Board Modal */}
      <Dialog.Root open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md z-50 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-xl font-bold text-gray-900">Rename Board</Dialog.Title>
              <button
                onClick={() => setIsRenameModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label htmlFor="renameTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Board Title
                </label>
                <input
                  id="renameTitle"
                  type="text"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  placeholder="Enter board name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-900"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameTitle.trim() || updateBoard.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:from-[#2563EB] hover:to-[#0891B2] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                  {updateBoard.isPending ? 'Renaming...' : 'Rename Board'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Duplicate Board Modal */}
      <Dialog.Root open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md z-50 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-xl font-bold text-gray-900">Duplicate Board</Dialog.Title>
              <button
                onClick={() => setIsDuplicateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Dialog.Description className="text-sm text-gray-600 mb-4">
              Creating a copy of <span className="font-semibold text-gray-900">"{boardToDuplicate?.title || 'Untitled'}"</span>
            </Dialog.Description>
            <form onSubmit={handleDuplicateSubmit} className="space-y-4">
              <div>
                <label htmlFor="duplicateTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  New Board Title
                </label>
                <input
                  id="duplicateTitle"
                  type="text"
                  value={duplicateTitle}
                  onChange={(e) => setDuplicateTitle(e.target.value)}
                  placeholder="Enter name for duplicated board"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-900"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsDuplicateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!duplicateTitle.trim() || duplicateBoard.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:from-[#2563EB] hover:to-[#0891B2] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                >
                  {duplicateBoard.isPending ? (
                    <>Duplicating...</>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Duplicate Board
                    </>
                  )}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* History Modal */}
      {boardForHistory && (
        <HistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => {
            setIsHistoryModalOpen(false)
            setBoardForHistory(null)
          }}
          boardId={boardForHistory.id}
          boardTitle={boardForHistory.title}
        />
      )}
    </div>
  )
}
