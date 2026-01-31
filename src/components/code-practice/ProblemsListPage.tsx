/**
 * ProblemsListPage - List of coding problems with premium layout
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProblems, useSolvedProblems, useUserStats } from '../../hooks/useCodePractice';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  CheckCircle2,
  Circle,
  Trophy,
  Target,
  Zap,
  ArrowRight,
  Search,
  Filter,
  X,
  LayoutGrid,
  List as ListIcon,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this exists, standard in shadcn

type Difficulty = 'easy' | 'medium' | 'hard';
type StatusFilter = 'all' | 'solved' | 'unsolved';

const difficultyConfig: Record<Difficulty, { color: string; label: string; bg: string }> = {
  easy: { color: 'text-green-500', bg: 'bg-green-500/10', label: 'Easy' },
  medium: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Medium' },
  hard: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Hard' },
};

export default function ProblemsListPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');

  const { data: problems, isLoading: problemsLoading } = useProblems();
  const { data: solvedData } = useSolvedProblems();
  const { data: stats } = useUserStats();

  const solvedSet = new Set(solvedData?.solvedIds ?? []);

  // Extract unique topics
  const allTopics = useMemo(() => {
    if (!problems) return [];
    const topicsSet = new Set<string>();
    problems.forEach(p => p.topics.forEach(t => topicsSet.add(t)));
    return Array.from(topicsSet).sort();
  }, [problems]);

  // Filter logic
  const filteredProblems = useMemo(() => {
    if (!problems) return [];

    return problems.filter(problem => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!problem.title.toLowerCase().includes(query) &&
          !problem.topics.some(t => t.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Difficulty
      if (difficultyFilter !== 'all' && problem.difficulty !== difficultyFilter) return false;

      // Status
      const isSolved = solvedSet.has(problem.problemId);
      if (statusFilter === 'solved' && !isSolved) return false;
      if (statusFilter === 'unsolved' && isSolved) return false;

      // Topic
      if (selectedTopic !== 'all' && !problem.topics.includes(selectedTopic)) return false;

      return true;
    });
  }, [problems, searchQuery, difficultyFilter, statusFilter, selectedTopic, solvedSet]);

  const toggleStatus = (id: string) => solvedSet.has(id);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Hero / Header Section */}
      <div className="border-b border-border/40 bg-muted/20">
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Practice Problems</h1>
              <p className="text-muted-foreground text-lg">
                Master data structures and algorithms with curated challenges.
              </p>
            </div>

            {/* Stats Cards */}
            {stats && (
              <div className="flex gap-4">
                <div className="bg-card border rounded-xl p-4 min-w-[140px] shadow-sm">
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-500" /> Solved
                  </div>
                  <div className="text-2xl font-bold">{stats.solved}</div>
                </div>
                <div className="bg-card border rounded-xl p-4 min-w-[140px] shadow-sm">
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-500" /> Acceptance
                  </div>
                  <div className="text-2xl font-bold">
                    {stats.submissions > 0
                      ? Math.round((stats.solved / stats.submissions) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-8 flex-1">

        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 justify-between items-start md:items-center">

          <div className="flex-1 w-full md:max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search problems or topics..."
              className="pl-9 bg-muted/30 border-muted-foreground/20 focus-visible:ring-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <div className="flex items-center bg-muted/30 p-1 rounded-lg border border-border/50">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2"
                onClick={() => setViewMode('list')}
              >
                <ListIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>

            {/* Difficulty Filter */}
            <select
              className="h-9 px-3 rounded-md border border-input bg-background/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value as any)}
            >
              <option value="all">Any Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>

            {/* Status Filter */}
            <select
              className="h-9 px-3 rounded-md border border-input bg-background/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">Any Status</option>
              <option value="solved">Solved</option>
              <option value="unsolved">Unsolved</option>
            </select>
          </div>
        </div>

        {/* Categories / Topics Pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={selectedTopic === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTopic('all')}
            className="rounded-full text-xs h-7"
          >
            All Topics
          </Button>
          {allTopics.map(topic => (
            <Button
              key={topic}
              variant={selectedTopic === topic ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTopic(topic)}
              className="rounded-full text-xs h-7 capitalize"
            >
              {topic.replace('-', ' ')}
            </Button>
          ))}
        </div>

        {/* Content Area */}
        {problemsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 w-full bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="text-center py-20 border rounded-xl bg-muted/10 border-dashed">
            <Filter className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No problems found</h3>
            <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
            <Button onClick={() => {
              setSearchQuery('');
              setDifficultyFilter('all');
              setStatusFilter('all');
              setSelectedTopic('all');
            }}>
              <X className="w-4 h-4 mr-2" /> Clear Filters
            </Button>
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid'
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-3"
          )}>
            {filteredProblems.map(problem => {
              const isSolved = solvedSet.has(problem.problemId);
              const config = difficultyConfig[problem.difficulty as Difficulty];

              if (viewMode === 'grid') {
                return (
                  <div
                    key={problem.problemId}
                    onClick={() => navigate(`/practice/${problem.problemId}`)}
                    className="group bg-card border hover:border-primary/40 transition-all duration-200 rounded-xl p-5 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", config.bg, config.color, "ring-[currentColor]/20")}>
                          {config.label}
                        </div>
                        {isSolved && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      </div>
                      <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {problem.title}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {problem.topics.slice(0, 3).map(t => (
                          <span key={t} className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded capitalize">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }

              // List View
              return (
                <div
                  key={problem.problemId}
                  onClick={() => navigate(`/practice/${problem.problemId}`)}
                  className="group bg-card border hover:border-primary/30 transition-all rounded-lg p-4 cursor-pointer flex items-center gap-4 hover:shadow-sm"
                >
                  <div className="shrink-0 w-8 flex justify-center">
                    {isSolved ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/20 group-hover:border-primary/40" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium group-hover:text-primary truncate">{problem.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {problem.topics.slice(0, 3).map((t, i) => (
                        <span key={t} className="capitalize">
                          {t}
                          {i < Math.min(problem.topics.length, 3) - 1 && <span className="mx-1">•</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="hidden md:flex shrink-0 w-32 justify-center">
                    <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full", config.bg, config.color)}>
                      {config.label}
                    </span>
                  </div>

                  <div className="shrink-0">
                    <Button variant="ghost" size="icon" className="text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
