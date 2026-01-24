import React from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function BoardNotFound() {
    const navigate = useNavigate();

    return (
        <div className="flex w-screen items-center justify-center h-screen bg-background">
            <div className="flex flex-col items-center text-center max-w-md px-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                    <AlertTriangle className="w-10 h-10 text-accent" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
                    Board Not Found
                </h1>
                <p className="text-lg text-muted-foreground mb-8 text-balance">
                    The board you are looking for does not exist or you do not have permission to view it.
                </p>
                <button
                    onClick={() => navigate('/boards')}
                    className="group relative inline-flex items-center gap-2.5 px-6 py-3.5 text-base font-semibold text-primary-foreground rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary hover:bg-primary/90"
                >
                    <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                    Back to Boards
                </button>
            </div>
        </div>
    );
}
