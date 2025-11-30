import { Board } from '../types';
import { useParams } from 'react-router-dom';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  boards: Board[];
  onSelect: (id: string) => void;
  onNewBoard: () => void;
  onDelete?: (id: string) => void;
}

export function Sidebar({ boards, onSelect, onNewBoard, onDelete }: SidebarProps) {
  const { id: currentId } = useParams();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="w-[260px] bg-[#171717] text-white flex flex-col h-screen">
      <div className="p-3">
        <button
          onClick={onNewBoard}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 border border-white/10 hover:border-white/20 group"
        >
          <Plus size={18} className="text-white/70 group-hover:text-white transition-colors" />
          <span className="font-medium text-sm text-white/90 group-hover:text-white transition-colors">New board</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {boards.length === 0 ? (
          <div className="px-4 py-12 text-center text-white/40 text-sm">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            <p>No boards yet</p>
            <p className="text-xs mt-1">Create your first board</p>
          </div>
        ) : (
          boards.map(board => (
            <div
              key={board.id}
              className="relative group"
              onMouseEnter={() => setHoveredId(board.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => onSelect(board.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-start gap-3 ${
                  currentId === board.id
                    ? 'bg-white/10'
                    : 'hover:bg-white/5'
                }`}
              >
                <MessageSquare size={16} className="mt-0.5 flex-shrink-0 text-white/50" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/90 truncate leading-tight">
                    {board.title || 'Untitled board'}
                  </div>
                </div>
              </button>
              {hoveredId === board.id && onDelete && currentId !== board.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(board.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-all"
                  title="Delete board"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
      
      <div className="p-3 border-t border-white/10">
        <div className="text-xs text-white/40 px-3">
          {boards.length} {boards.length === 1 ? 'board' : 'boards'}
        </div>
      </div>
    </div>
  );
}
