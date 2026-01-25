
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { trpcClient } from '../../trpcClient'
import { ZeroFrictionRecorder } from './ZeroFrictionRecorder'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Plus, Video, Calendar, ExternalLink, Loader2, PlayCircle, AlertTriangle, Search, X, ArrowLeft, Layout } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function VideosPage() {
    const [isRecorderOpen, setIsRecorderOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const boardId = searchParams.get('boardId')

    const loadMoreRef = useRef<HTMLDivElement>(null)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch
    } = useInfiniteQuery({
        queryKey: ['videos', boardId, debouncedSearch],
        queryFn: ({ pageParam }) => trpcClient.videos.listPaginated.query({
            limit: 12,
            cursor: pageParam,
            boardId: boardId || undefined,
            search: debouncedSearch || undefined
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

    const allVideos = data?.pages.flatMap(page => page.videos) ?? []

    return (
        <div className="min-h-[60vh] flex flex-col">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-8">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {boardId && (
                            <button
                                onClick={() => navigate('/app/videos')}
                                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                All Videos
                            </button>
                        )}
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">
                                {boardId ? 'Board Recordings' : 'Video Library'}
                            </h2>
                            <p className="text-muted-foreground">
                                {boardId
                                    ? 'Recordings from this board.'
                                    : 'Manage and share your recorded videos.'
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsRecorderOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-lg font-medium shadow-md transition-all hover:shadow-lg active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        New Recording
                    </button>
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : allVideos.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-2xl p-12 text-center bg-muted/10">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <Video className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                        {debouncedSearch ? 'No matching videos' : 'No videos yet'}
                    </h3>
                    <p className="text-muted-foreground max-w-sm mb-6">
                        {debouncedSearch
                            ? 'Try a different search term.'
                            : 'Record your first video to share your ideas with the world. It takes seconds!'
                        }
                    </p>
                    {!debouncedSearch && (
                        <button
                            onClick={() => setIsRecorderOpen(true)}
                            className="px-6 py-2 bg-foreground text-background rounded-lg font-medium"
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
                                className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                            >
                                {/* Thumbnail area */}
                                <div className="aspect-video bg-muted relative flex items-center justify-center overflow-hidden">
                                    {video.thumbnailUrl ? (
                                        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-neutral-800 dark:to-neutral-900" />
                                    )}

                                    {/* Status Overlay */}
                                    <div className="absolute top-2 right-2">
                                        <StatusBadge status={video.status} />
                                    </div>

                                    {/* Play Button Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                            <PlayCircle className="w-6 h-6 text-red-600 fill-red-600/10" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4">
                                    <h3 className="font-semibold text-foreground truncate mb-1">{video.title}</h3>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
                                        </span>
                                        {video.boardId && !boardId && (
                                            <Link
                                                to={`/board/${video.boardId}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
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
                                            className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium z-10 relative"
                                        >
                                            Watch on YouTube <ExternalLink className="w-3 h-3" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load more trigger */}
                    <div ref={loadMoreRef} className="py-8 flex items-center justify-center">
                        {isFetchingNextPage && (
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        )}
                        {!hasNextPage && allVideos.length > 0 && (
                            <p className="text-xs text-muted-foreground">No more videos to load</p>
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
            return <span className="px-2 py-0.5 text-xs font-medium bg-green-100/90 text-green-700 rounded-full backdrop-blur-sm shadow-sm">Published</span>
        case 'PROCESSING':
            return <span className="px-2 py-0.5 text-xs font-medium bg-blue-100/90 text-blue-700 rounded-full backdrop-blur-sm shadow-sm animate-pulse flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processing</span>
        case 'FAILED':
            return <span className="px-2 py-0.5 text-xs font-medium bg-red-100/90 text-red-700 rounded-full backdrop-blur-sm shadow-sm flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Failed</span>
        default: // RECORDED
            return <span className="px-2 py-0.5 text-xs font-medium bg-gray-100/90 text-gray-700 rounded-full backdrop-blur-sm shadow-sm">Recorded</span>
    }
}
