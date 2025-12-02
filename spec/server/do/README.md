# Durable Objects

This directory contains Durable Object implementations for the Liva application.

## Overview

Durable Objects provide strongly consistent, stateful coordination for the notes system. Each note gets its own Durable Object instance, ensuring data consistency and maintaining complete version history.

## Architecture

### NoteDurableObject

One instance per note. Each instance:
- Maintains the current state of a single note
- Stores complete version history
- Handles all mutations (create, update, revert)
- Provides query access to current state and history

**Key Methods:**
- `createNote(params)` - Initialize a new note
- `updateNote(params)` - Create a new version
- `revertToVersion(version)` - Revert to a previous version
- `getNote()` - Get current state
- `getHistory()` - Get all versions
- `getVersion(version)` - Get a specific version

### NoteIndexDurableObject

Single global instance for maintaining the note index. This enables:
- Fast listing of all notes
- Sorted by last updated timestamp
- Lightweight metadata storage (id, title, version, timestamps)

**Key Methods:**
- `upsertNote(entry)` - Add or update a note in the index
- `deleteNote(id)` - Remove a note from the index
- `listNotes()` - Get all notes sorted by updatedAt
- `getNote(id)` - Get index entry for a specific note

## Data Flow

1. **Create Note**
   - Worker → NoteDurableObject.createNote()
   - NoteDurableObject stores state
   - Worker → NoteIndexDurableObject.upsertNote()
   - Index updated

2. **Update Note**
   - Worker → NoteDurableObject.updateNote()
   - New version added to history
   - Worker → NoteIndexDurableObject.upsertNote()
   - Index metadata updated

3. **Query Note**
   - Worker → NoteDurableObject.getNote()
   - Returns current state

4. **List Notes**
   - Worker → NoteIndexDurableObject.listNotes()
   - Returns sorted list of all notes

## Storage

Each Durable Object uses SQLite-backed storage:
- **NoteDurableObject**: Stores `NoteState` object containing current state and history array
- **NoteIndexDurableObject**: Stores individual `NoteIndexEntry` objects with prefix `note:`

## Benefits

1. **Strong Consistency**: Each note has a single source of truth
2. **Complete History**: All versions are preserved in the DO
3. **Scalability**: Each note is independent, allowing horizontal scaling
4. **Durability**: SQLite-backed storage ensures data persistence
5. **Low Latency**: Data is stored close to where it's accessed

## Configuration

Durable Objects are configured in `wrangler.jsonc`:

```jsonc
{
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

## Usage

The service layer (`notes/service-do.ts`) abstracts DO access:

```typescript
const service = new NotesServiceDO(env);
const note = await service.createNote({
  title: "My Note",
  blob: { content: "Hello" }
});
```

The service handles:
- Getting DO stubs by ID
- Calling RPC methods
- Updating the index
- Error handling and mapping to tRPC errors
