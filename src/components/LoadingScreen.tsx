import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingScreen() {
    return (
        <div className="flex w-screen items-center justify-center h-screen bg-background">
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-8 w-8 bg-accent/20 rounded-full mb-4 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                </div>
                <div className="h-4 w-32 bg-muted rounded"></div>
            </div>
        </div>
    );
}
