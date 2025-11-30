# WebSocket Quick Reference

## Endpoint
```
ws://your-domain/ws/note/{noteId}
```

## Connect
```javascript
const ws = new WebSocket(`ws://localhost:8787/ws/note/${noteId}`);
```

## Message Types
| Type | When | Description |
|------|------|-------------|
| `initial` | On connect | Current note state |
| `create` | Note created | New note created |
| `update` | Note updated | Note content/title changed |
| `revert` | Note reverted | Reverted to previous version |

## Message Structure
```typescript
{
  type: "initial" | "create" | "update" | "revert",
  data: {
    id: string,
    version: number,
    title: string | null,
    blob: unknown,
    createdAt: number,
    updatedAt: number,
    collaborators: string[]
  }
}
```

## Basic Usage
```javascript
const ws = new WebSocket('ws://localhost:8787/ws/note/my-note');

ws.onopen = () => console.log('✅ Connected');
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  console.log(msg.type, msg.data);
};
ws.onclose = () => console.log('❌ Disconnected');
ws.onerror = (e) => console.error('Error:', e);
```

## React Hook
```typescript
function useNoteWebSocket(noteId: string) {
  const [note, setNote] = useState(null);
  
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8787/ws/note/${noteId}`);
    ws.onmessage = (e) => setNote(JSON.parse(e.data).data);
    return () => ws.close();
  }, [noteId]);
  
  return note;
}
```

## Testing
```bash
# Interactive browser test
open test-websocket.html

# Automated test
node test-websocket.js http://localhost:8787

# Manual test guide
./test-websocket-simple.sh
```

## Common Patterns

### Auto-reconnect
```javascript
function connectWithRetry(noteId, maxRetries = 5) {
  let retries = 0;
  
  function connect() {
    const ws = new WebSocket(`ws://localhost:8787/ws/note/${noteId}`);
    
    ws.onclose = () => {
      if (retries < maxRetries) {
        retries++;
        setTimeout(connect, 1000 * Math.pow(2, retries));
      }
    };
    
    return ws;
  }
  
  return connect();
}
```

### Multiple Notes
```javascript
const connections = new Map();

function subscribeToNote(noteId, callback) {
  const ws = new WebSocket(`ws://localhost:8787/ws/note/${noteId}`);
  ws.onmessage = (e) => callback(JSON.parse(e.data));
  connections.set(noteId, ws);
}

function unsubscribeFromNote(noteId) {
  connections.get(noteId)?.close();
  connections.delete(noteId);
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection fails | Ensure note exists, check URL format |
| No messages | Verify note is being updated via API |
| Disconnects | Implement reconnection logic |
| Multiple messages | Normal - one per update |

## Performance Tips
- Close connections when not needed
- Use single connection per note
- Implement heartbeat for long connections
- Handle reconnection gracefully

## See Also
- [WEBSOCKET_QUICKSTART.md](./WEBSOCKET_QUICKSTART.md) - Get started in 5 minutes
- [WEBSOCKET_GUIDE.md](./WEBSOCKET_GUIDE.md) - Full documentation
- [WEBSOCKET_SUMMARY.md](./WEBSOCKET_SUMMARY.md) - Implementation details
