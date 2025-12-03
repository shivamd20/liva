"use client"

import type { Board } from "../../types"
import CreateBoardCard from "./create-board-card"
import BoardCard from "./board-card"

interface BoardsGridProps {
  boards: Board[]
  onCreateClick: () => void
  onRename: (board: Board) => void
  onDelete: (board: Board) => void
  onDuplicate: (board: Board) => void
  onHistory: (board: Board) => void
}

export default function BoardsGrid({
  boards,
  onCreateClick,
  onRename,
  onDelete,
  onDuplicate,
  onHistory
}: BoardsGridProps) {
  return (
    <section>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Create new board card - always first */}
        <li className="animate-fade-up" style={{ animationDelay: "0ms", animationFillMode: "backwards" }}>
          <CreateBoardCard onClick={onCreateClick} />
        </li>

        {/* Board cards */}
        {boards.map((board, index) => (
          <li
            key={board.id}
            className="animate-fade-up"
            style={{
              animationDelay: `${(index + 1) * 50}ms`,
              animationFillMode: "backwards",
            }}
          >
            <BoardCard
              board={board}
              onRename={() => onRename(board)}
              onDelete={() => onDelete(board)}
              onDuplicate={() => onDuplicate(board)}
              onHistory={() => onHistory(board)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
