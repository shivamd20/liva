import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface Command {
    id: string;
    title: string;
    icon?: React.ReactNode;
    shortcut?: string[];
    action: () => void;
    section?: string;
    keywords?: string[]; // For better search
}

interface CommandMenuContextType {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    registerCommand: (command: Command) => void;
    unregisterCommand: (commandId: string) => void;
    commands: Command[];
}

const CommandMenuContext = createContext<CommandMenuContextType | undefined>(undefined);

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [commands, setCommands] = useState<Command[]>([]);

    // Toggle with Cmd+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const registerCommand = useCallback((command: Command) => {
        setCommands((prev) => {
            // Avoid duplicates
            if (prev.some((c) => c.id === command.id)) return prev;
            return [...prev, command];
        });
    }, []);

    const unregisterCommand = useCallback((commandId: string) => {
        setCommands((prev) => prev.filter((c) => c.id !== commandId));
    }, []);

    return (
        <CommandMenuContext.Provider
            value={{
                isOpen,
                setIsOpen,
                registerCommand,
                unregisterCommand,
                commands,
            }}
        >
            {children}
        </CommandMenuContext.Provider>
    );
}

export function useCommandMenu() {
    const context = useContext(CommandMenuContext);
    if (!context) {
        throw new Error('useCommandMenu must be used within a CommandMenuProvider');
    }
    return context;
}
