import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '../lib/auth-client';

interface YouTubeChannel {
    integrationId: string;
    channelId: string;
    channelTitle: string;
    status: 'connected' | 'revoked' | 'error';
    connectedAt: number;
}

export function IntegrationsPage() {
    const { data: session } = useSession();
    const [channels, setChannels] = useState<YouTubeChannel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        if (session) {
            fetchChannels();
        } else {
            // If not logged in, wait or show something (auth is usually handled by parent)
            setIsLoading(false);
        }
    }, [session]);

    // Handle OAuth Callback success/error display
    useEffect(() => {
        const url = new URL(window.location.href);
        const status = url.searchParams.get('status');
        if (status === 'success') {
            toast.success('YouTube channel connected successfully');
            window.history.replaceState({}, '', '/app/integrations');
            fetchChannels();
        } else if (status === 'error') {
            toast.error('Failed to connect YouTube channel');
            window.history.replaceState({}, '', '/app/integrations');
        }
    }, [session]);

    const fetchChannels = async () => {
        try {
            const res = await fetch('/api/integrations/youtube', {
                headers: {
                    'X-Liva-User-Id': session?.user?.id || ''
                }
            });
            if (res.ok) {
                const data = await res.json() as { channels?: YouTubeChannel[] };
                setChannels(data.channels || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const res = await fetch('/api/auth/youtube/start', {
                method: 'POST',
                headers: {
                    'X-Liva-User-Id': session?.user?.id || ''
                }
            });
            if (!res.ok) throw new Error("Failed to start auth");
            const data = await res.json() as { redirectUrl?: string };
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            }
        } catch (e) {
            toast.error("Failed to start connection");
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async (integrationId: string) => {
        if (!confirm('Are you sure you want to disconnect this channel?')) return;
        try {
            const res = await fetch(`/api/integrations/youtube/${integrationId}`, {
                method: 'DELETE',
                headers: {
                    'X-Liva-User-Id': session?.user?.id || ''
                }
            });
            if (res.ok) {
                toast.success("Disconnected");
                fetchChannels();
            } else {
                toast.error("Failed to disconnect");
            }
        } catch (e) {
            toast.error("Failed to disconnect");
        }
    };

    if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin w-8 h-8 opacity-50" /></div>;

    return (
        <div className="space-y-8 font-sans">
            <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground text-balance">
                    Integrations
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl text-pretty leading-relaxed">
                    Manage your connected services and external accounts.
                </p>
            </div>

            <Card className="border-border/50 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                            </svg>
                        </div>
                        YouTube
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <p className="text-muted-foreground">
                            Connect your YouTube channel to allow Liva to upload recordings directly to your channel.
                        </p>

                        <div className="space-y-3">
                            {channels.map(channel => (
                                <div key={channel.integrationId} className="flex items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/50 transition-colors">
                                    <div>
                                        <h3 className="font-semibold">{channel.channelTitle}</h3>
                                        <p className="text-xs text-muted-foreground font-mono mt-1 opacity-70">ID: {channel.channelId}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Connected: {new Date(channel.connectedAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {channel.status}
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive transition-colors" onClick={() => handleDisconnect(channel.integrationId)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {channels.length === 0 && (
                            <div className="p-8 border border-dashed rounded-xl flex flex-col items-center justify-center text-center space-y-2 bg-muted/10">
                                <p className="text-muted-foreground">No channels connected yet</p>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/5 border-t p-6">
                    <Button onClick={handleConnect} disabled={isConnecting} className="w-full sm:w-auto">
                        {isConnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {channels.length > 0 ? 'Connect Another Channel' : 'Connect YouTube Channel'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
