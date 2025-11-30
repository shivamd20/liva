# Durable Objects Implementation Guide

## Overview

The notes system now uses Cloudflare Durable Objects for persistent, strongly-consistent storage. Each note is backed by its own Durable Object instance, ensuring data durability and version history preservation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Worker                               │
│  ┌──────────────┐         ┌─────────────────────────────┐  │
│  │   tRPC API   │────────▶│   NotesServiceDO            │  │
│  └──────────────┘         └─────────────────────────────┘  │
│                                    │                         │
│                           ┌────────┴────────┐               │
│                           ▼                 ▼               │
│                  ┌─────────────────┐  ┌──────────────────┐ │
│                  │ NoteDurableObject│  │NoteIndexDurable  │ │
│                  │  (per note)      │  │Object (global)   │ │
│                  └─────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. NoteDurableObject (`src/do/NoteDurableObject.ts`)

**Purpose**: One instance per note, maintains complete state and history

**Storage Structure**:
```typescript
interface NoteState {
  current: NoteCurrent;    // Current version
  history: NoteVersion[];  // All versions
}
```

**RPC Methods**:
- `createNote(params)` - Initialize new note
- `updateNote(params)` - Add new version
- `revertToVersion(version)` - Revert to previous version
- `getNote()` - Get current state
- `getHistory()` - Get all versions
- `getVersion(version)` - Get specific version

### 2. NoteIndexDurableObject (`src/do/NoteIndexDurableObject.ts`)

**Purpose**: Single global instance for fast note listing

**Storage Structure**:
```typescript
// Key: "note:{id}"
interface NoteIndexEntry {
  id: string;
  title: string | null;
  version: number;
  updatedAt: number;
  createdAt: number;
}
```

**RPC Methods**:
- `upsertNote(entry)` - Add/update note in index
- `deleteNote(id)` - Remove from index
- `listNotes()` - Get all notes (sorted)
- `getNote(id)` - Get index entry

### 3. NotesServiceDO (`src/notes/service-do.ts`)

**Purpose**: Service layer that orchestrates DO operations

**Key Features**:
- Gets DO stubs by ID
- Calls RPC methods on DOs
- Updates index after mutations
- Maps errors to tRPC errors
- Maintains pubsub for subscriptions

## Data Flow Examples

### Creating a Note

```typescript
// 1. Client calls tRPC mutation
const note = await trpc.createNote.mutate({
  title: "My Note",
  blob: { content: "Hello" }
});

// 2. Router creates service instance
const service = new NotesServiceDO(ctx.env);

// 3. Service gets DO stub
const stub = env.NOTE_DURABLE_OBJECT.idFromName(id);

// 4. Service calls RPC method
const current = await stub.createNote({...});

// 5. Service updates index
const indexStub = env.NOTE_INDEX_DURABLE_OBJECT.idFromName("global-index");
await indexStub.upsertNote({...});

// 6. Service emits pubsub event
pubsub.emit(id, current);

// 7. Returns to client
return current;
```

### Updating a Note

```typescript
// Similar flow but:
// 1. Gets existing note DO
// 2. Calls updateNote() which adds version to history
// 3. Updates index with new metadata
// 4. Emits pubsub event
```

### Listing Notes

```typescript
// 1. Gets global index DO
const indexStub = env.NOTE_INDEX_DURABLE_OBJECT.idFromName("global-index");

// 2. Calls listNotes()
const notes = await indexStub.listNotes();

// 3. Returns sorted list (no need to query individual note DOs)
```

## Configuration

### wrangler.jsonc

```jsonc
{
  "migrations": [
    {
      "new_sqlite_classes": [
        "NoteDurableObject",
        "NoteIndexDurableObject"
      ],
      "tag": "v1"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "class_name": "NoteDurableObject",
        "name": "NOTE_DURABLE_OBJECT"
      },
      {
        "class_name": "NoteIndexDurableObject",
        "name": "NOTE_INDEX_DURABLE_OBJECT"
      }
    ]
  }
}
```

### Type Generation

After modifying wrangler.jsonc, regenerate types:

```bash
npm run cf-typegen
```

This updates `worker-configuration.d.ts` with DO bindings.

## Development

### Running Locally

```bash
npm run dev
```

This starts Wrangler dev server with local DO instances.

### Testing

```bash
./test-notes.sh
```

Tests all CRUD operations and verifies DO functionality.

### Debugging

Check DO state in Wrangler dashboard or use console.log in DO methods:

```typescript
async createNote(params) {
  console.log('Creating note:', params.id);
  // ...
}
```

## Production Deployment

```bash
npm run deploy
```

Migrations run automatically on first deploy. DOs are created on-demand when first accessed.

## Best Practices

### 1. DO Naming Strategy

```typescript
// Use meaningful, stable IDs
const stub = env.NOTE_DURABLE_OBJECT.idFromName(noteId);

// NOT random IDs (can't be looked up later)
const stub = env.NOTE_DURABLE_OBJECT.newUniqueId();
```

### 2. Error Handling

```typescript
try {
  await stub.updateNote({...});
} catch (error) {
  if (error.message === "Version mismatch") {
    throw new TRPCError({ code: "CONFLICT", ... });
  }
  throw error;
}
```

### 3. Index Consistency

Always update index after mutating note:

```typescript
const current = await stub.updateNote({...});
await indexStub.upsertNote({...}); // Don't forget!
```

### 4. Concurrency

DOs handle concurrency automatically - each instance processes requests serially.

## Monitoring

### Metrics to Track

- DO invocation count
- DO CPU time
- Storage operations
- Error rates

### Logs

DOs log to Wrangler console in dev, Cloudflare dashboard in production.

## Troubleshooting

### Issue: "Note not found"

**Cause**: DO hasn't been initialized yet
**Solution**: Ensure createNote was called first

### Issue: "Version mismatch"

**Cause**: Optimistic concurrency conflict
**Solution**: Client should retry with latest version

### Issue: Index out of sync

**Cause**: Index update failed after note mutation
**Solution**: Implement retry logic or periodic reconciliation

## Future Enhancements

1. **WebSocket Support**: Add real-time collaboration via DO WebSocket API
2. **Alarms**: Implement auto-save or cleanup with DO alarms
3. **Transactions**: Use DO transactions for atomic operations
4. **Backup**: Periodic snapshots to R2
5. **Sharding**: Shard index DO if note count grows large

## Resources

- [Cloudflare Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [Workers RPC](https://developers.cloudflare.com/workers/runtime-apis/rpc/)
- [DO Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/)
