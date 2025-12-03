"use client"

import { useState } from "react"
import type { Board } from "../../types"
import { Link } from "react-router-dom"
import { BoardThumbnail } from "../BoardThumbnail"
import { MoreHorizontal, Pencil, Copy, Trash2, Clock, Share2 } from "lucide-react"

interface BoardCardProps {
  board: Board
  onRename: () => void
  onDelete: () => void
  onDuplicate: () => void
  onHistory: () => void
}

export default function BoardCard({ board, onRename, onDelete, onDuplicate, onHistory }: BoardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const formatDate = (timestamp: number) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div className="group relative">
      <Link
        to={`/board/${board.id}`}
        className="block w-full rounded-2xl overflow-hidden bg-card backdrop-blur-xl border border-border shadow-lg shadow-black/5 dark:shadow-black/50 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/60 transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
      >
        {/* Thumbnail */}
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <BoardThumbnail elements={board.excalidrawElements} />

          {/* Gradient overlay for legibility */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent" />

          {/* Shared badge */}
          {board.access === 'public' && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-card/95 backdrop-blur-sm text-foreground border border-border/50 rounded-full shadow-sm z-10">
              <Share2 className="w-3 h-3" />
              Shared
            </span>
          )}

          {/* Open indicator on hover */}
          <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-card/95 backdrop-blur-sm border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 shadow-md z-10">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-foreground">
              <path
                d="M3 8H13M13 8L9 4M13 8L9 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-base font-semibold text-foreground truncate mb-1 group-hover:text-accent transition-colors duration-200">
            {board.title || 'Untitled'}
          </h3>
          <p className="text-sm text-muted-foreground">Edited {formatDate(board.updatedAt)}</p>
        </div>
      </Link>

      {/* Three dots menu */}
      <div className="absolute top-3 right-3 z-20">
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMenuOpen(!menuOpen)
          }}
          className="w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-card transition-all duration-200 shadow-sm focus:outline-none focus:opacity-100 focus:ring-2 focus:ring-accent"
          aria-label="Board options"
        >
          <MoreHorizontal className="w-4 h-4 text-foreground" />
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-full right-0 mt-2 w-48 py-2 bg-popover backdrop-blur-xl border border-border rounded-xl shadow-xl z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRename(); }}
                className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Rename
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onHistory(); }}
                className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                History
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate(); }}
                className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </button>
              <div className="my-2 h-px bg-border" />
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
