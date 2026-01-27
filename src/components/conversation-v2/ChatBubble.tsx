import React, { useEffect, useState, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import mermaid from 'mermaid';
import { Button } from '@/components/ui/button';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidExcalidrawModal } from './MermaidExcalidrawModal';

// Initialize mermaid

// Initialize mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    suppressErrorRendering: true,
});


interface ChatBubbleProps {
    message: {
        role: 'user' | 'assistant' | 'tool';
        content?: string;
        parts?: any[];
        toolCallId?: string;
        toolCalls?: any[];
    };
    excalidrawAPI?: any;
}

function MermaidDiagram({ code, excalidrawAPI }: { code: string; excalidrawAPI?: any }) {
    const [svg, setSvg] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showModal, setShowModal] = useState(false);
    const [error, setError] = useState(false);
    const [debouncedCode, setDebouncedCode] = useState(code);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCode(code);
        }, 500);
        return () => clearTimeout(timer);
    }, [code]);

    useEffect(() => {
        if (!debouncedCode) return;

        const renderDiagram = async () => {
            setError(false);

            try {
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                const { svg } = await mermaid.render(id, debouncedCode);
                setSvg(svg);
            } catch (err) {
                console.error('Mermaid render error:', err);
                setError(true);
            }
        };

        renderDiagram();
    }, [debouncedCode]);

    if (error) {
        return (
            <div className="my-2 rounded-lg border border-destructive/20 bg-destructive/5 overflow-hidden">
                <div className="px-3 py-2 text-xs font-medium text-destructive border-b border-destructive/10 flex items-center gap-2">
                    <span>⚠️ Visualization Error</span>
                </div>
                <div className="p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre">{code}</pre>
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                className="my-2 bg-white rounded-lg border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all select-none"
                onClick={() => setShowModal(true)}
                title="Click to view detailed diagram and export"
            >
                <div
                    ref={containerRef}
                    className="p-4 overflow-x-auto flex justify-center bg-white min-h-[100px]"
                    dangerouslySetInnerHTML={{ __html: svg || '<div class="flex items-center justify-center w-full h-20 text-xs text-muted-foreground animate-pulse">Rendering...</div>' }}
                />
                <div className="bg-muted/30 border-t px-3 py-2 flex justify-between items-center text-xs text-muted-foreground">
                    <span className="font-mono">Mermaid Diagram</span>
                    <span className="opacity-70">Click to expand</span>
                </div>
            </div>
            <MermaidExcalidrawModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                mermaidCode={code}
                excalidrawAPI={excalidrawAPI}
            />
        </>
    );
}

function CollapsibleImage({ imageSrc }: { imageSrc: string }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="mt-2 block w-full rounded-lg overflow-hidden border border-border bg-white shadow-sm">
            {isExpanded ? (
                <>
                    <img
                        src={imageSrc}
                        alt="Board Snapshot"
                        className="w-full h-auto block"
                        style={{ minHeight: '100px', maxHeight: '400px', objectFit: 'contain' }}
                    />
                    <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 border-t flex items-center justify-between">
                        <span>📷 Shared Board View</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 gap-1"
                            onClick={() => setIsExpanded(false)}
                        >
                            <ChevronUp className="w-3 h-3" />
                            <span className="text-xs">Collapse</span>
                        </Button>
                    </div>
                </>
            ) : (
                <div className="px-3 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">📷 Read current board</span>
                        <span className="text-xs text-muted-foreground/70"></span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 gap-1"
                        onClick={() => setIsExpanded(true)}
                    >
                        <ChevronDown className="w-3 h-3" />
                        <span className="text-xs"></span>
                    </Button>
                </div>
            )}
        </div>
    );
}

export function ChatBubble({ message, excalidrawAPI }: ChatBubbleProps) {
    const isUser = message.role === 'user';
    const isTool = message.role === 'tool';

    let toolImage: string | null = null;
    let textContent = message.content || '';

    // Handle parts (common in Vercel AI SDK / Gemini)
    if (message.parts) {
        textContent = message.parts
            .filter(p => p.type === 'text')
            .map(p => p.content)
            .join('');

        // Check for tool images (read_board output)
        message.parts.forEach(part => {
            if (part.type === 'tool-result') {
                const result = part.result || part.output;
                if (result && result.image) {
                    toolImage = result.image;
                }
            } else if (part.type === 'tool-call' && part.output && part.output.image) {
                // Client side tool call that already has output attached
                toolImage = part.output.image;
            }
        });
    }

    if (isTool && !toolImage && !textContent) return null;

    return (
        <div className={cn(
            "flex w-full",
            isUser ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm",
                isUser
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : isTool
                        ? "bg-transparent border-none shadow-none p-0 max-w-full w-full"
                        : "bg-white border border-border text-foreground rounded-tl-sm dark:bg-muted/40"
            )}>
                {/* Text Content with Markdown */}
                {textContent && (
                    <div className={cn(
                        "markdown-content",
                        isTool ? "font-mono text-xs text-muted-foreground bg-muted p-2 rounded mb-2" : ""
                    )}>
                        {isTool ? (
                            <div className="whitespace-pre-wrap">{textContent}</div>
                        ) : (
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={useMemo(() => ({
                                    code({ node, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const isMermaid = match && match[1] === 'mermaid';

                                        if (isMermaid) {
                                            const codeContent = String(children || '').trim();
                                            if (!codeContent) return null;
                                            return <MermaidDiagram code={codeContent} excalidrawAPI={excalidrawAPI} />;
                                        }

                                        return match ? (
                                            <div className="rounded-md bg-muted/50 p-3 my-2 border border-border/50 overflow-x-auto">
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            </div>
                                        ) : (
                                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                                {children}
                                            </code>
                                        );
                                    }
                                }), [excalidrawAPI])}
                            >
                                {textContent}
                            </ReactMarkdown>
                        )}
                    </div>
                )}

                {/* Tool Calls indicators (for assistant messages) */}
                {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="flex flex-col gap-1 my-1">
                        {message.toolCalls.map((toolCall: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg border border-border/50 font-mono">
                                <Terminal className="w-3.5 h-3.5" />
                                <span>Calling <span className="font-semibold text-foreground">{toolCall.function.name}</span>...</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Images (from read_board) */}
                {toolImage && (
                    <CollapsibleImage imageSrc={toolImage} />
                )}
            </div>
        </div>
    );
}
