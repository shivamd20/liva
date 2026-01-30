import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { X, Plus, Download } from 'lucide-react';
import { toast } from "sonner";

// Lazy load Excalidraw since it's a heavy dependency
const Excalidraw = lazy(() => import("@excalidraw/excalidraw").then(mod => ({ default: mod.Excalidraw })));

// Dynamic import helpers for mermaid dependencies (reduces initial bundle)
const getMermaid = async () => {
    const { default: mermaid } = await import('mermaid');
    return mermaid;
};

const getMermaidToExcalidraw = async () => {
    const [{ parseMermaidToExcalidraw }, { convertToExcalidrawElements }] = await Promise.all([
        import('@excalidraw/mermaid-to-excalidraw'),
        import('@excalidraw/excalidraw'),
    ]);
    return { parseMermaidToExcalidraw, convertToExcalidrawElements };
};

interface MermaidExcalidrawModalProps {
    isOpen: boolean;
    onClose: () => void;
    mermaidCode: string;
    excalidrawAPI: any | null;
}

function MermaidRender({ code }: { code: string }) {
    const [svg, setSvg] = useState<string | null>(null);

    useEffect(() => {
        const render = async () => {
            try {
                const mermaid = await getMermaid();
                const id = `mermaid-modal-${Math.random().toString(36).substr(2, 9)}`;
                const { svg } = await mermaid.render(id, code);
                setSvg(svg);
            } catch (e) {
                console.error("Mermaid modal render error", e);
            }
        };
        render();
    }, [code]);

    return (
        <div
            className="w-full h-full flex items-center justify-center overflow-auto p-8 bg-white"
            dangerouslySetInnerHTML={{ __html: svg || '' }}
        />
    );
}

export function MermaidExcalidrawModal({ isOpen, onClose, mermaidCode, excalidrawAPI }: MermaidExcalidrawModalProps) {
    const [elements, setElements] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !mermaidCode) return;

        const convert = async () => {
            setLoading(true);
            try {
                const { parseMermaidToExcalidraw, convertToExcalidrawElements } = await getMermaidToExcalidraw();
                const { elements: parsedElements } = await parseMermaidToExcalidraw(mermaidCode, {
                });
                const excalidrawElements = convertToExcalidrawElements(parsedElements);
                setElements(excalidrawElements);
            } catch (e) {
                console.error("Failed to convert mermaid to excalidraw", e);
            } finally {
                setLoading(false);
            }
        };
        convert();
    }, [isOpen, mermaidCode]);

    const handleAddToBoard = () => {
        if (!excalidrawAPI || elements.length === 0) {
            toast.error("Excalidraw API not ready or no elements generated");
            return;
        }

        try {
            excalidrawAPI.updateScene({
                elements: [
                    ...excalidrawAPI.getSceneElements(),
                    ...elements
                ]
            });

            toast.success("Diagram added to board");
            onClose();
        } catch (e) {
            console.error("Failed to add to board", e);
            toast.error("Failed to add to board");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="max-w-[95vw] w-[95vw] h-[92vh] p-0 border-none outline-none overflow-hidden bg-background flex flex-col sm:max-w-[95vw] shadow-2xl rounded-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur z-20 shrink-0">
                    <div className="flex flex-col">
                        <DialogTitle className="text-base font-semibold">Diagram Visualization</DialogTitle>
                        <p className="text-xs text-muted-foreground">Original Mermaid source and generated Excalidraw</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handleAddToBoard} className="gap-2" size="sm">
                            <Plus className="w-4 h-4" />
                            Add to Board
                        </Button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-border">
                    {/* Left: Mermaid Render */}
                    <div className="h-full w-full overflow-hidden bg-muted/5 relative flex flex-col">
                        <div className="absolute top-3 left-3 z-10 bg-background/90 backdrop-blur px-2 py-1 rounded text-[10px] font-mono border text-muted-foreground shadow-sm uppercase tracking-wider">Mermaid Source View</div>
                        <MermaidRender code={mermaidCode} />
                    </div>

                    {/* Right: Excalidraw Render */}
                    <div className="h-full w-full overflow-hidden bg-white relative flex flex-col">
                        <div className="absolute top-3 left-3 z-10 bg-background/90 backdrop-blur px-2 py-1 rounded text-[10px] font-mono border text-muted-foreground shadow-sm uppercase tracking-wider">Excalidraw Preview</div>
                        {loading ? (
                            <div className="h-full w-full flex items-center justify-center flex-col gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">Converting to Excalidraw...</span>
                            </div>
                        ) : (
                            <Suspense fallback={
                                <div className="h-full w-full flex items-center justify-center flex-col gap-2">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    <span className="text-xs text-muted-foreground">Loading Excalidraw...</span>
                                </div>
                            }>
                                <Excalidraw
                                    initialData={{
                                        elements: elements,
                                        appState: {
                                            viewBackgroundColor: "#ffffff",
                                            currentItemFontFamily: 1,
                                            gridSize: 20,
                                        }
                                    }}
                                    viewModeEnabled={true}
                                    zenModeEnabled={true}
                                    key={JSON.stringify(elements)}
                                />
                            </Suspense>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
