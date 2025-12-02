# WebSocket Quick Start

Get up and running with real-time note updates in 5 minutes.

## 1. Start the Development Server

```bash
npm run dev
# or
yarn dev
```

The server will start at `http://localhost:8787`

## 2. Test with the Interactive HTML Page

Open `test-websocket.html` in your browser:

```bash
open test-websocket.html
# or just drag it into your browser
```

### Steps:
1. Enter a note ID (e.g., `test-note-1`)
2. Click **Connect** - you'll see "Connected" status
3. Click **Update Note** - watch real-time messages appear
4. Open the same page in another browser tab
5. Update from either tab - both receive updates instantly!

## 3. Test with the Automated Script

```bash
# Install dependencies (if not already installed)
npm install ws

# Run the test
node test-websocket.js http://localhost:8787
```

You should see output like:

```
🧪 WebSocket Note Test
==================================================
Base URL: http://localhost:8787
Note ID: test-note-1701234567890
==================================================

📝 Creating note...
✅ Note created: { id: 'test-note-...', version: 1, ... }

🔌 Connecting to WebSocket: ws://localhost:8787/ws/note/test-note-...
✅ WebSocket connected

📨 Message #1 received: { type: 'initial', noteId: '...', version: 1, ... }

🔄 Starting updates...

📝 Updating note (version 2)...
✅ Note updated: { id: '...', version: 2, ... }

📨 Message #2 received: { type: 'update', noteId: '...', version: 2, ... }

...

✅ Test completed successfully!
📊 Total WebSocket messages received: 4
```

## 4. Test with Browser Console

Open your browser console and paste:

```javascript
// Connect to a note
const ws = new WebSocket('ws://localhost:8787/ws/note/my-test-note');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('📨', msg.type, '→', msg.data);
};

ws.onopen = () => console.log('✅ Connected');
ws.onclose = () => console.log('❌ Disconnected');
```

Then in another tab or console, update the note:

```javascript
fetch('http://localhost:8787/api/v1/updateNote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'my-test-note',
    title: 'Updated!',
    blob: { content: 'New content', time: Date.now() }
  })
}).then(r => r.json()).then(console.log);
```

Watch the WebSocket receive the update in real-time!

## 5. Integration Example

Here's a minimal React component:

```tsx
import { useEffect, useState } from 'react';

function LiveNote({ noteId }: { noteId: string }) {
  const [note, setNote] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8787/ws/note/${noteId}`);
    
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      setNote(msg.data);
    };

    return () => ws.close();
  }, [noteId]);

  return (
    <div>
      {note ? (
        <>
          <h2>{note.title}</h2>
          <p>Version: {note.version}</p>
          <pre>{JSON.stringify(note.blob, null, 2)}</pre>
        </>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}
```

## Troubleshooting

### "Connection failed"
- Make sure the dev server is running
- Check the note exists (create it first)
- Verify the URL format: `ws://` not `wss://` for local dev

### "No messages received"
- Ensure you're updating the correct note ID
- Check browser console for errors
- Verify WebSocket is in "open" state

### "Module not found: ws"
```bash
npm install ws
```

## Next Steps

- Read [WEBSOCKET_GUIDE.md](./WEBSOCKET_GUIDE.md) for detailed documentation
- Check [DO_QUICK_REFERENCE.md](./DO_QUICK_REFERENCE.md) for Durable Object patterns
- Explore the implementation in `src/do/NoteDurableObject.ts`

## Summary

You now have:
- ✅ Real-time WebSocket updates working
- ✅ Multiple clients can connect to the same note
- ✅ All existing APIs still work normally
- ✅ Test tools to verify functionality

The WebSocket feature is completely optional - use it when you need real-time updates, otherwise stick with the regular tRPC APIs!
