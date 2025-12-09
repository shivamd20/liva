# @shvm/excalidraw-live-sync

A lightweight, standalone React library to add real-time collaboration to Excalidraw components, powered by a Cloudflare Workers backend.

## Installation

```bash
npm install @shvm/excalidraw-live-sync
# or
yarn add @shvm/excalidraw-live-sync
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

function CollaborativeBoard({ boardId }) {
    const [excalidrawAPI, setExcalidrawAPI] = useState(null);

    const { handleChange, onPointerUpdate } = useExcalidrawLiveSync({
        excalidrawAPI,
        boardId,
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

async function createNew() {
    const boardId = await createExcalidrawBoard('My New Board', 'https://liva.shvm.in');
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
    baseUrl: 'https://my-own-worker.workers.dev'
})
```

## License

MIT
