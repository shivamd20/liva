# Durable Object Alarm-Based Finalization

## Problem
The previous approach had a race condition:
1. Client called `stop()` on recorder
2. Client manually waited for uploads with `waitForUploads()`
3. Client called `finalizeSession()` 
4. **Issue**: Last upload could still be in progress when finalization happened, causing 403 Forbidden errors

## Solution: Use Durable Object Alarms ✅

Instead of manually managing upload completion, we leverage Cloudflare Durable Objects' built-in alarm system.

### How It Works

1. **On Upload**: Each time a chunk is uploaded, the alarm is reset to 10 minutes in the future
   ```typescript
   // In MonorailSessionDO.fetch() - upload handler
   await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
   ```

2. **On Stop**: Client signals stop, which sets a SHORT alarm (5 seconds)
   ```typescript
   // In MonorailSessionDO.signalStop()
   await this.state.storage.setAlarm(Date.now() + 5 * 1000);
   ```

3. **Automatic Finalization**: When alarm fires, session is automatically finalized
   ```typescript
   // In MonorailSessionDO.alarm()
   async alarm() {
     const session = await this.getSessionState();
     if (session && session.status === 'active') {
       session.status = "completed";
       await this.state.storage.put("state", session);
     }
   }
   ```

### Why This Works

- **No Race Conditions**: Uploads reset the alarm, so finalization only happens after ALL uploads complete
- **Automatic**: No manual coordination needed between client and server
- **Guaranteed**: Durable Object alarms have at-least-once execution with automatic retries
- **Efficient**: Uses Cloudflare's infrastructure instead of polling/waiting

## Changes Made

### Backend

**`server/monorail/session-do.ts`**
- Added `signalStop()` method that sets a 5-second alarm
- Marked `finalizeSession()` as deprecated
- Alarm automatically finalizes when triggered

**`server/monorail/router.ts`**
- Added `signalStop` TRPC procedure
- Marked `finalizeSession` as deprecated

### Frontend

**`src/components/BoardEditor.tsx`**
- Removed `waitForUploads()` call
- Removed manual `finalizeSession()` call
- Now calls `trpcClient.monorail.signalStop.mutate()` instead
- Simplified error handling

**`libs/monorail/src/recorder.ts`**
- Removed `waitForUploads()` method (no longer needed)

## Flow Comparison

### Before (Manual)
```
User clicks Stop
  ↓
Client: recorder.stop()
  ↓
Client: recorder.waitForUploads(30s) ← Manual polling, can timeout
  ↓
Client: fetch('/api/v1/monorail.finalizeSession') ← Race condition!
  ↓
Session finalized (maybe too early!)
```

### After (Alarm-Based)
```
User clicks Stop
  ↓
Client: recorder.stop()
  ↓
Client: trpcClient.monorail.signalStop()
  ↓
Durable Object: Set alarm for 5 seconds
  ↓
[Pending uploads continue...]
  ↓
Each upload resets alarm to 10 minutes
  ↓
Last upload completes
  ↓
5 seconds of inactivity
  ↓
Alarm fires → Session auto-finalized ✅
```

## Benefits

1. **No 403 Errors**: Session only finalizes after all uploads complete
2. **No Timeouts**: No arbitrary 30-second wait
3. **Resilient**: Works even if client disconnects
4. **Cloudflare Native**: Uses platform features properly
5. **Simpler Code**: Less client-side coordination logic

## Testing

1. Start a recording
2. Stop the recording
3. Check console - should see:
   ```
   [Recording] Signaling stop to Durable Object...
   [Recording] Stop signal sent. Session will auto-finalize after pending uploads.
   ```
4. No 403 errors in network tab
5. Recording appears in list with correct duration after ~5 seconds

## Alarm Behavior

- **During Recording**: Alarm set to 10 minutes (handles long pauses)
- **After Stop**: Alarm set to 5 seconds (quick finalization)
- **On Each Upload**: Alarm reset to 10 minutes (ensures all chunks uploaded)
- **On Alarm Fire**: Session status → "completed"

## Future Enhancements

- Add `status` field to recordings table to show "processing" state
- Show visual indicator while alarm is pending
- Add webhook/notification when finalization completes
