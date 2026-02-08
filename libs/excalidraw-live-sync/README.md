# @shvm/excalidraw-live-sync

A lightweight, standalone React library to add real-time collaboration to Excalidraw components, powered by a Cloudflare Workers backend.

## Installation

```bash
npm install @shvm/excalidraw-live-sync
```

You also need the peer dependencies:
```bash
npm install react react-dom @excalidraw/excalidraw
```

## Features

- **Real-time Collaboration**: Syncs drawings instantly across clients.
- **Ephemeral Pointers**: See other users' cursors and selections in real-time.
- **Backend Agnostic-ish**: Default configuration points to the Liva demo backend, but you can host your own.

## Usage

### 1. Simple Integration

Use the `useExcalidrawLiveSync` hook within your Excalidraw wrapper component.

```tsx
import { useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { useExcalidrawLiveSync } from '@shvm/excalidraw-live-sync';
import '@excalidraw/excalidraw/index.css';

function CollaborativeBoard({ boardId, userId }) {
    const [excalidrawAPI, setExcalidrawAPI] = useState(null);

    const { handleChange, onPointerUpdate } = useExcalidrawLiveSync({
        excalidrawAPI,
        boardId,
        userId, // Mandatory: Unique identifier for the current user
        userInfo: { username: 'Alice' },
        baseUrl: 'https://liva.shvm.in' // Optional, defaults to this
    });

    return (
        <div style={{ height: '500px' }}>
            <Excalidraw
                excalidrawAPI={(api) => setExcalidrawAPI(api)}
                onChange={handleChange}
                onPointerUpdate={onPointerUpdate}
            />
        </div>
    );
}
```

### 2. Creating Boards Configurally

You can use the helper function to create new boards via the API.

```ts
import { createExcalidrawBoard } from '@shvm/excalidraw-live-sync';

async function createNew(userId) {
    const boardId = await createExcalidrawBoard('My New Board', userId, 'https://liva.shvm.in');
    console.log('Created board:', boardId);
}
```

## Configuration

### Base URL
By default, the library connects to `https://liva.shvm.in`. This handles both the HTTP REST API (for creation) and the WebSocket connection (for syncing).

To use your own backend (running the Liva Durable Object server), pass the `baseUrl` prop to the hook or function.

```tsx
useExcalidrawLiveSync({
    // ...
    userId: 'user-123',
    baseUrl: 'https://my-own-worker.workers.dev'
})
```

## Offline-first sync plan (proposal)

The goal is to make collaboration resilient when the client goes offline, then reconnects without losing local work or duplicating elements. The proposal below is intentionally incremental so it can be implemented in stages while keeping the current online flow intact.

### 1) Storage abstraction (adapter + queue)
- Introduce a `OfflineStorageAdapter` with a default `LocalStorageAdapter` for the browser and a `MemoryStorageAdapter` fallback for non-browser environments.
- Persist an **ordered queue of updates** per board that captures the minimal patch or full scene snapshot.
- Store the queue under a board-scoped key (example: `liva.offline.queue.<boardId>`).

### 2) Offline detection + enqueue
- When `navigator.onLine` is false or the WebSocket is disconnected, enqueue updates rather than sending them.
- Preserve the latest local scene snapshot even if the UI refreshes.
- Track a `lastKnownRemoteVersion` and include it with queued updates to assist with conflict resolution.

### 3) Reconnect flush (with merge safety)
- On reconnect, flush queued updates in order.
- Each flush step should:
  - Fetch the latest remote board.
  - Merge with the local snapshot via **version-based element merge** to avoid duplicates.
  - Send the merged result as a single update (or a compact patch if available).
- If the flush fails mid-way, preserve the remaining queue for the next reconnect.

### 4) Conflict resolution guardrails
- Use element `id` + `version` to pick the newest element per id.
- Prefer remote deletions if the remote `version` is higher.
- Ensure a single authoritative update is sent after merge to avoid duplicate creations.

### 5) UX & telemetry
- Add status states: `offline`, `syncing`, `synced`.
- Surface a small banner when offline changes are pending.
- Emit telemetry for queue size, flush durations, and merge conflicts.

### 6) Extensibility
- Allow custom adapters (IndexedDB, file system) by passing `storageAdapter`.
- Allow custom merge strategies by passing `mergeStrategy`.

This plan pairs with an `OfflineUpdateQueue` utility (see source exports) to validate the queue behavior and is ready to be wired into the hook in a follow-up iteration.

## License

MIT
