
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { trpcClient } from '../../trpcClient'
import { ZeroFrictionRecorder } from './ZeroFrictionRecorder'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
    Plus, Video, Calendar, ExternalLink, Loader2, PlayCircle, AlertTriangle,
    Search, X, ArrowLeft, Layout, Filter, ChevronDown, Youtube, CheckCircle
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type VideoStatus = 'RECORDED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED'

export function VideosPage() {
    const [isRecorderOpen, setIsRecorderOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<VideoStatus | ''>('')
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const boardId = searchParams.get('boardId')

    const loadMoreRef = useRef<HTMLDivElement>(null)
    const filterRef = useRef<HTMLDivElement>(null)

    // Close filter dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setIsFilterOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Fetch board name if filtering by boardId
    const { data: boardInfo } = useQuery({
        queryKey: ['board-info', boardId],
        queryFn: async () => {
            if (!boardId) return null
            try {
                const board = await trpcClient.getNote.query({ id: boardId })
                return board
            } catch {
                return null
            }
        },
        enabled: !!boardId
    })

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch
    } = useInfiniteQuery({
        queryKey: ['videos', boardId, debouncedSearch, statusFilter],
        queryFn: ({ pageParam }) => trpcClient.videos.listPaginated.query({
            limit: 12,
            cursor: pageParam,
            boardId: boardId || undefined,
            search: debouncedSearch || undefined,
            status: statusFilter || undefined
        }),
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialPageParam: undefined as string | undefined
    })

    // Intersection observer for infinite scroll
    const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
        const [target] = entries
        if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [fetchNextPage, hasNextPage, isFetchingNextPage])

    useEffect(() => {
        const observer = new IntersectionObserver(handleObserver, {
            root: null,
            rootMargin: '100px',
            threshold: 0
        })

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current)
        }

        return () => observer.disconnect()
    }, [handleObserver])

    const clearBoardFilter = () => {
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('boardId')
        setSearchParams(newParams)
    }

    const allVideos = data?.pages.flatMap(page => page.videos) ?? []
    const activeFiltersCount = [boardId, statusFilter].filter(Boolean).length

    return (
        <div className="min-h-[70vh] flex flex-col">
            {/* Header */}
            <div className="flex flex-col gap-6 mb-8">
                {/* Title Row */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex items-start gap-4">
                        {boardId && (
                            <button
                                onClick={clearBoardFilter}
                                className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                                {boardId ? 'Board Recordings' : 'Video Library'}
                            </h2>
                            <p className="text-muted-foreground mt-1">
                                {boardId && boardInfo?.title
                                    ? <>From <span className="font-medium text-foreground">{boardInfo.title}</span></>
                                    : boardId
                                        ? 'Recordings from this board.'
                                        : 'All your recorded videos in one place.'
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsRecorderOpen(true)}
                        className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 text-white rounded-xl font-medium shadow-lg shadow-red-500/25 transition-all hover:shadow-xl hover:shadow-red-500/30 active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Recording</span>
                    </button>
                </div>

                {/* Search & Filters Row */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search videos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-transparent transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filter Dropdown */}
                    <div className="relative" ref={filterRef}>
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${activeFiltersCount > 0
                                    ? 'bg-primary/10 border-primary/20 text-primary'
                                    : 'bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Filter className="w-4 h-4" />
                            <span>Filters</span>
                            {activeFiltersCount > 0 && (
                                <span className="flex items-center justify-center w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full">
                                    {activeFiltersCount}
                                </span>
                            )}
                            <ChevronDown className={`w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isFilterOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-3 border-b border-border">
                                    <h4 className="text-sm font-semibold text-foreground">Filter Videos</h4>
                                </div>

                                {/* Status Filter */}
                                <div className="p-3 space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['', 'RECORDED', 'PROCESSING', 'PUBLISHED', 'FAILED'] as const).map((status) => (
                                            <button
                                                key={status || 'all'}
                                                onClick={() => setStatusFilter(status)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === status
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                                                    }`}
                                            >
                                                {status || 'All'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Board Filter Info */}
                                {boardId && (
                                    <div className="p-3 border-t border-border">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Layout className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-muted-foreground">Board:</span>
                                                <span className="font-medium truncate max-w-[100px]">
                                                    {boardInfo?.title || 'Loading...'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={clearBoardFilter}
                                                className="text-xs text-destructive hover:underline"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Clear All */}
                                {activeFiltersCount > 0 && (
                                    <div className="p-3 border-t border-border">
                                        <button
                                            onClick={() => {
                                                setStatusFilter('')
                                                clearBoardFilter()
                                                setIsFilterOpen(false)
                                            }}
                                            className="w-full py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                        >
                                            Clear All Filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Active Filters Pills */}
                {(boardId || statusFilter) && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Active filters:</span>
                        {boardId && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                                <Layout className="w-3 h-3" />
                                {boardInfo?.title || 'Board'}
                                <button onClick={clearBoardFilter} className="hover:text-blue-900 dark:hover:text-blue-100">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}
                        {statusFilter && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                                {statusFilter}
                                <button onClick={() => setStatusFilter('')} className="hover:text-purple-900 dark:hover:text-purple-100">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading videos...</span>
                    </div>
                </div>
            ) : allVideos.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-2xl p-12 text-center bg-gradient-to-b from-muted/20 to-muted/5">
                    <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-red-500/10">
                        <Video className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                        {debouncedSearch || statusFilter ? 'No matching videos' : 'No videos yet'}
                    </h3>
                    <p className="text-muted-foreground max-w-sm mb-6">
                        {debouncedSearch || statusFilter
                            ? 'Try adjusting your filters or search term.'
                            : 'Record your first video to share your ideas with the world. It takes seconds!'
                        }
                    </p>
                    {!debouncedSearch && !statusFilter && (
                        <button
                            onClick={() => setIsRecorderOpen(true)}
                            className="px-6 py-2.5 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-opacity"
                        >
                            Start Recording
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {allVideos.map((video) => (
                            <div
                                key={video.id}
                                onClick={() => navigate(`/app/videos/${video.id}`)}
                                className="group relative bg-card border border-border/50 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-black/5 hover:border-border transition-all duration-300 cursor-pointer"
                            >
                                {/* Thumbnail area */}
                                <div className="aspect-video bg-muted relative flex items-center justify-center overflow-hidden">
                                    {video.thumbnailUrl ? (
                                        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
                                            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                                <Video className="w-16 h-16" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Status Badge */}
                                    <div className="absolute top-3 right-3">
                                        <StatusBadge status={video.status} />
                                    </div>

                                    {/* YouTube Badge */}
                                    {video.youtubeId && (
                                        <div className="absolute top-3 left-3">
                                            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-600 text-white rounded-full shadow-sm">
                                                <Youtube className="w-3 h-3" />
                                                YouTube
                                            </span>
                                        </div>
                                    )}

                                    {/* Play Button Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                                        <div className="w-14 h-14 bg-white/90 dark:bg-black/90 rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300">
                                            <PlayCircle className="w-7 h-7 text-red-600" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4">
                                    <h3 className="font-semibold text-foreground truncate mb-2 group-hover:text-primary transition-colors">
                                        {video.title || 'Untitled Recording'}
                                    </h3>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
                                        </span>
                                        {video.boardId && !boardId && (
                                            <Link
                                                to={`/app/videos?boardId=${video.boardId}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
                                            >
                                                <Layout className="w-3 h-3" />
                                                Board
                                            </Link>
                                        )}
                                    </div>
                                    {video.videoUrl && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(video.videoUrl, '_blank');
                                            }}
                                            className="mt-3 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
                                        >
                                            <Youtube className="w-4 h-4" />
                                            Watch on YouTube
                                            <ExternalLink className="w-3 h-3" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load more trigger */}
                    <div ref={loadMoreRef} className="py-10 flex items-center justify-center">
                        {isFetchingNextPage && (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Loading more...</span>
                            </div>
                        )}
                        {!hasNextPage && allVideos.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                                {allVideos.length === 1 ? '1 video' : `${allVideos.length} videos`} — You've seen them all!
                            </p>
                        )}
                    </div>
                </>
            )}

            {isRecorderOpen && (
                <ZeroFrictionRecorder
                    onClose={() => setIsRecorderOpen(false)}
                    onSuccess={() => {
                        refetch();
                    }}
                />
            )}
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'PUBLISHED':
            return (
                <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-green-100/90 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full backdrop-blur-sm shadow-sm">
                    <CheckCircle className="w-3 h-3" />
                    Published
                </span>
            )
        case 'PROCESSING':
            return (
                <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-100/90 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full backdrop-blur-sm shadow-sm animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing
                </span>
            )
        case 'FAILED':
            return (
                <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-red-100/90 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full backdrop-blur-sm shadow-sm">
                    <AlertTriangle className="w-3 h-3" />
                    Failed
                </span>
            )
        default: // RECORDED
            return (
                <span className="px-2.5 py-1 text-xs font-semibold bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 rounded-full backdrop-blur-sm shadow-sm">
                    Recorded
                </span>
            )
    }
}

export default VideosPage;
