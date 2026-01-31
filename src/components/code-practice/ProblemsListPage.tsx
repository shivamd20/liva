/**
 * ProblemsListPage - List of coding problems with filters
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProblems, useSolvedProblems, useUserStats } from '../../hooks/useCodePractice';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { CheckCircle2, Code2, Trophy, Target, FileCode, ArrowLeft } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard';

const difficultyColors: Record<Difficulty, string> = {
  easy: 'bg-green-500/10 text-green-500 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  hard: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export default function ProblemsListPage() {
  const navigate = useNavigate();
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | undefined>();
  
  const { data: problems, isLoading: problemsLoading } = useProblems(
    difficultyFilter ? { difficulty: difficultyFilter } : undefined
  );
  const { data: solvedData } = useSolvedProblems();
  const { data: stats } = useUserStats();
  
  const solvedSet = new Set(solvedData?.solvedIds ?? []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/board')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Code2 className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold">Code Practice</h1>
              </div>
            </div>
            
            {/* Stats */}
            {stats && (
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="text-muted-foreground">Solved:</span>
                  <span className="font-medium">{stats.solved}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground">Attempted:</span>
                  <span className="font-medium">{stats.attempted}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-purple-500" />
                  <span className="text-muted-foreground">Submissions:</span>
                  <span className="font-medium">{stats.submissions}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground mr-2">Difficulty:</span>
          <Button
            variant={difficultyFilter === undefined ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDifficultyFilter(undefined)}
          >
            All
          </Button>
          <Button
            variant={difficultyFilter === 'easy' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDifficultyFilter('easy')}
            className={difficultyFilter === 'easy' ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            Easy
          </Button>
          <Button
            variant={difficultyFilter === 'medium' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDifficultyFilter('medium')}
            className={difficultyFilter === 'medium' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
          >
            Medium
          </Button>
          <Button
            variant={difficultyFilter === 'hard' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDifficultyFilter('hard')}
            className={difficultyFilter === 'hard' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            Hard
          </Button>
        </div>

        {/* Problems Grid */}
        {problemsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-3/4" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="flex gap-2">
                    <div className="h-6 bg-muted rounded w-16" />
                    <div className="h-6 bg-muted rounded w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : problems && problems.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {problems.map((problem) => {
              const isSolved = solvedSet.has(problem.problemId);
              
              return (
                <Card
                  key={problem.problemId}
                  className="cursor-pointer hover:border-primary/50 transition-colors group"
                  onClick={() => navigate(`/practice/${problem.problemId}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-medium group-hover:text-primary transition-colors">
                        {problem.title}
                      </CardTitle>
                      {isSolved && (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Badge 
                        variant="outline" 
                        className={difficultyColors[problem.difficulty as Difficulty]}
                      >
                        {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                      </Badge>
                      {problem.topics.slice(0, 2).map((topic) => (
                        <Badge key={topic} variant="secondary" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                      {problem.topics.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{problem.topics.length - 2}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Code2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No problems found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
