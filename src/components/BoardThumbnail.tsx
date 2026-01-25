import { useState, useEffect, useRef, memo } from 'react';
import { exportToBlob } from "@excalidraw/excalidraw";
import { File } from 'lucide-react';
import { useTheme } from 'next-themes';
import { thumbnailQueue } from '../utils/thumbnailQueue';

interface BoardThumbnailProps {
    // For generating thumbnails from elements
    elements?: any[];
    // For using cached thumbnail from index
    cachedThumbnail?: string | null;
    noteId?: string;
    version?: number;
}

export const BoardThumbnail = memo(function BoardThumbnail({
    elements,
    cachedThumbnail,
    noteId,
    version
}: BoardThumbnailProps) {
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { theme, resolvedTheme } = useTheme();
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Intersection Observer to load only when visible
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
    }, []);

    // Use cached thumbnail if available
    useEffect(() => {
        if (cachedThumbnail) {
            setThumbnail(cachedThumbnail);
            setLoading(false);
        }
    }, [cachedThumbnail]);

    // Generate thumbnail from elements if no cached version
    useEffect(() => {
        // Skip if we already have a cached thumbnail
        if (cachedThumbnail) return;
        if (!isVisible) return;

        let isMounted = true;

        const generateThumbnail = async () => {
            if (!elements || elements.length === 0) {
                if (isMounted) {
                    setThumbnail(null);
                    setLoading(false);
                }
                return;
            }

            try {
                const isDarkMode = resolvedTheme === 'dark' || theme === 'dark';

                const blob = await exportToBlob({
                    elements: elements.filter((x) => !x.isDeleted),
                    appState: {
                        exportWithDarkMode: isDarkMode,
                    },
                    files: {},
                    mimeType: "image/png",
                    quality: 0.5,
                });

                if (isMounted && blob) {
                    const url = URL.createObjectURL(blob);
                    setThumbnail(url);
                }
            } catch (error) {
                console.error("Failed to generate thumbnail", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        thumbnailQueue.enqueue(generateThumbnail);

        return () => {
            isMounted = false;
        };
    }, [elements, theme, resolvedTheme, isVisible, cachedThumbnail]);

    // Cleanup object URL (only for blob URLs, not data URLs)
    useEffect(() => {
        return () => {
            if (thumbnail && thumbnail.startsWith('blob:')) {
                URL.revokeObjectURL(thumbnail);
            }
        };
    }, [thumbnail]);

    if (loading || !isVisible) {
        return (
            <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-muted">
                {isVisible && <div className="w-6 h-6 border-2 border-[#06B6D4]/30 border-t-[#3B82F6] rounded-full animate-spin"></div>}
            </div>
        );
    }

    if (!thumbnail) {
        return (
            <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-muted group-hover:bg-muted/80 transition-colors">
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.08] bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:16px_16px]" />
                <File className="w-10 h-10 text-muted-foreground/40 group-hover:text-[#3B82F6] transition-all duration-300 group-hover:scale-110 relative z-10" />
            </div>
        );
    }

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
