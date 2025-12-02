
# Notes API

This directory contains the implementation of the Notes API, which powers the board functionality in Liva.

## Features

- **CRUD Operations**: Create, Read, Update, Delete notes.
- **Real-time Updates**: WebSocket support for live collaboration.
- **History & Versioning**: Full version history with revert capabilities.
- **Pagination**: Efficiently fetch history with cursor-based pagination.

## API Endpoints (tRPC)

The API is exposed via tRPC. Key procedures include:

### `getHistory`

Fetches the history of a note with pagination support.

**Input:**
```typescript
{
  id: string;          // The ID of the note
  limit?: number;      // Number of items to fetch (default: 50, max: 100)
  cursor?: number;     // The version number to start fetching from (exclusive)
  direction?: 'asc' | 'desc'; // Sort order (default: 'desc')
}
```

**Output:**
```typescript
{
  items: NoteVersion[]; // Array of history items
  nextCursor: number | null; // Cursor for the next page, or null if no more items
}
```

**Example Usage (Client):**

```typescript
// Fetch first page (latest 20 versions)
const page1 = await trpc.getHistory.query({
  id: 'note-123',
  limit: 20,
  direction: 'desc'
});

// Fetch next page
if (page1.nextCursor) {
  const page2 = await trpc.getHistory.query({
    id: 'note-123',
    limit: 20,
    cursor: page1.nextCursor,
    direction: 'desc'
  });
}
```

### `revertToVersion`

Reverts a note to a specific historical version. This creates a new version with the content from the selected history item.

**Input:**
```typescript
{
  id: string;      // The ID of the note
  version: number; // The version number to revert to
}
```

## Architecture

- **Router (`router.ts`)**: Defines the tRPC procedures and input validation.
- **Service (`service-do.ts`)**: Handles business logic and interaction with Durable Objects.
- **Durable Object (`NoteDurableObject.ts`)**: Manages state, storage (SQLite), and WebSocket connections.

## Testing

You can verify the pagination logic using the provided test script:

```bash
npx tsx scripts/test-history-pagination.ts
```
