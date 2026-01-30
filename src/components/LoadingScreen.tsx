import React, { useState, useEffect } from 'react';

const LIVA_TIPS = [
    {
        tip: "Press Cmd/Ctrl + K to open the command menu from anywhere",
        category: "Shortcut"
    },
    {
        tip: "Press Cmd/Ctrl + J to ask AI for help while on a board",
        category: "Shortcut"
    },
    {
        tip: "Your boards sync in real-time across all devices instantly",
        category: "Sync"
    },
    {
        tip: "Share your board publicly to collaborate with anyone in real-time",
        category: "Collaboration"
    },
    {
        tip: "Use the history feature to restore or fork previous versions",
        category: "Feature"
    },
    {
        tip: "Double-click anywhere on the canvas to start typing text",
        category: "Tip"
    },
    {
        tip: "Hold Space and drag to pan around your board",
        category: "Navigation"
    },
    {
        tip: "Liva reconnects automatically when you're back online",
        category: "Feature"
    },
    {
        tip: "Press 'V' for select, 'R' for rectangle, 'E' for ellipse, 'A' for arrow",
        category: "Shortcut"
    },
    {
        tip: "Duplicate boards to reuse layouts and create templates",
        category: "Workflow"
    },
    {
        tip: "Your changes are automatically saved as you draw",
        category: "Feature"
    },
    {
        tip: "Connect your YouTube channel to import video content",
        category: "Integration"
    },
    {
        tip: "Try System Shots to master concepts through interactive quizzes",
        category: "Learning"
    },
    {
        tip: "Use Scroll wheel to zoom in and out of your board",
        category: "Navigation"
    },
    {
        tip: "Press 'L' for line, 'P' for pencil, 'T' for text tool",
        category: "Shortcut"
    },
];

const CATEGORY_COLORS: Record<string, string> = {
    "Shortcut": "text-blue-400",
    "Sync": "text-purple-400",
    "Collaboration": "text-green-400",
    "Feature": "text-cyan-400",
    "Tip": "text-amber-400",
    "Navigation": "text-pink-400",
    "Workflow": "text-orange-400",
    "Integration": "text-indigo-400",
    "Learning": "text-emerald-400",
};

export function LoadingScreen() {
    const [currentTipIndex, setCurrentTipIndex] = useState(() => 
        Math.floor(Math.random() * LIVA_TIPS.length)
    );
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentTipIndex((prev) => (prev + 1) % LIVA_TIPS.length);
                setIsTransitioning(false);
            }, 300);
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    const currentTip = LIVA_TIPS[currentTipIndex];

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-background overflow-hidden">
            {/* Animated background gradient orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            {/* Main content */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Animated Logo */}
                <div className="relative mb-8">
                    {/* Outer rotating ring */}
                    <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-accent/20 animate-[spin_8s_linear_infinite]" />
                    
                    {/* Middle pulsing ring */}
                    <div className="absolute inset-2 w-20 h-20 rounded-full border border-accent/30 animate-ping" style={{ animationDuration: '2s' }} />
                    
                    {/* Inner logo container */}
                    <div className="relative w-24 h-24 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center shadow-lg shadow-accent/25 animate-pulse">
                            <span className="text-2xl font-bold text-white">L</span>
                        </div>
                    </div>

                    {/* Floating particles */}
                    <div className="absolute -top-2 -right-2 w-3 h-3 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="absolute -bottom-1 -left-3 w-2 h-2 bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    <div className="absolute top-1/2 -right-4 w-2 h-2 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                </div>

                {/* Brand name with gradient */}
                <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-accent via-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Liva
                </h1>

                {/* Tagline */}
                <p className="text-muted-foreground text-sm mb-12">
                    Collaborative whiteboarding, reimagined
                </p>

                {/* Loading indicator dots */}
                <div className="flex items-center gap-1.5 mb-12">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-accent/80"
                            style={{
                                animation: 'pulse 1.4s ease-in-out infinite',
                                animationDelay: `${i * 0.15}s`,
                            }}
                        />
                    ))}
                </div>

                {/* Tip card */}
                <div className="max-w-md px-6">
                    <div 
                        className={`transition-all duration-300 ${
                            isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                        }`}
                    >
                        {/* Category badge */}
                        <div className="flex justify-center mb-3">
                            <span className={`text-xs font-medium uppercase tracking-wider ${CATEGORY_COLORS[currentTip.category] || 'text-muted-foreground'}`}>
                                {currentTip.category}
                            </span>
                        </div>
                        
                        {/* Tip text */}
                        <p className="text-center text-foreground/80 text-base leading-relaxed">
                            {currentTip.tip}
                        </p>
                    </div>
                </div>

                {/* Progress dots for tips */}
                <div className="flex items-center gap-1.5 mt-8">
                    {LIVA_TIPS.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setIsTransitioning(true);
                                setTimeout(() => {
                                    setCurrentTipIndex(i);
                                    setIsTransitioning(false);
                                }, 150);
                            }}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                i === currentTipIndex 
                                    ? 'bg-accent w-4' 
                                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                            }`}
                            aria-label={`Go to tip ${i + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* Bottom decorative line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

            {/* Custom animation styles */}
            <style>{`
                @keyframes pulse {
                    0%, 80%, 100% {
                        transform: scale(0.6);
                        opacity: 0.4;
                    }
                    40% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}
