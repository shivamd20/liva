import { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Command, ArrowRight, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

interface IntelligentSearchBarProps {
    onSearch: (query: string) => void;
    onGenerate: (intent: string) => void;
    initialQuery?: string;
    className?: string;
}

export function IntelligentSearchBar({
    onSearch,
    onGenerate,
    initialQuery = '',
    className
}: IntelligentSearchBarProps) {
    const [query, setQuery] = useState(initialQuery);
    const [isFocused, setIsFocused] = useState(false);
    const [showGenerationSuggestion, setShowGenerationSuggestion] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Simple heuristic/simulation for now - in real app could be smarter
    useEffect(() => {
        const isNaturalLanguage = query.split(' ').length > 3 ||
            query.toLowerCase().startsWith('generate') ||
            query.toLowerCase().includes('hard') ||
            query.toLowerCase().includes('master');

        setShowGenerationSuggestion(isNaturalLanguage && query.length > 5);

        const debounce = setTimeout(() => {
            onSearch(query);
        }, 300);

        return () => clearTimeout(debounce);
    }, [query, onSearch]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (showGenerationSuggestion) {
                onGenerate(query);
            } else {
                onSearch(query);
            }
        }
    };

    const placeholders = [
        "Binary search problems that usually break people",
        "I want to master prefix sums for interviews",
        "Generate a harder Two Sum",
        "https://leetcode.com/problems/group-anagrams"
    ];

    const [placeholderIndex, setPlaceholderIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!isFocused) {
                setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
            }
        }, 4000);
        return () => clearInterval(interval);
    }, [isFocused]);

    return (
        <div className={cn("w-full max-w-3xl mx-auto relative group", className)}>
            <div className={cn(
                "relative flex items-center bg-background border rounded-xl overflow-hidden shadow-sm transition-all duration-300",
                isFocused ? "ring-2 ring-primary/20 border-primary shadow-lg scale-[1.01]" : "border-border/60 hover:border-border",
                showGenerationSuggestion && "border-indigo-500/50"
            )}>

                {/* Leading Icon */}
                <div className="pl-4 pr-3 text-muted-foreground">
                    {showGenerationSuggestion ? (
                        <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                    ) : (
                        <Command className="w-5 h-5" />
                    )}
                </div>

                <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)} // Delay to allow click to register
                    onKeyDown={handleKeyDown}
                    placeholder={placeholders[placeholderIndex]}
                    className="flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent text-lg h-14 placeholder:text-muted-foreground/50"
                />

                {/* Action Button */}
                <div className="pr-2">
                    {showGenerationSuggestion ? (
                        <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 transition-all"
                            onClick={() => onGenerate(query)}
                        >
                            Generate
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        query.length > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => setQuery('')}
                            >
                                <span className="sr-only">Clear</span>
                                <span className="text-xl">×</span>
                            </Button>
                        )
                    )}
                </div>
            </div>

            {/* Suggestion Dropdown (Visual Only for now) */}
            {isFocused && !query && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-popover/90 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 z-50">
                    <div className="text-xs font-semibold text-muted-foreground px-3 py-2 uppercase tracking-wider">
                        Suggested actions
                    </div>
                    <div className="grid gap-1">
                        {[
                            "Generate a system design problem",
                            "Practice dynamic programming",
                            "Review my weak topics"
                        ].map((text, i) => (
                            <button
                                key={i}
                                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/50 text-sm flex items-center gap-3 transition-colors group/item"
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent blur
                                    setQuery(text);
                                    setIsFocused(false);
                                    // Check if it's a generation intent
                                    if (text.toLowerCase().startsWith('generate')) {
                                        setTimeout(() => onGenerate(text), 100);
                                    } else {
                                        inputRef.current?.focus();
                                    }
                                }}
                            >
                                <Sparkles className="w-4 h-4 text-indigo-500 opacity-60 group-hover/item:opacity-100" />
                                {text}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
