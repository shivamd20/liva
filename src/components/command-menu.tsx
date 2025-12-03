import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { useCommandMenu } from '@/lib/command-menu-context';
import { Laptop, Moon, Sun, Home, Plus } from 'lucide-react';

export function CommandMenu() {
    const { isOpen, setIsOpen, commands } = useCommandMenu();
    const navigate = useNavigate();
    const { setTheme } = useTheme();

    // Group commands by section
    const groupedCommands = commands.reduce((acc, command) => {
        const section = command.section || 'General';
        if (!acc[section]) acc[section] = [];
        acc[section].push(command);
        return acc;
    }, {} as Record<string, typeof commands>);

    const runCommand = React.useCallback((command: () => void) => {
        setIsOpen(false);
        command();
    }, [setIsOpen]);

    return (
        <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                {/* Dynamic Sections */}
                {Object.entries(groupedCommands).map(([section, sectionCommands]) => (
                    <React.Fragment key={section}>
                        <CommandGroup heading={section}>
                            {sectionCommands.map((command) => (
                                <CommandItem
                                    key={command.id}
                                    onSelect={() => runCommand(command.action)}
                                    value={`${command.title} ${command.keywords?.join(' ') || ''}`}
                                >
                                    {command.icon && <span className="mr-2 h-4 w-4 flex items-center justify-center">{command.icon}</span>}
                                    <span>{command.title}</span>
                                    {command.shortcut && (
                                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">
                                            {command.shortcut.join('')}
                                        </span>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                    </React.Fragment>
                ))}

                {/* Global Navigation */}
                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => runCommand(() => navigate('/boards'))}>
                        <Home className="mr-2 h-4 w-4" />
                        <span>Go to Boards</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/board/new'))}>
                        <Plus className="mr-2 h-4 w-4" />
                        <span>Create New Board</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                {/* Global Theme */}
                <CommandGroup heading="Theme">
                    <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>Light Mode</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
                        <Moon className="mr-2 h-4 w-4" />
                        <span>Dark Mode</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
                        <Laptop className="mr-2 h-4 w-4" />
                        <span>System</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
