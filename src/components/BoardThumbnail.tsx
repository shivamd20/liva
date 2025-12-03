import { useState, useEffect } from 'react';
import { exportToBlob } from "@excalidraw/excalidraw";
import { File } from 'lucide-react';

export function BoardThumbnail({ elements }: { elements?: any[] }) {
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
                const blob = await exportToBlob({
                    elements: elements.filter((x) => !x.isDeleted),
                    appState: {
                        exportWithDarkMode: false,
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

        generateThumbnail();

        return () => {
            isMounted = false;
            if (thumbnail) URL.revokeObjectURL(thumbnail);
        };
    }, [elements]);

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <div className="w-6 h-6 border-2 border-[#06B6D4]/30 border-t-[#3B82F6] rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!thumbnail) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 group-hover:bg-white transition-colors">
                <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:16px_16px]" />
                <File className="w-10 h-10 text-gray-300 group-hover:text-[#3B82F6] transition-all duration-300 group-hover:scale-110 relative z-10" />
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center justify-center bg-white overflow-hidden">
            <img
                src={thumbnail}
                alt="Board thumbnail"
                className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity duration-300 hover:scale-105"
            />
        </div>
    );
}
