
import React, { useState } from 'react';
import { SendHorizontal, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Assuming shadcn-like UI

interface InputBarProps {
    onSend: (message: string) => void;
    isLoading: boolean;
}

export function InputBar({ onSend, isLoading }: InputBarProps) {
    const [input, setInput] = useState('');

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;
        onSend(input);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2 items-end">
            <div className="flex-1 bg-white dark:bg-muted/30 border rounded-2xl p-1 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message..."
                    rows={1}
                    className="w-full bg-transparent border-none focus:outline-none resize-none px-4 py-3 min-h-[48px] max-h-[120px]"
                    style={{ height: 'auto' }} // TODO: auto-grow logic
                />
            </div>
            <div className="flex flex-col gap-2">
                <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="rounded-full w-10 h-10"
                    title="Push to Talk"
                >
                    <Mic className="w-5 h-5" />
                </Button>
                <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isLoading}
                    className="rounded-full w-10 h-10"
                >
                    <SendHorizontal className="w-5 h-5" />
                </Button>
            </div>
        </form>
    );
}
