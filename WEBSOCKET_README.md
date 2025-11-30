# WebSocket Real-Time Updates - Complete Guide

## 🎯 Overview

Your NoteDurableObject now supports WebSocket connections for real-time updates! Clients can subscribe to note changes and receive instant notifications when notes are created, updated, or reverted.

## ✨ Features

- ✅ Real-time updates when notes change
- ✅ Initial state sent immediately on connection
- ✅ Multiple clients can connect to the same note
- ✅ Automatic cleanup of disconnected sessions
- ✅ Works alongside existing tRPC APIs
- ✅ Zero breaking changes
- ✅ Type-safe message format

## 🚀 Quick Start

### 1. Start Development Server

```bash
npm run dev
```

### 2. Test with Browser

Open `test-websocket.html` in your browser:
- Enter a note ID
- Click "Connect"
- Click "Update Note" to see real-time updates

### 3. Test with Node.js

```bash
npm install ws
node test-websocket.js http://localhost:8787
```

## 📚 Documentation

| File | Description |
|------|-------------|
| [WEBSOCKET_QUICKSTART.md](./WEBSOCKET_QUICKSTART.md) | Get started in 5 minutes |
| [WEBSOCKET_GUIDE.md](./WEBSOCKET_GUIDE.md) | Comprehensive documentation |
| [WEBSOCKET_REFERENCE.md](./WEBSOCKET_REFERENCE.md) | Quick reference card |
| [WEBSOCKET_SUMMARY.md](./WEBSOCKET_SUMMARY.md) | Implementation details |
| [WEBSOCKET_REACT_EXAMPLE.tsx](./WEBSOCKET_REACT_EXAMPLE.tsx) | React integration examples |

## 🔌 Connection

### Endpoint
```
ws://your-domain/ws/note/{noteId}
```

### JavaScript
```javascript
const ws = new WebSocket('ws://localhost:8787/ws/note/my-note-id');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message.type, message.data);
};
```

### React Hook
```typescript
import { useNoteWebSocket } from './WEBSOCKET_REACT_EXAMPLE';

function MyComponent({ noteId }) {
  const { note, connected } = useNoteWebSocket({ noteId });
  
  return (
    <div>
      <div>Status: {connected ? '🟢 Live' : '🔴 Offline'}</div>
      <div>Version: {note?.version}</div>
      <div>Title: {note?.title}</div>
    </div>
  );
}
```

## 📨 Message Format

All messages are JSON with this structure:

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

### Message Types

- **initial**: Sent immediately when you connect (current state)
- **create**: Sent when a note is first created
- **update**: Sent when a note is updated
- **revert**: Sent when a note is reverted to a previous version

## 🧪 Testing

### Interactive HTML Test
```bash
open test-websocket.html
```

### Automated Test
```bash
node test-websocket.js http://localhost:8787
```

### Manual Test
```bash
./test-websocket-simple.sh
```

### Test Multiple Clients
1. Open `test-websocket.html` in multiple browser tabs
2. Connect all tabs to the same note ID
3. Update from one tab
4. Watch all tabs receive updates instantly!

## 🏗️ Architecture

```
┌─────────┐         ┌─────────┐         ┌──────────────────┐
│ Client  │────────▶│ Worker  │────────▶│ NoteDurableObject│
│         │         │         │         │                  │
│         │         │         │         │ ┌──────────────┐ │
│         │◀────────│         │◀────────│ │  WebSocket   │ │
│         │         │         │         │ │  Sessions    │ │
└─────────┘         └─────────┘         │ └──────────────┘ │
                                        │                  │
                                        │ ┌──────────────┐ │
                                        │ │ Note Storage │ │
                                        │ └──────────────┘ │
                                        └──────────────────┘
```

## 🔄 How It Works

1. **Client connects** to `/ws/note/{noteId}`
2. **Worker routes** to the appropriate NoteDurableObject
3. **Durable Object accepts** WebSocket and sends initial state
4. **On any change** (create/update/revert), broadcasts to all connected clients
5. **Clients receive** real-time updates instantly

## 💡 Use Cases

### Real-Time Collaboration
Multiple users editing the same note see each other's changes instantly.

### Live Dashboards
Monitor note changes in real-time without polling.

### Presence Indicators
Show who's currently viewing a note.

### Activity Feeds
Display live updates of note modifications.

### Sync Across Devices
Keep multiple devices in sync automatically.

## 🎨 Integration Examples

### With tRPC
```typescript
// Use tRPC for mutations
const updateMutation = trpc.updateNote.useMutation();

// Use WebSocket for real-time updates
const { note } = useNoteWebSocket({ noteId });

// Update via tRPC
await updateMutation.mutateAsync({ id: noteId, title: 'New Title' });

// WebSocket automatically receives the update!
```

### With React Query
```typescript
const { data } = trpc.getNote.useQuery({ id: noteId });
const { note: liveNote } = useNoteWebSocket({ noteId });

// Use liveNote for real-time updates
// Use data for initial load and refetching
```

## 🔒 Security

- WebSocket connections use the same security context as HTTP
- Consider adding authentication for production
- Validate note IDs to prevent unauthorized access
- Implement rate limiting if needed

## ⚡ Performance

- **Lightweight**: Minimal overhead per connection
- **Efficient**: Only broadcasts to connected clients
- **Scalable**: Each note has its own Durable Object
- **Clean**: Automatic session cleanup prevents memory leaks

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection fails | Ensure note exists, check URL format |
| No messages | Verify note is being updated via API |
| Frequent disconnects | Implement reconnection with backoff |
| Multiple duplicate messages | Normal - one per update |

## 📦 Files

### Implementation
- `src/do/NoteDurableObject.ts` - WebSocket support added
- `src/index.ts` - WebSocket routing added

### Tests
- `test-websocket.html` - Interactive browser test
- `test-websocket.js` - Automated Node.js test
- `test-websocket-simple.sh` - Manual test guide

### Documentation
- `WEBSOCKET_README.md` - This file
- `WEBSOCKET_QUICKSTART.md` - Quick start guide
- `WEBSOCKET_GUIDE.md` - Full documentation
- `WEBSOCKET_REFERENCE.md` - Quick reference
- `WEBSOCKET_SUMMARY.md` - Implementation summary
- `WEBSOCKET_REACT_EXAMPLE.tsx` - React examples

## 🎓 Learn More

- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [DO_QUICK_REFERENCE.md](./DO_QUICK_REFERENCE.md) - Durable Object patterns

## ✅ Verification

All TypeScript checks pass:
```bash
# No errors found
✓ src/do/NoteDurableObject.ts
✓ src/index.ts
```

## 🚢 Production Checklist

Before deploying to production:

- [ ] Add authentication/authorization
- [ ] Implement reconnection logic with exponential backoff
- [ ] Add heartbeat/ping-pong for connection health
- [ ] Monitor WebSocket connection counts
- [ ] Add rate limiting
- [ ] Test with multiple concurrent users
- [ ] Set up error tracking
- [ ] Document for your team

## 🎉 Summary

You now have:
- ✅ Real-time WebSocket updates working
- ✅ Multiple clients can connect to the same note
- ✅ All existing APIs still work normally
- ✅ Comprehensive tests and documentation
- ✅ React integration examples
- ✅ Zero breaking changes

The WebSocket feature is completely optional - use it when you need real-time updates, otherwise stick with the regular tRPC APIs!

---

**Need help?** Check the documentation files or run the test scripts to see it in action!
