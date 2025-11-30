# WebSocket Real-Time Updates Guide

This guide explains how to use WebSocket connections to receive real-time updates when notes are modified.

## Overview

The NoteDurableObject now supports WebSocket connections, allowing clients to subscribe to real-time updates for specific notes. When a note is created, updated, or reverted, all connected WebSocket clients receive instant notifications.

## Features

- **Real-time Updates**: Receive instant notifications when notes change
- **Initial State**: Get the current note state immediately upon connection
- **Multiple Clients**: Multiple clients can connect to the same note
- **Automatic Cleanup**: Connections are automatically cleaned up on disconnect
- **Type-Safe Messages**: All messages include type information for easy handling

## WebSocket Endpoint

```
ws://your-domain/ws/note/{noteId}
```

Replace `{noteId}` with the ID of the note you want to subscribe to.

## Message Types

All messages are JSON objects with the following structure:

```typescript
{
  type: "initial" | "create" | "update" | "revert",
  data: NoteCurrent
}
```

### Message Types Explained

- **initial**: Sent immediately upon connection with the current note state
- **create**: Sent when a note is first created
- **update**: Sent when a note is updated
- **revert**: Sent when a note is reverted to a previous version

### NoteCurrent Structure

```typescript
{
  id: string;
  version: number;
  title: string | null;
  blob: unknown;  // Your note content
  createdAt: number;
  updatedAt: number;
  collaborators: string[];
}
```

## Usage Examples

### Browser JavaScript

```javascript
// Connect to a note
const noteId = 'my-note-id';
const ws = new WebSocket(`ws://localhost:8787/ws/note/${noteId}`);

ws.onopen = () => {
  console.log('Connected to note:', noteId);
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'initial':
      console.log('Initial state:', message.data);
      break;
    case 'update':
      console.log('Note updated:', message.data);
      // Update your UI here
      break;
    case 'revert':
      console.log('Note reverted:', message.data);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};

// Clean up when done
ws.close();
```

### React Hook Example

```typescript
import { useEffect, useState } from 'react';

function useNoteWebSocket(noteId: string) {
  const [note, setNote] = useState<NoteCurrent | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8787/ws/note/${noteId}`);

    ws.onopen = () => setConnected(true);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setNote(message.data);
    };

    ws.onclose = () => setConnected(false);

    return () => ws.close();
  }, [noteId]);

  return { note, connected };
}

// Usage in component
function NoteViewer({ noteId }: { noteId: string }) {
  const { note, connected } = useNoteWebSocket(noteId);

  return (
    <div>
      <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
      {note && (
        <div>
          <h2>{note.title}</h2>
          <p>Version: {note.version}</p>
          <pre>{JSON.stringify(note.blob, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

### Node.js Example

```javascript
const WebSocket = require('ws');

const noteId = 'my-note-id';
const ws = new WebSocket(`ws://localhost:8787/ws/note/${noteId}`);

ws.on('open', () => {
  console.log('Connected');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('Received:', message.type, message.data);
});

ws.on('close', () => {
  console.log('Disconnected');
});
```

## Testing

### Interactive HTML Test

Open `test-websocket.html` in your browser:

1. Enter a note ID
2. Click "Connect" to establish WebSocket connection
3. Click "Update Note" to trigger updates
4. Watch real-time messages appear

### Automated Node.js Test

Run the automated test script:

```bash
# Install ws package if not already installed
npm install ws

# Run test against local development server
node test-websocket.js http://localhost:8787

# Run test against production
node test-websocket.js https://your-domain.com
```

The test will:
1. Create a new note
2. Connect via WebSocket
3. Perform multiple updates
4. Verify all messages are received
5. Report results

## Integration with Existing APIs

WebSocket support is **completely optional** and works alongside existing tRPC APIs:

- **tRPC APIs**: Continue to work exactly as before
- **WebSocket**: Optional real-time updates for clients that need them
- **No Breaking Changes**: All existing code continues to work

You can use both simultaneously:
- Use tRPC for mutations (create, update, revert)
- Use WebSocket for real-time updates
- Use tRPC subscriptions for server-side real-time updates

## Architecture

```
Client → Worker → NoteDurableObject
                      ↓
                  WebSocket Sessions
                      ↓
                  Broadcast Updates
```

1. Client connects to `/ws/note/{noteId}`
2. Worker routes to appropriate NoteDurableObject
3. NoteDurableObject accepts WebSocket and stores session
4. On any note change, NoteDurableObject broadcasts to all sessions
5. Clients receive real-time updates

## Best Practices

1. **Reconnection Logic**: Implement automatic reconnection with exponential backoff
2. **Error Handling**: Always handle `onerror` and `onclose` events
3. **Cleanup**: Close WebSocket connections when components unmount
4. **Heartbeat**: Consider implementing ping/pong for long-lived connections
5. **Message Validation**: Validate message structure before using data

## Troubleshooting

### Connection Fails

- Verify the note exists (create it first if needed)
- Check WebSocket URL format: `ws://` or `wss://`
- Ensure proper CORS/security settings

### No Messages Received

- Verify the note is being updated through the API
- Check browser console for errors
- Ensure WebSocket connection is open

### Messages Delayed

- WebSocket messages are instant; check network conditions
- Verify the Durable Object is processing updates correctly

## Performance Considerations

- Each note has its own Durable Object instance
- WebSocket connections are lightweight
- Broadcasts are efficient (only to connected clients)
- No polling required - true push notifications
- Automatic cleanup prevents memory leaks

## Security Notes

- WebSocket connections use the same security context as HTTP
- Consider adding authentication/authorization if needed
- Validate note IDs to prevent unauthorized access
- Rate limiting may be needed for production use
