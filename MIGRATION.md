# Migration to Durable Objects

This document describes the migration from in-memory storage to Durable Objects for the notes system.

## What Changed

### Before (In-Memory)
- Notes stored in `Map<ID, NoteCurrent>`
- History stored in `Map<ID, NoteVersion[]>`
- Data lost on Worker restart
- No persistence across deployments

### After (Durable Objects)
- Each note has its own Durable Object instance
- Complete history stored in SQLite-backed storage
- Data persists across restarts and deployments
- Strong consistency guarantees

## File Structure

### New Files
```
liva/src/
├── do/
│   ├── NoteDurableObject.ts       # One DO per note
│   ├── NoteIndexDurableObject.ts  # Global index DO
│   └── README.md                  # DO documentation
└── notes/
    └── service-do.ts              # New service using DOs
```

### Modified Files
- `src/index.ts` - Exports DOs, passes env to tRPC context
- `src/notes/router.ts` - Uses new service-do.ts
- `src/trpc-config.ts` - Added Context type with env
- `wrangler.jsonc` - Added DO bindings and migrations

### Preserved Files
- `src/notes/service.ts` - Original in-memory implementation (kept for reference)
- `src/notes/types.ts` - No changes needed

## API Compatibility

The tRPC API remains **100% compatible**. All endpoints work exactly the same:

### Mutations
- `createNote` - Creates note in DO + updates index
- `updateNote` - Updates note in DO + updates index
- `revertToVersion` - Reverts in DO + updates index

### Queries
- `getNote` - Reads from note DO
- `listNotes` - Reads from index DO
- `getHistory` - Reads from note DO
- `getVersion` - Reads from note DO

### Subscriptions
- `subscribeToNote` - Still uses in-memory pubsub for real-time updates

## Testing

Run the test script to verify everything works:

```bash
cd liva
npm run dev  # Start dev server
./test-notes.sh  # Run tests
```

Expected output:
- ✅ Create note succeeds
- ✅ Get note returns correct data
- ✅ Update note increments version
- ✅ History shows all versions
- ✅ List notes shows all notes sorted by updatedAt

## Deployment

1. **Update wrangler.jsonc** - Already done
2. **Run migrations** - Automatic on first deploy
3. **Deploy** - `npm run deploy`

The migration tag `v1` in wrangler.jsonc ensures DOs are created with SQLite storage.

## Rollback

If needed, you can rollback by:

1. Restore `src/notes/router.ts` to use `service.ts` instead of `service-do.ts`
2. Restore `src/trpc-config.ts` to remove Context type
3. Restore `src/index.ts` to not pass env to context

The old in-memory service is still available in `src/notes/service.ts`.

## Performance Considerations

### Improved
- ✅ Data persistence
- ✅ Strong consistency per note
- ✅ Horizontal scalability

### Trade-offs
- Each note operation requires a DO call (adds ~1-5ms latency)
- Index updates are async (eventual consistency for list)
- Cold starts for inactive DOs (~10-50ms)

## Future Enhancements

1. **Batch Operations** - Update multiple notes in parallel
2. **Caching** - Add KV cache for frequently accessed notes
3. **Collaboration** - Use WebSocket hibernation for real-time editing
4. **Backup** - Periodic snapshots to R2
5. **Analytics** - Track note access patterns
