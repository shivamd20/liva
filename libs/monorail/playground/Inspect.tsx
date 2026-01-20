import { useState, useEffect } from 'react';

export function Inspect({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
    const [status, setStatus] = useState("Loading...");
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [manifest, setManifest] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [chunks, setChunks] = useState<Blob[]>([]);

    useEffect(() => {
        loadSession();
    }, [sessionId]);

    const loadSession = async () => {
        try {
            setStatus("Loading manifest...");
            const res = await fetch(`/api/monorail/session/${sessionId}/manifest`);
            if (!res.ok) throw new Error("Failed to load manifest");
            const data = await res.json();
            setManifest(data);

            if (data.chunks_uploaded > 0) {
                setStatus(`Downloading ${data.chunks_uploaded} chunks...`);
                const chunks: Blob[] = [];
                for (let i = 0; i < data.chunks_uploaded; i++) {
                    const chunkRes = await fetch(`/api/monorail/session/${sessionId}/chunk/${i}`);
                    if (!chunkRes.ok) throw new Error(`Failed to load chunk ${i}`);
                    chunks.push(await chunkRes.blob());
                }

                console.log("Stitching chunks...", chunks);
                setChunks(chunks); // Store individual chunks
                const completeBlob = new Blob(chunks, { type: "video/webm" });
                const url = URL.createObjectURL(completeBlob);
                setVideoUrl(url);
                setStatus("Ready");
            } else {
                setStatus("No chunks found");
            }

        } catch (e) {
            console.error(e);
            setError((e as Error).message);
            setStatus("Error");
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20, overflowY: 'auto' }}>
            <div style={{ marginBottom: 20, display: 'flex', gap: 20, alignItems: 'center' }}>
                <button onClick={onBack}>&larr; Back</button>
                <h2>Inspect Session: {sessionId}</h2>
            </div>

            {error && <div style={{ color: 'red', marginBottom: 20 }}>Error: {error}</div>}

            <div style={{ marginBottom: 10 }}>Status: {status}</div>

            {manifest && (
                <div style={{ marginBottom: 20, fontSize: '0.9em', color: '#666' }}>
                    Created: {new Date(manifest.createdAt).toLocaleString()} | Status: {manifest.status}
                </div>
            )}

            <div style={{ marginBottom: 20, background: '#000', borderRadius: 8, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                {videoUrl ? (
                    <video
                        src={videoUrl}
                        controls
                        autoPlay
                        style={{ maxWidth: '100%', maxHeight: '600px' }}
                    />
                ) : (
                    <div style={{ color: '#fff' }}>{status === 'Error' ? 'Failed to load video' : 'Loading video...'}</div>
                )}
            </div>

            {chunks.length > 0 && (
                <div>
                    <h3>Individual Segments ({chunks.length})</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 20 }}>
                        {chunks.map((chunk, i) => (
                            <div key={i} style={{ border: '1px solid #ccc', padding: 10, borderRadius: 8 }}>
                                <div style={{ marginBottom: 5, fontWeight: 'bold' }}>Segment {i}</div>
                                <div style={{ fontSize: '0.8em', marginBottom: 10 }}>Size: {(chunk.size / 1024).toFixed(1)} KB</div>
                                <video
                                    src={URL.createObjectURL(chunk)}
                                    controls
                                    style={{ width: '100%', borderRadius: 4, maxHeight: 150, backgroundColor: '#000' }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
