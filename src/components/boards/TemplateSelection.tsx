import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "../../trpcClient";
// @ts-ignore
import { Card } from "../ui/card";
import { GitGraph, Layout, Check, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface Template {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
}

interface TemplateSelectionProps {
    onSelect: (templateId: string | null) => void;
    selectedTemplateId: string | null;
}

const ICONS: Record<string, any> = {
    GitGraph,
    Layout
};

export function TemplateSelection({ onSelect, selectedTemplateId }: TemplateSelectionProps) {
    const { data: templates = [], isLoading } = useQuery({
        queryKey: ['templates'],
        queryFn: () => trpcClient.templates.list.query()
    });

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div
                onClick={() => onSelect(null)}
                className={cn(
                    "cursor-pointer group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:shadow-md",
                    selectedTemplateId === null
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/50"
                )}
            >
                <div className="flex items-start gap-3">
                    <div className={cn(
                        "rounded-lg p-2.5 transition-colors",
                        selectedTemplateId === null ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary"
                    )}>
                        <Layout className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-medium leading-none">Blank Board</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">Start with a clean canvas</p>
                    </div>
                    {selectedTemplateId === null && (
                        <div className="absolute top-4 right-4">
                            <div className="rounded-full bg-primary p-1 text-primary-foreground">
                                <Check className="w-3 h-3" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {templates?.map((template: Template) => {
                const Icon = ICONS[template.icon] || Layout;
                const isSelected = selectedTemplateId === template.id;

                return (
                    <div
                        key={template.id}
                        onClick={() => onSelect(template.id)}
                        className={cn(
                            "cursor-pointer group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:shadow-md",
                            isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border bg-card hover:border-primary/50"
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <div className={cn(
                                "rounded-lg p-2.5 transition-colors",
                                isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary"
                            )}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-medium leading-none">{template.name}</h4>
                                <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
                            </div>
                            {isSelected && (
                                <div className="absolute top-4 right-4">
                                    <div className="rounded-full bg-primary p-1 text-primary-foreground">
                                        <Check className="w-3 h-3" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
