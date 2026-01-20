# Recording Association & Race Condition Fixes

## Problem Summary
1. **Recordings not attached to boards**: The `addRecording` call was only happening at the END of recording, after finalization
2. **403 Forbidden errors**: Race condition where session was being finalized while uploads were still in progress
3. **No tracking of in-progress recordings**: Users couldn't see partially recorded sessions

## Solutions Implemented

### 1. Associate Recording at START (Not END) ✅

**Changed**: Recording is now associated with the board immediately when recording starts

**Location**: `src/components/BoardEditor.tsx` - `startRecording()`

```typescript
// After creating session, immediately associate with board
await trpcClient.addRecording.mutate({
  id: board.id,
  sessionId: session.id,
  duration: 0, // Will be updated on finalization
  title: `Recording ${new Date().toLocaleString()}`
});

// Invalidate to show in-progress recording
await queryClient.invalidateQueries({ queryKey: ['recordings', board.id] });
```

**Benefits**:
- Recording appears in the list immediately (with 0 duration)
- If recording is interrupted, it's still tracked
- No race conditions with finalization

### 2. Wait for Pending Uploads Before Finalizing ✅

**Problem**: Session was being finalized while chunks were still uploading, causing 403 errors

**Solution**: Added `waitForPendingUploads()` method to MonorailUploader

**Location**: `libs/monorail/src/uploader.ts`

```typescript
async waitForPendingUploads(timeoutMs: number = 30000): Promise<void> {
  const startTime = Date.now();
  
  while (this.queue.length > 0 || this.uploading) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Upload timeout: ${this.queue.length} chunks still pending`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

**Location**: `libs/monorail/src/recorder.ts`

```typescript
async waitForUploads(timeoutMs?: number): Promise<void> {
  return this.uploader.waitForPendingUploads(timeoutMs);
}
```

**Location**: `src/components/BoardEditor.tsx` - `stopRecording()`

```typescript
// Stop recorder
await recorderRef.current.stop();

// CRITICAL: Wait for all pending uploads
await recorderRef.current.waitForUploads(30000);

// NOW it's safe to finalize
await fetch('/api/v1/monorail.finalizeSession', { ... });
```

### 3. Update Recording Duration on Finalization ✅

**Changed**: Instead of creating a new recording on stop, we update the existing one

**Location**: `server/do/queries.ts`

```typescript
INSERT_RECORDING: `
  INSERT OR REPLACE INTO note_recordings(session_id, duration, created_at, title)
  VALUES(?, ?, ?, ?)
`,
```

**Flow**:
1. **Start**: Create recording with `duration: 0`
2. **Stop**: Update same recording with final duration using UPSERT

### 4. Enhanced Logging ✅

Added comprehensive logging throughout the recording lifecycle:

```typescript
console.log('[Recording] Starting recording...');
console.log('[Recording] Associating with board:', { boardId, sessionId });
console.log('[Recording] Successfully associated with board');
console.log('[Recording] Stopping recorder...');
console.log('[Recording] Waiting for pending uploads...');
console.log('[Recording] All uploads completed');
console.log('[Recording] Finalizing session:', sessionId);
console.log('[Recording] Updating recording duration:', { boardId, sessionId, duration });
console.log('[Recording] Recording updated successfully');
```

## Files Modified

### Frontend
- `src/components/BoardEditor.tsx`
  - `startRecording()`: Add recording association at start
  - `stopRecording()`: Wait for uploads, update duration

### Monorail Library
- `libs/monorail/src/uploader.ts`
  - Added `waitForPendingUploads()` method
- `libs/monorail/src/recorder.ts`
  - Added `waitForUploads()` method
  - Made `stop()` async

### Backend
- `server/do/queries.ts`
  - Changed `INSERT_RECORDING` to use `INSERT OR REPLACE` for upsert

## Testing Checklist

- [ ] Start recording - verify it appears in recordings list immediately with 0 duration
- [ ] Stop recording - verify no 403 errors in console
- [ ] Check final recording has correct duration
- [ ] Interrupt recording (refresh page mid-recording) - verify partial recording is tracked
- [ ] Check console logs show all steps completing successfully
- [ ] Verify recordings list updates properly after finalization

## Expected Console Output (Success)

```
[Recording] Starting recording...
[Recording] Associating with board: { boardId: "...", sessionId: "..." }
[Recording] Successfully associated with board
... (recording in progress) ...
[Recording] Stopping recorder...
[Recording] Waiting for pending uploads...
[Recording] All uploads completed
[Recording] Finalizing session: ...
[Recording] Updating recording duration: { boardId: "...", sessionId: "...", duration: 45 }
[Recording] Recording updated successfully
```

## Known Limitations

1. **Interrupted recordings**: If user closes browser mid-recording, the recording will exist with `duration: 0` and status won't be updated. This is acceptable as it shows the recording was attempted.

2. **Upload timeout**: Set to 30 seconds. If uploads take longer, they may be cut off. This is configurable via the `waitForUploads(timeoutMs)` parameter.

## Future Enhancements

1. Add `status` field to recordings table (`in_progress`, `completed`, `interrupted`)
2. Add visual indicator in UI for in-progress recordings
3. Add ability to resume interrupted recordings
4. Add progress indicator for upload completion
