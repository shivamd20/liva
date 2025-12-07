"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import BoardsHeader from "./boards-header"
import { trpcClient } from "../../trpcClient"
import { cn } from "../../lib/utils"
import { GitGraph, Layout, Loader2, ArrowRight } from "lucide-react"

interface Template {
    id: string
    name: string
    description: string
    category: string
    icon: string
}

const ICONS: Record<string, any> = {
    GitGraph,
    Layout,
}

export default function TemplateCatalog() {
    const [searchQuery, setSearchQuery] = useState("")
    const navigate = useNavigate()

    const { data: templates = [], isLoading } = useQuery({
        queryKey: ['templates'],
        queryFn: () => trpcClient.templates.list.query()
    })

    const filteredTemplates = templates.filter((template: Template) => {
        return template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase())
    })

    const handleUseTemplate = (templateId: string) => {
        // Navigate to boards page with create modal open and template selected
        navigate(`/board?create=true&templateId=${templateId}`)
    }

    if (isLoading) {
        return (
            <div className="flex w-screen items-center justify-center h-screen bg-background">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-8 bg-accent/20 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-muted rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen min-w-screen bg-background text-foreground">
            <BoardsHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

            <main className="pt-24 pb-16">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    {/* Page heading */}
                    <section className="mb-12">
                        <div className="flex flex-col gap-6">
                            <div className="space-y-3">
                                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground text-balance">
                                    Template Gallery
                                </h1>
                                <p className="text-lg text-muted-foreground max-w-xl text-pretty leading-relaxed">
                                    Jumpstart your project with our curated collection of templates.
                                    Select a template to create a new board.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {/* Blank Board Card - Special Case */}
                            <div
                                className="group relative flex flex-col h-full cursor-pointer animate-fade-up"
                                style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
                                onClick={() => handleUseTemplate('')}
                                tabIndex={0}
                                role="button"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        handleUseTemplate('');
                                    }
                                }}
                            >
                                <div className="block w-full h-full rounded-2xl overflow-hidden bg-card backdrop-blur-xl border border-border shadow-lg shadow-black/5 dark:shadow-black/50 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/60 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background flex flex-col">
                                    {/* Thumbnail/Icon Area */}
                                    <div className="relative aspect-[16/10] overflow-hidden bg-accent/5 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                                        <Layout className="w-16 h-16 text-accent/50 group-hover:text-accent transition-colors duration-300" />
                                    </div>

                                    {/* Content */}
                                    <div className="p-5 flex flex-col flex-1">
                                        <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-accent transition-colors">
                                            Blank Board
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                                            Start from scratch with an empty canvas. Perfect for brainstorming without constraints.
                                        </p>

                                        <div className="mt-auto flex items-center text-sm font-medium text-accent opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                                            Use Template <ArrowRight className="w-4 h-4 ml-1" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Templates */}
                            {filteredTemplates.map((template: Template, index: number) => {
                                const Icon = ICONS[template.icon] || Layout
                                return (
                                    <div
                                        key={template.id}
                                        className="group relative flex flex-col h-full cursor-pointer animate-fade-up"
                                        style={{
                                            animationDelay: `${(index + 1) * 50}ms`,
                                            animationFillMode: "backwards"
                                        }}
                                        onClick={() => handleUseTemplate(template.id)}
                                        tabIndex={0}
                                        role="button"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                handleUseTemplate(template.id);
                                            }
                                        }}
                                    >
                                        <div className="block w-full h-full rounded-2xl overflow-hidden bg-card backdrop-blur-xl border border-border shadow-lg shadow-black/5 dark:shadow-black/50 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/60 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background flex flex-col">
                                            {/* Thumbnail/Icon Area */}
                                            <div className="relative aspect-[16/10] overflow-hidden bg-muted/30 flex items-center justify-center group-hover:bg-accent/5 transition-colors">
                                                <div className="p-4 rounded-xl bg-background/50 backdrop-blur-sm border border-border/50 group-hover:border-accent/30 group-hover:scale-110 transition-all duration-300">
                                                    <Icon className="w-10 h-10 text-muted-foreground group-hover:text-accent transition-colors" />
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="p-5 flex flex-col flex-1">
                                                <div className="flex items-start justify-between mb-2">
                                                    <h3 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                                                        {template.name}
                                                    </h3>
                                                    {template.category && (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted/50 text-xs font-medium text-muted-foreground capitalize">
                                                            {template.category}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                                                    {template.description}
                                                </p>

                                                <div className="mt-auto flex items-center text-sm font-medium text-accent opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                                                    Use Template <ArrowRight className="w-4 h-4 ml-1" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}
