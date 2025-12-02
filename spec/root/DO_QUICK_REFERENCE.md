# Durable Objects Quick Reference

## 🏗️ Architecture

```
Worker → NotesServiceDO → NoteDurableObject (per note)
                       └→ NoteIndexDurableObject (global)
```

## 📦 Files

| File | Purpose |
|------|---------|
| `src/do/NoteDurableObject.ts` | One DO per note, stores state + history |
| `src/do/NoteIndexDurableObject.ts` | Global index for listing notes |
| `src/notes/service-do.ts` | Service layer orchestrating DO calls |
| `src/notes/router.ts` | tRPC router using DO service |
| `wrangler.jsonc` | DO bindings configuration |

## 🔧 Key Methods

### NoteDurableObject
```typescript
await stub.createNote({ id, title, blob, collaborators })
await stub.updateNote({ title, blob, expectedVersion, meta })
await stub.revertToVersion(version)
await stub.getNote()
await stub.getHistory()
await stub.getVersion(version)
```

### NoteIndexDurableObject
```typescript
await indexStub.upsertNote({ id, title, version, updatedAt, createdAt })
await indexStub.deleteNote(id)
await indexStub.listNotes()
await indexStub.getNote(id)
```

## 🚀 Usage

### Get DO Stub
```typescript
// Note DO (one per note)
const stub = env.NOTE_DURABLE_OBJECT.idFromName(noteId);

// Index DO (single global instance)
const indexStub = env.NOTE_INDEX_DURABLE_OBJECT.idFromName("global-index");
```

### Call RPC Method
```typescript
const result = await stub.methodName(params);
```

## 🧪 Testing

```bash
npm run dev              # Start dev server
./test-notes.sh          # Run integration tests
npm run cf-typegen       # Regenerate types
```

## 📊 Storage

### NoteDurableObject Storage
```typescript
{
  "note": {
    current: NoteCurrent,
    history: NoteVersion[]
  }
}
```

### NoteIndexDurableObject Storage
```typescript
{
  "note:{id}": NoteIndexEntry,
  "note:{id2}": NoteIndexEntry,
  ...
}
```

## ⚡ Common Patterns

### Create + Index
```typescript
const current = await stub.createNote({...});
await indexStub.upsertNote({...});
```

### Update + Index
```typescript
const current = await stub.updateNote({...});
await indexStub.upsertNote({...});
```

### Query
```typescript
const note = await stub.getNote();
```

### List
```typescript
const notes = await indexStub.listNotes();
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Note not found" | Call createNote first |
| "Version mismatch" | Retry with latest version |
| TypeScript errors | Restart IDE or run `npm run cf-typegen` |
| Index out of sync | Check index update after mutations |

## 📚 Documentation

- `src/do/README.md` - DO architecture
- `MIGRATION.md` - Migration guide
- `DURABLE_OBJECTS_GUIDE.md` - Complete guide
- `IMPLEMENTATION_SUMMARY.md` - What was built

## 🎯 Key Benefits

✅ Persistent storage  
✅ Strong consistency per note  
✅ Complete version history  
✅ Horizontal scalability  
✅ 100% API compatible  
✅ Type-safe RPC calls  

## 🔗 Resources

- [Cloudflare DO Docs](https://developers.cloudflare.com/durable-objects/)
- [Workers RPC](https://developers.cloudflare.com/workers/runtime-apis/rpc/)
- [DO Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/)
