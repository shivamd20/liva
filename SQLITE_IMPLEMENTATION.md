# NoteDurableObject - SQLite Implementation

## Overview

NoteDurableObject now uses Cloudflare's SQLite transactional storage API instead of KV storage. This provides better performance, stronger consistency guarantees, and more flexible querying capabilities.

## Database Schema

### note_current Table
Stores the current state of the note:
```sql
CREATE TABLE note_current (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    title TEXT,
    blob TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    collaborators TEXT NOT NULL
);
```

### note_history Table
Stores the complete version history:
```sql
CREATE TABLE note_history (
    version INTEGER PRIMARY KEY,
    blob TEXT NOT NULL,
    title TEXT,
    timestamp INTEGER NOT NULL,
    meta TEXT
);
```

### Indexes
```sql
CREATE INDEX idx_history_version ON note_history(version);
```

## API

All methods remain the same:

- `createNote(params)` - Initialize a new note
- `updateNote(params)` - Update note with new version
- `revertToVersion(version)` - Revert to a specific version
- `getNote()` - Get current note state
- `getHistory()` - Get complete version history
- `getVersion(version)` - Get a specific version
- WebSocket support for real-time updates

## Usage

### Via tRPC

```typescript
import { trpc } from './trpcClient';

// Create a note
const note = await trpc.createNote.mutate({
  title: "My Note",
  blob: { content: "Hello World" }
});

// Update a note
await trpc.updateNote.mutate({
  id: note.id,
  blob: { content: "Updated content" },
  expectedVersion: note.version
});

// Get note history
const history = await trpc.getHistory.query({ id: note.id });
```

### Via WebSocket

```typescript
const ws = new WebSocket(`wss://your-worker.workers.dev/ws/note/${noteId}`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Note update:', message.type, message.data);
};
```

## Benefits of SQLite Backend

1. **Better Performance**: SQL queries are optimized for relational data
2. **Flexible Queries**: Can query history by version, timestamp, or other criteria
3. **Indexes**: Faster lookups with indexed columns
4. **Transactions**: Built-in transactional support
5. **Point-in-Time Recovery**: SQLite-backed DOs support PITR API
6. **Storage Efficiency**: Normalized schema reduces data duplication

## Configuration

### wrangler.jsonc

```jsonc
{
  "migrations": [
    {
      "new_sqlite_classes": ["NoteDurableObject", "NoteIndexDurableObject"],
      "tag": "v2"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "class_name": "NoteDurableObject",
        "name": "NOTE_DURABLE_OBJECT"
      }
    ]
  }
}
```

## Files

- `src/do/NoteDurableObject.ts` - Main Durable Object implementation (SQLite)
- `src/notes/service-do.ts` - Service layer
- `src/notes/router.ts` - tRPC router

## Resources

- [Cloudflare Durable Objects SQL API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [SQLite-backed Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/#create-sqlite-backed-durable-object-class)
