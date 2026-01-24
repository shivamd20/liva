import { useEffect, useRef, useState } from 'react';
import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { BinaryFileData } from '@excalidraw/excalidraw/types';
import { toast } from 'sonner';

interface UseRemoteFileHandlerProps {
    excalidrawAPI: ExcalidrawImperativeAPI | null;
    boardId: string;
}

export function useRemoteFileHandler({ excalidrawAPI, boardId }: UseRemoteFileHandlerProps) {
    const processedFiles = useRef<Set<string>>(new Set());
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!excalidrawAPI) return;

        // function to check and upload files
        const checkFiles = async () => {
            const files = excalidrawAPI.getFiles();
            const filesToUpload: BinaryFileData[] = [];

            for (const [id, file] of Object.entries(files)) {
                if (processedFiles.current.has(id)) continue;

                // processing only if it's a data URI and not already a remote URL
                if (file.dataURL && file.dataURL.startsWith('data:')) {
                    // Check if it's a real file we want to upload (ex: images)
                    if (file.mimeType.startsWith('image/')) {
                        filesToUpload.push(file);
                    }
                } else if (file.dataURL && file.dataURL.startsWith('http')) {
                    // Already remote, mark as processed
                    processedFiles.current.add(id);
                }
            }

            if (filesToUpload.length === 0) return;

            setIsUploading(true);

            const newFiles: Record<string, BinaryFileData> = {};
            let hasChanges = false;

            await Promise.all(filesToUpload.map(async (file) => {
                try {
                    // Convert Data URI to Blob/File
                    const response = await fetch(file.dataURL);
                    const blob = await response.blob();
                    const formData = new FormData();
                    formData.append('file', blob, file.id); // Use file ID as name potentially, or just "file"
                    formData.append('boardId', boardId);

                    const uploadRes = await fetch('/api/files/upload', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!uploadRes.ok) {
                        console.error('Failed to upload file', file.id, await uploadRes.text());
                        return;
                    }

                    const data = await uploadRes.json() as { url: string; fileId: string };

                    // Mark as processed
                    processedFiles.current.add(file.id);

                    // Create updated file object
                    newFiles[file.id] = {
                        ...file,
                        dataURL: data.url as any, // Cast to any to satisfy BinaryFileData type
                    };
                    hasChanges = true;

                } catch (error) {
                    console.error("Error uploading file:", error);
                    toast.error("Failed to upload image");
                }
            }));

            setIsUploading(false);

            if (hasChanges) {
                excalidrawAPI.addFiles(Object.values(newFiles));
                toast.success("Image uploaded!");
            }
        };

        // Poll for new files every second? 
        // Or attach to onChange listener? 
        // Since Excalidraw doesn't expose a direct "onFileAdded" event, polling or hooking into onChange is best.
        // However, we don't own the onChange in this hook easily without wrapping.
        // Let's use an interval for now as it's least intrusive to existing code structure, 
        // observing the excalidrawAPI.getFiles() 
        const intervalId = setInterval(checkFiles, 2000);

        return () => clearInterval(intervalId);

    }, [excalidrawAPI, boardId]);

    return { isUploading };
}
