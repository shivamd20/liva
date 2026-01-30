import { useState, useEffect, useRef, memo } from 'react';
import { File } from 'lucide-react';
import { useTheme } from 'next-themes';
import { getThumbnail } from '../utils/thumbnailCache';
import { boardsRemote } from '../boardsRemote';

interface BoardThumbnailProps {
    noteId: string;
    updatedAt: number;
}

/**
 * BoardThumbnail - Generates and caches thumbnails client-side.
 * 
 * Features:
 * - Client-side generation from Excalidraw elements
 * - Persistent caching in IndexedDB (survives page refreshes)
 * - Cache invalidation based on board's updatedAt
 * - Deduplication of in-flight requests
 * - Lazy loading via IntersectionObserver
 */
export const BoardThumbnail = memo(function BoardThumbnail({
    noteId,
    updatedAt,
}: BoardThumbnailProps) {
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { theme, resolvedTheme } = useTheme();
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Intersection Observer - only fetch/generate thumbnail when visible
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '100px' }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [noteId]);

    // Fetch/generate thumbnail when visible
    useEffect(() => {
        if (!isVisible) return;

        let isMounted = true;
        const isDarkMode = resolvedTheme === 'dark' || theme === 'dark';

        getThumbnail(
            noteId,
            updatedAt,
            () => boardsRemote.getById(noteId),
            isDarkMode
        ).then((result) => {
            if (isMounted) {
                setThumbnail(result);
                setLoading(false);
            }
        }).catch((error) => {
            console.error('Failed to get thumbnail:', error);
            if (isMounted) {
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [noteId, updatedAt, theme, resolvedTheme, isVisible]);

    // Loading state (only show spinner when visible)
    if (loading || !isVisible) {
        return (
            <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-muted">
                {isVisible && (
                    <div className="w-6 h-6 border-2 border-[#06B6D4]/30 border-t-[#3B82F6] rounded-full animate-spin" />
                )}
            </div>
        );
    }

    // Placeholder state (no elements or empty board)
    if (!thumbnail) {
        return (
            <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-muted group-hover:bg-muted/80 transition-colors">
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.08] bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:16px_16px]" />
                <File className="w-10 h-10 text-muted-foreground/40 group-hover:text-[#3B82F6] transition-all duration-300 group-hover:scale-110 relative z-10" />
            </div>
        );
    }

    // Thumbnail rendered
    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-background overflow-hidden">
            <img
                src={thumbnail}
                alt="Board thumbnail"
                className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity duration-300 hover:scale-105"
            />
        </div>
    );
});
