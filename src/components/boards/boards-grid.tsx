"use client"

import { BoardIndexEntry } from "../../boards"
import CreateBoardCard from "./create-board-card"
import BoardCard from "./board-card"

interface BoardsGridProps {
  entries: BoardIndexEntry[]
  onCreateClick: () => void
  onRename: (entry: BoardIndexEntry) => void
  onDelete: (entry: BoardIndexEntry) => void
  onDuplicate: (entry: BoardIndexEntry) => void
  onHistory: (entry: BoardIndexEntry) => void
  onRemoveShared: (entry: BoardIndexEntry) => void
}

export default function BoardsGrid({
  entries,
  onCreateClick,
  onRename,
  onDelete,
  onDuplicate,
  onHistory,
  onRemoveShared
}: BoardsGridProps) {
  return (
    <section>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Create new board card - always first */}
        <li className="animate-fade-up" style={{ animationDelay: "0ms", animationFillMode: "backwards" }}>
          <CreateBoardCard onClick={onCreateClick} />
        </li>

        {/* Board cards */}
        {entries.map((entry, index) => (
          <li
            key={entry.noteId}
            className="animate-fade-up"
            style={{
              animationDelay: `${(index + 1) * 50}ms`,
              animationFillMode: "backwards",
            }}
          >
            <BoardCard
              entry={entry}
              onRename={() => onRename(entry)}
              onDelete={() => onDelete(entry)}
              onDuplicate={() => onDuplicate(entry)}
              onHistory={() => onHistory(entry)}
              onRemoveShared={() => onRemoveShared(entry)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
