import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { trpcClient } from '../../trpcClient';
import { useProblems } from '../../hooks/useCodePractice';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ProblemSummary {
    problemId: string;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    topics: string[];
}

export default function AdminMigrationPage() {
    const [isSeeding, setIsSeeding] = useState(false);

    // Fetch current problems via specialized hook
    const { data: problems, refetch } = useProblems();

    // Seed mutation using react-query directly with trpcClient
    const seedMutation = useMutation({
        mutationFn: () => trpcClient.codePractice.adminSeedProblems.mutate(),
        onSuccess: (data: { seeded: number }) => {
            toast.success(`Successfully seeded ${data.seeded} problems!`);
            setIsSeeding(false);
            refetch();
        },
        onError: (err: any) => {
            toast.error(`Seeding failed: ${err.message || 'Unknown error'}`);
            setIsSeeding(false);
        }
    });

    const handleSeed = () => {
        if (!confirm('This will overwrite existing problems in R2/DO associated with the static ID. Continue?')) return;

        setIsSeeding(true);
        seedMutation.mutate();
    };

    return (
        <div className="container mx-auto py-10 max-w-4xl space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Admin: Problem Migration</h1>
                <Button
                    onClick={handleSeed}
                    disabled={isSeeding}
                    className="bg-red-600 hover:bg-red-700 text-white"
                >
                    {isSeeding ? 'Seeding...' : 'Run Migration Check / Sync'}
                </Button>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Current Status (DO Registry)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-mono mb-4">
                            {problems ? `${problems.length} problems registered` : 'Loading...'}
                        </div>

                        {problems && (
                            <div className="border rounded-md">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="p-3">ID</th>
                                            <th className="p-3">Title</th>
                                            <th className="p-3">Difficulty</th>
                                            <th className="p-3">Topics</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {problems.map((p: ProblemSummary) => (
                                            <tr key={p.problemId} className="border-t">
                                                <td className="p-3 font-mono text-xs">{p.problemId}</td>
                                                <td className="p-3">{p.title}</td>
                                                <td className="p-3">
                                                    <Badge variant={p.difficulty === 'hard' ? 'destructive' : p.difficulty === 'medium' ? 'default' : 'secondary'}>
                                                        {p.difficulty}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-muted-foreground">{p.topics.join(', ')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
