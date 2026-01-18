import React, { useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { RecordingSessionController } from '../src/RecordingSessionController';

import '@excalidraw/excalidraw/index.css';

const uploadConfig = {
    endpoint: '/api/recording/upload',
};

import { Inspect } from './Inspect';

export function Playground() {
    const [mode, setMode] = useState<'record' | 'inspect'>('record');
    const [controller, setController] = useState<RecordingSessionController | null>(null);
    const [status, setStatus] = useState<string>('idle');
    const [sessionId, setSessionId] = useState<string>('');
    const [lastRecordedSessionId, setLastRecordedSessionId] = useState<string>('');

    const handleStart = async () => {
        if (controller) {
            try {
                await controller.start();
                setSessionId(controller.sessionId || '');
                setStatus('recording');
            } catch (e) {
                console.error('Failed to start recording', e);
                alert('Failed to start recording: ' + e);
            }
        }
    };

    const handleStop = async () => {
        if (controller) {
            const sid = controller.sessionId;
            await controller.stop();
            setStatus('stopped');
            if (sid) setLastRecordedSessionId(sid);
        }
    };

    if (mode === 'inspect') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
                <div style={{ padding: '0.5rem', background: '#eee', display: 'flex', gap: '1rem' }}>
                    <button onClick={() => setMode('record')}>Record</button>
                    <button disabled>Inspect</button>
                    {lastRecordedSessionId && <span>Last Session: {lastRecordedSessionId}</span>}
                </div>
                <div style={{ flex: 1 }}>
                    <Inspect />
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <div style={{ padding: '0.5rem', background: '#eee', display: 'flex', gap: '1rem' }}>
                <button disabled>Record</button>
                <button onClick={() => setMode('inspect')}>Inspect</button>
            </div>
            <div style={{ padding: '1rem', borderBottom: '1px solid #ccc', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Recorder Test</h2>
                <div>
                    Status: <strong>{status}</strong>
                </div>
                {sessionId && <div>Session: <code>{sessionId}</code></div>}

                <button onClick={handleStart} disabled={status === 'recording'}>Start Recording</button>
                <button onClick={handleStop} disabled={status !== 'recording'}>Stop Recording</button>
            </div>
            <div style={{ flex: 1 }}>
                <Excalidraw
                    excalidrawAPI={(api) => {
                        if (!controller) {
                            const ctrl = new RecordingSessionController(api, uploadConfig);
                            setController(ctrl);
                        }
                    }}
                    onChange={(elements, appState, files) => {
                        if (controller) {
                            controller.handleExcalidrawChange(elements, appState, files);
                        }
                    }}
                />
            </div>
        </div>
    );
}
