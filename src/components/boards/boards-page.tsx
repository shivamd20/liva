import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import BoardsHeader from "./boards-header"
import BoardsFilters from "./boards-filters"
import BoardsGrid from "./boards-grid"
import EmptyState from "./empty-state"
import { useBoards, useCreateBoard, useUpdateBoard, useDeleteBoard, useDuplicateBoard } from "../../hooks/useBoards"
import { Board } from "../../types"
import * as Dialog from "@radix-ui/react-dialog"
import { X, AlertTriangle, Copy, Plus } from "lucide-react"
import { HistoryModal } from "../HistoryModal"
import { useSession } from "../../lib/auth-client"
import { mixpanelService, MixpanelEvents } from "../../lib/mixpanel"
import { TemplateSelection } from "./TemplateSelection"

export default function BoardsPage() {
  const { data: boards = [], isLoading } = useBoards()
  const { data: session } = useSession()
  const createBoard = useCreateBoard()
  const updateBoard = useUpdateBoard()
  const deleteBoard = useDeleteBoard()
  const duplicateBoard = useDuplicateBoard()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filter, setFilter] = useState<"all" | "owned" | "shared" | "recent">("all")
  const [sortBy, setSortBy] = useState<"lastOpened" | "lastUpdated" | "alphabetical">("lastOpened")
  const [searchQuery, setSearchQuery] = useState("")

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Check for create param
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setIsCreateModalOpen(true)
      const templateId = searchParams.get("templateId")
      if (templateId) {
        setSelectedTemplateId(templateId)
      }
      // Optional: Clear the param so it doesn't persist
      setSearchParams(params => {
        params.delete("create")
        params.delete("templateId")
        return params
      })
    }
  }, [searchParams, setSearchParams])
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // Selected board states
  const [boardToDelete, setBoardToDelete] = useState<{ id: string; title: string } | null>(null)
  const [boardToRename, setBoardToRename] = useState<Board | null>(null)
  const [boardToDuplicate, setBoardToDuplicate] = useState<Board | null>(null)
  const [boardForHistory, setBoardForHistory] = useState<{ id: string; title: string } | null>(null)

  // Input states
  const [newBoardTitle, setNewBoardTitle] = useState("")
  const [expiresInHours, setExpiresInHours] = useState(0)
  const [renameTitle, setRenameTitle] = useState("")
  const [duplicateTitle, setDuplicateTitle] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  // Filter and sort boards
  const filteredBoards = boards
    .filter((board) => {
      if (searchQuery) {
        return board.title.toLowerCase().includes(searchQuery.toLowerCase())
      }
      switch (filter) {
        case "owned":
          return session?.user?.id ? board.userId === session.user.id : true
        case "shared":
          return session?.user?.id ? board.userId !== session.user.id : false
        case "recent":
          // Show boards from last 7 days
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          return new Date(board.updatedAt) > weekAgo
        default:
          return true
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "alphabetical":
          return a.title.localeCompare(b.title)
        case "lastUpdated":
        case "lastOpened":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
    })

  const isEmpty = boards.length === 0

  // Handlers
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBoardTitle.trim()) return

    createBoard.mutate({ title: newBoardTitle.trim(), expiresInHours, templateId: selectedTemplateId ?? undefined }, {
      onSuccess: (newBoard) => {
        setIsCreateModalOpen(false)
        setNewBoardTitle("")
        setExpiresInHours(0)
        setSelectedTemplateId(null)
        mixpanelService.track(MixpanelEvents.BOARD_CREATE, { boardId: newBoard.id, templateId: selectedTemplateId });
        navigate(`/board/${newBoard.id}`)
      }
    })
  }

  const handleRenameClick = (board: Board) => {
    setBoardToRename(board)
    setRenameTitle(board.title || "Untitled")
    setIsRenameModalOpen(true)
  }

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTitle.trim() || !boardToRename) return

    updateBoard.mutate({ ...boardToRename, title: renameTitle.trim() }, {
      onSuccess: () => {
        setIsRenameModalOpen(false)
        setBoardToRename(null)
        setRenameTitle("")
        mixpanelService.track(MixpanelEvents.BOARD_RENAME, { boardId: boardToRename.id, newTitle: renameTitle.trim() });
      }
    })
  }

  const handleDeleteClick = (board: Board) => {
    setBoardToDelete({ id: board.id, title: board.title })
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

  const handleDuplicateClick = (board: Board) => {
    setBoardToDuplicate(board)
    setDuplicateTitle(`${board.title} (Copy)`)
    setIsDuplicateModalOpen(true)
  }

  const handleDuplicateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!duplicateTitle.trim() || !boardToDuplicate) return

    duplicateBoard.mutate({ board: boardToDuplicate, title: duplicateTitle.trim() }, {
      onSuccess: () => {
        setIsDuplicateModalOpen(false)
        setBoardToDuplicate(null)
        setDuplicateTitle("")
        mixpanelService.track(MixpanelEvents.BOARD_DUPLICATE, { sourceId: boardToDuplicate.id });
      }
    })
  }

  const handleHistoryClick = (board: Board) => {
    setBoardForHistory({ id: board.id, title: board.title || "Untitled" })
    mixpanelService.track(MixpanelEvents.BOARD_HISTORY_OPEN, { boardId: board.id, source: 'Boards Page' });
    setIsHistoryModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex w-screen items-center justify-center h-screen bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 bg-accent/20 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen min-w-screen bg-background text-foreground">
      <BoardsHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Page heading */}
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
                  onClick={() => setIsCreateModalOpen(true)}
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

          {isEmpty ? (
            <EmptyState onCreateClick={() => setIsCreateModalOpen(true)} />
          ) : (
            <>
              <BoardsFilters filter={filter} onFilterChange={setFilter} sortBy={sortBy} onSortChange={setSortBy} />
              <BoardsGrid
                boards={filteredBoards}
                onCreateClick={() => setIsCreateModalOpen(true)}
                onRename={handleRenameClick}
                onDelete={handleDeleteClick}
                onDuplicate={handleDuplicateClick}
                onHistory={handleHistoryClick}
              />
            </>
          )}
        </div>
      </main>

      {/* Create Board Modal */}
      <Dialog.Root open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md z-50 animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-xl font-bold text-gray-900">Create New Board</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="max-h-[60vh] overflow-y-auto px-1">
                <div className="mb-4">
                  <label htmlFor="boardTitle" className="block text-sm font-medium text-gray-700 mb-1">
                    Board Title
                  </label>
                  <input
                    id="boardTitle"
                    type="text"
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                    placeholder="e.g., Project Roadmap"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-900"
                    autoFocus
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="expiresIn" className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration
                  </label>
                  <div className="relative">
                    <select
                      id="expiresIn"
                      value={expiresInHours}
                      onChange={(e) => setExpiresInHours(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-900 appearance-none bg-white"
                    >
                      <option value={0}>Never Expires</option>
                      <option value={1}>1 Hour</option>
                      <option value={2}>2 Hours</option>
                      <option value={6}>6 Hours</option>
                      <option value={12}>12 Hours</option>
                      <option value={24}>24 Hours</option>
                      <option value={168}>1 Week</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Choose a Template
                  </label>
                  <TemplateSelection
                    selectedTemplateId={selectedTemplateId}
                    onSelect={setSelectedTemplateId}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-gray-100">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={!newBoardTitle.trim() || createBoard.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] hover:from-[#2563EB] hover:to-[#0891B2] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                >
                  {createBoard.isPending ? 'Creating...' : 'Create Board'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
              Creating a copy of <span className="font-semibold text-gray-900">"{boardToDuplicate?.title}"</span>
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
