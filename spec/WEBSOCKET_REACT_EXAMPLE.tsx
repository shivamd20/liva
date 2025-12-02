/**
 * React WebSocket Integration Example
 * 
 * This file demonstrates how to integrate WebSocket real-time updates
 * into your React application alongside existing tRPC queries.
 */

import { useEffect, useState, useRef } from 'react';
import type { NoteCurrent } from './src/notes/types';

// ============================================================================
// Custom Hook: useNoteWebSocket
// ============================================================================

interface UseNoteWebSocketOptions {
  noteId: string;
  enabled?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

interface UseNoteWebSocketReturn {
  note: NoteCurrent | null;
  connected: boolean;
  reconnect: () => void;
  disconnect: () => void;
}

export function useNoteWebSocket({
  noteId,
  enabled = true,
  onConnect,
  onDisconnect,
  onError,
}: UseNoteWebSocketOptions): UseNoteWebSocketReturn {
  const [note, setNote] = useState<NoteCurrent | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = () => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/note/${noteId}`);

    ws.onopen = () => {
      setConnected(true);
      onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setNote(message.data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      onError?.(error);
    };

    ws.onclose = () => {
      setConnected(false);
      onDisconnect?.();
      wsRef.current = null;

      // Auto-reconnect after 3 seconds
      if (enabled) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    wsRef.current = ws;
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  };

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [noteId, enabled]);

  return {
    note,
    connected,
    reconnect: connect,
    disconnect,
  };
}

// ============================================================================
// Example Component: LiveNoteViewer
// ============================================================================

interface LiveNoteViewerProps {
  noteId: string;
}

export function LiveNoteViewer({ noteId }: LiveNoteViewerProps) {
  const { note, connected } = useNoteWebSocket({ noteId });

  return (
    <div className="live-note-viewer">
      <div className="status-bar">
        <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '🟢 Live' : '🔴 Offline'}
        </span>
      </div>

      {note ? (
        <div className="note-content">
          <h2>{note.title || 'Untitled'}</h2>
          <div className="note-meta">
            <span>Version: {note.version}</span>
            <span>Updated: {new Date(note.updatedAt).toLocaleString()}</span>
          </div>
          <pre>{JSON.stringify(note.blob, null, 2)}</pre>
        </div>
      ) : (
        <div className="loading">Loading note...</div>
      )}
    </div>
  );
}

// ============================================================================
// Example Component: CollaborativeEditor
// Combines tRPC mutations with WebSocket updates
// ============================================================================

import { trpc } from './trpcClient'; // Your tRPC client

interface CollaborativeEditorProps {
  noteId: string;
}

export function CollaborativeEditor({ noteId }: CollaborativeEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  // Use WebSocket for real-time updates from other users
  const { note, connected } = useNoteWebSocket({ noteId });
  
  // Use tRPC for mutations
  const updateMutation = trpc.updateNote.useMutation();

  // Update local state when WebSocket receives updates
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(JSON.stringify(note.blob, null, 2));
    }
  }, [note]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: noteId,
        title,
        blob: JSON.parse(content),
      });
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  return (
    <div className="collaborative-editor">
      <div className="toolbar">
        <span className={connected ? 'live-badge' : 'offline-badge'}>
          {connected ? '🟢 Live' : '🔴 Offline'}
        </span>
        <button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Note content (JSON)"
        rows={20}
      />

      {note && (
        <div className="version-info">
          Version: {note.version} | 
          Last updated: {new Date(note.updatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example Component: MultiNoteMonitor
// Monitor multiple notes simultaneously
// ============================================================================

interface MultiNoteMonitorProps {
  noteIds: string[];
}

export function MultiNoteMonitor({ noteIds }: MultiNoteMonitorProps) {
  const [notes, setNotes] = useState<Map<string, NoteCurrent>>(new Map());

  useEffect(() => {
    const connections = new Map<string, WebSocket>();

    noteIds.forEach((noteId) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/note/${noteId}`);

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        setNotes((prev) => new Map(prev).set(noteId, message.data));
      };

      connections.set(noteId, ws);
    });

    return () => {
      connections.forEach((ws) => ws.close());
    };
  }, [noteIds]);

  return (
    <div className="multi-note-monitor">
      <h2>Monitoring {noteIds.length} notes</h2>
      <div className="notes-grid">
        {Array.from(notes.entries()).map(([id, note]) => (
          <div key={id} className="note-card">
            <h3>{note.title || 'Untitled'}</h3>
            <p>Version: {note.version}</p>
            <p>Updated: {new Date(note.updatedAt).toLocaleTimeString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Example: Presence Indicator
// Show who's currently viewing a note
// ============================================================================

interface PresenceIndicatorProps {
  noteId: string;
}

export function PresenceIndicator({ noteId }: PresenceIndicatorProps) {
  const { connected } = useNoteWebSocket({ noteId });
  const [viewerCount, setViewerCount] = useState(1);

  // In a real implementation, you'd track this via the Durable Object
  // This is a simplified example

  return (
    <div className="presence-indicator">
      {connected && (
        <div className="viewers">
          👁️ {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CSS Styles (example)
// ============================================================================

const styles = `
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-indicator.connected {
  background-color: #d4edda;
  color: #155724;
}

.status-indicator.disconnected {
  background-color: #f8d7da;
  color: #721c24;
}

.live-badge {
  background-color: #28a745;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.offline-badge {
  background-color: #dc3545;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}
`;

// ============================================================================
// Usage Examples
// ============================================================================

/*

// Basic usage
<LiveNoteViewer noteId="my-note-id" />

// Collaborative editor
<CollaborativeEditor noteId="my-note-id" />

// Monitor multiple notes
<MultiNoteMonitor noteIds={['note-1', 'note-2', 'note-3']} />

// With custom callbacks
const MyComponent = () => {
  const { note, connected } = useNoteWebSocket({
    noteId: 'my-note',
    onConnect: () => console.log('Connected!'),
    onDisconnect: () => console.log('Disconnected!'),
    onError: (error) => console.error('Error:', error),
  });

  return <div>{note?.title}</div>;
};

*/
