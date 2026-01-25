'use client';

import { useState } from 'react';
import { BoardIndexEntry } from '../../boards';
import { Link } from 'react-router-dom';
import { BoardThumbnail } from '../BoardThumbnail';
import { MoreHorizontal, Pencil, Copy, Trash2, Clock, Share2, X, Eye, EyeOff, Users } from 'lucide-react';

interface BoardCardProps {
	entry: BoardIndexEntry;
	onRename: () => void;
	onDelete: () => void;
	onDuplicate: () => void;
	onHistory: () => void;
	onRemoveShared: () => void;
}

export default function BoardCard({ entry, onRename, onDelete, onDuplicate, onHistory, onRemoveShared }: BoardCardProps) {
	const [menuOpen, setMenuOpen] = useState(false);

	const formatDate = (timestamp: number) => {
		if (!timestamp) return '';
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	};

	return (
		<div className="group relative">
			<Link
				to={`/board/${entry.noteId}`}
				className="block w-full rounded-2xl overflow-hidden bg-card backdrop-blur-xl border border-border shadow-lg shadow-black/5 dark:shadow-black/50 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/60 transition-all duration-300  focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
			>
				{/* Thumbnail */}
				<div className="relative aspect-[16/10] overflow-hidden bg-muted">
					<BoardThumbnail
						cachedThumbnail={entry.thumbnailBase64}
						noteId={entry.noteId}
						version={entry.version}
					/>

					{/* Gradient overlay for legibility */}
					<div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent" />

					{/* Badges */}
					<div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10">
						{/* Shared badge - for boards not owned by user */}
						{!entry.isOwned && (
							<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-card/95 backdrop-blur-sm text-foreground border border-border/50 rounded-full shadow-sm">
								<Users className="w-3 h-3" />
								Shared
							</span>
						)}

						{/* Visibility badge */}
						{entry.visibility === 'public' && entry.isOwned && (
							<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-emerald-500/90 backdrop-blur-sm text-white rounded-full shadow-sm">
								<Eye className="w-3 h-3" />
								Public
							</span>
						)}
					</div>
				</div>

				{/* Content */}
				<div className="p-4">
					<h3 className="text-base font-semibold text-foreground truncate mb-1 group-hover:text-accent transition-colors duration-200">
						{entry.title || 'Untitled'}
					</h3>
					<div className="flex flex-col gap-0.5">
						<p className="text-sm text-muted-foreground">
							Edited {formatDate(entry.updatedAt)}
						</p>
						{entry.lastAccessedAt !== entry.updatedAt && (
							<p className="text-xs text-muted-foreground/70">
								Opened {formatDate(entry.lastAccessedAt)}
							</p>
						)}
					</div>
				</div>
			</Link>

			{/* Three dots menu */}
			<div className="absolute top-3 right-3 z-20">
				<button
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						setMenuOpen(!menuOpen);
					}}
					className="cursor-pointer w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm border border-border/50 flex items-center justify-center opacity-100 hover:bg-card/30 transition-all duration-200 shadow-sm focus:outline-none focus:opacity-100 focus:ring-2 focus:ring-accent"
					aria-label="Board options"
				>
					<MoreHorizontal className="w-4 h-4 text-foreground" />
				</button>

				{/* Dropdown menu */}
				{menuOpen && (
					<>
						<div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
						<div className="absolute top-full right-0 mt-2 w-48 py-2 bg-popover backdrop-blur-xl border border-border rounded-xl shadow-xl z-30 animate-in fade-in zoom-in-95 duration-100">
							{entry.isOwned ? (
								// Options for owned boards
								<>
									<button
										onClick={(e) => {
											e.stopPropagation();
											setMenuOpen(false);
											onRename();
										}}
										className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
									>
										<Pencil className="w-4 h-4" />
										Rename
									</button>
									<button
										onClick={(e) => {
											e.stopPropagation();
											setMenuOpen(false);
											onHistory();
										}}
										className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
									>
										<Clock className="w-4 h-4" />
										History
									</button>
									<button
										onClick={(e) => {
											e.stopPropagation();
											setMenuOpen(false);
											onDuplicate();
										}}
										className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
									>
										<Copy className="w-4 h-4" />
										Duplicate
									</button>
									<div className="my-2 h-px bg-border" />
									<button
										onClick={(e) => {
											e.stopPropagation();
											setMenuOpen(false);
											onDelete();
										}}
										className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
									>
										<Trash2 className="w-4 h-4" />
										Delete
									</button>
								</>
							) : (
								// Options for shared boards
								<>
									<button
										onClick={(e) => {
											e.stopPropagation();
											setMenuOpen(false);
											onHistory();
										}}
										className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
									>
										<Clock className="w-4 h-4" />
										History
									</button>
									<button
										onClick={(e) => {
											e.stopPropagation();
											setMenuOpen(false);
											onDuplicate();
										}}
										className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
									>
										<Copy className="w-4 h-4" />
										Duplicate to my boards
									</button>
									<div className="my-2 h-px bg-border" />
									<button
										onClick={(e) => {
											e.stopPropagation();
											setMenuOpen(false);
											onRemoveShared();
										}}
										className="w-full px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2"
									>
										<X className="w-4 h-4" />
										Remove from list
									</button>
								</>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
