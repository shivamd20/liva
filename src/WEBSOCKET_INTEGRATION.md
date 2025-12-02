# WebSocket Integration for Real-Time Board Sync

## Overview

The boards API now supports real-time synchronization via WebSockets. When a board is edited in one browser tab or by another user, changes are automatically pushed to all connected clients.

## How It Works

### 1. BoardsAPI Interface

The `BoardsAPI` interface now includes a `subscribeToChanges` method:

```typescript
subscribeToChanges: (id: string, callback: BoardChangeCallback) => UnsubscribeFunction;
```

- **id**: The board ID to subscribe to
- **callback**: Function called when the board changes remotely
- **Returns**: Unsubscribe function to clean up the connection

### 2. WebSocket Connection

When you call `subscribeToChanges`, the system:
1. Opens a WebSocket connection to `/ws/note/{id}`
2. Receives the initial board state immediately
3. Listens for updates (`update`, `revert`, `create` messages)
4. Automatically reconnects if the connection drops
5. Closes the connection when all subscribers unsubscribe

### 3. BoardEditor Integration

The `BoardEditor` component automatically subscribes to changes:

```typescript
useEffect(() => {
  const unsubscribe = boardsAPI.subscribeToChanges(board.id, (updatedBoard) => {
    if (updatedBoard.updatedAt !== board.updatedAt) {
      onChange(updatedBoard);
    }
  });

  return () => unsubscribe();
}, [board.id, board.updatedAt, onChange]);
```

This ensures:
- Changes from other clients are received in real-time
- Loop prevention (only updates if timestamp changed)
- Automatic cleanup when component unmounts

## Usage Example

### Manual Subscription

```typescript
import { boardsAPI } from './boardsConfig';

// Subscribe to board changes
const unsubscribe = boardsAPI.subscribeToChanges('board-123', (updatedBoard) => {
  console.log('Board updated:', updatedBoard);
  // Update your UI with the new board data
});

// Later, clean up
unsubscribe();
```

### Automatic in BoardEditor

The `BoardEditor` component handles subscriptions automatically. Just use it normally:

```typescript
<BoardEditor 
  board={board} 
  onChange={handleBoardChange} 
/>
```

## Architecture

### WebSocketManager

The `WebSocketManager` class (in `boardsRemote.ts`) handles:
- Connection pooling (one WebSocket per board ID)
- Multiple subscribers per connection
- Automatic reconnection with 3-second delay
- Cleanup when no subscribers remain

### Message Types

The WebSocket receives these message types from the server:

- `initial`: Sent immediately on connection with current board state
- `update`: Sent when the board is updated
- `revert`: Sent when the board is reverted to a previous version
- `create`: Sent when a new board is created

All messages have the format:
```json
{
  "type": "update",
  "data": { /* NoteCurrent object */ }
}
```

## Local vs Remote

- **Remote API** (`boardsRemote`): Full WebSocket support
- **Local API** (`boardsLocal`): No-op implementation (returns empty unsubscribe function)

Switch between them in `boardsConfig.ts`:
```typescript
const USE_REMOTE_API = true; // false for local storage
```

## Testing

To test real-time sync:
1. Open the same board in two browser tabs
2. Make changes in one tab
3. See the changes appear in the other tab automatically

## Notes

- WebSocket connections are automatically managed
- Reconnection happens automatically after 3 seconds
- Multiple components can subscribe to the same board
- Only one WebSocket connection per board ID
- Loop prevention ensures local changes don't trigger unnecessary updates
