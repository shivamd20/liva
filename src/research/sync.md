Excalidraw Bidirectional Sync - Production Implementation Guide
Based on real-world implementations from:

Excalidraw Official P2P Collaboration (Socket.IO + versionNonce)

Firebase Excalidraw Sync (YouTube - detailed breakdown)

excalidraw-room server (official collaboration backend)

alswl/excalidraw-collaboration (Docker deployment)

GitHub discussions and issues analysis

Table of Contents
Core APIs Used

Conflict Resolution Algorithm

Production Implementation

State Machine Pattern

API Reference Summary

Core APIs
1. updateScene(sceneData)
Purpose: Apply remote/upstream changes to Excalidraw instance

typescript
excalidrawAPI.updateScene({
  elements: ExcalidrawElement[],
  appState: AppState,
  captureUpdate: CaptureUpdateAction.NEVER // ← CRITICAL for remote updates
})
captureUpdate options:

IMMEDIATELY - Add to undo/redo immediately (local user edits only)

EVENTUALLY - Add to undo/redo eventually (async multi-step)

NEVER - Never add to undo/redo (remote updates - prevents merge conflicts)

Why NEVER for remote updates? If you use IMMEDIATELY, undo/redo stacks diverge between peers. NEVER prevents this.

2. onChange(callback)
Purpose: Listen to local changes (FIRES ON EVERY CHANGE)

typescript
excalidrawAPI.onChange((elements, appState, files) => {
  // This fires constantly - debounce it!
  // DO NOT send every call to backend
})
Critical Issue: Fires during initialization, every element change, every property tweak. Without debouncing, creates infinite loop.

3. getSceneElements()
Purpose: Get current state before merging

typescript
const currentElements = excalidrawAPI.getSceneElements()
// Returns elements excluding deleted ones
4. getAppState()
Purpose: Get current app state (zoom, scroll, selected elements, etc.)

typescript
const appState = excalidrawAPI.getAppState()
// Check selectedElementIds to see what user has selected
5. onPointerDown() / onPointerUp()
Purpose: Detect when user is actively editing

typescript
excalidrawAPI.onPointerDown(() => {
  isUserEditingRef.current = true
})

excalidrawAPI.onPointerUp(() => {
  isUserEditingRef.current = false
  // Apply pending remote updates here
})
Conflict Resolution Algorithm
Official Excalidraw Approach (versionNonce)
Excalidraw uses last-write-wins with deterministic tie-breaking:

text
For each element:
1. If element.id not in local → add it (new from peer)
2. If element.id exists locally:
   a. If incoming.version > local.version → use incoming
   b. If versions equal:
      - If versionNonce differs → lower nonce wins (deterministic)
      - If versionNonce same → use incoming (same peer edit)
3. Keep elements only in local unchanged
Why versionNonce? It's a random number that changes with every version bump. Two peers editing the same element simultaneously will have different versionNonces. Because the value is shared over the network, all peers can deterministically choose the same winner without communication.

Firebase Simple Pattern (Version-based)
text
For each element:
1. incoming.version > local.version → take incoming
2. incoming.version <= local.version → keep local (user priority)
3. New elements → add them
4. Deleted elements → mark as deleted
Trade-off: Less sophisticated than versionNonce, but simpler to implement and sufficient for most use cases.

Production Code
Option 1: Recommended - State Machine Pattern
This is what real-world implementations use. Most robust.

typescript
import { ExcalidrawAPI, ExcalidrawElement, AppState, CaptureUpdateAction } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useRef, useState } from "react";

type SyncState = "IDLE" | "EDITING" | "SYNCING" | "SYNCING_DIRTY" | "UPDATING_FROM_PEER";

interface SyncConfig {
  debounceMs: number; // 400-500ms typical
  throttleMs: number; // 300ms typical for remote updates
  enableLogging: boolean;
}

interface UseExcalidrawSyncReturn {
  syncState: SyncState;
  isSynced: boolean;
  handleLocalChange: (elements: ExcalidrawElement[]) => void;
  applyRemoteUpdate: (elements: ExcalidrawElement[]) => Promise<void>;
}

/**
 * Hook for bidirectional Excalidraw sync with state machine
 * 
 * Flow:
 * IDLE -> (user starts drawing) -> EDITING
 * EDITING -> (user stops, onChange fired) -> SYNCING
 * SYNCING -> (backend ack) -> IDLE
 * 
 * Any state + remote update arrives:
 *   if EDITING/SYNCING_DIRTY -> queue it
 *   else -> apply immediately
 */
export const useExcalidrawSync = (
  excalidrawAPI: ExcalidrawAPI,
  config: SyncConfig = {
    debounceMs: 400,
    throttleMs: 300,
    enableLogging: false,
  }
): UseExcalidrawSyncReturn => {
  const [syncState, setSyncState] = useState<SyncState>("IDLE");
  const [localVersion, setLocalVersion] = useState(0);

  // Refs to avoid stale closures
  const isUserEditingRef = useRef(false);
  const lastSyncTimeRef = useRef(Date.now());
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingRemoteUpdateRef = useRef<ExcalidrawElement[] | null>(null);
  const lastSentVersionRef = useRef(0);

  // Logging helper
  const log = useCallback(
    (msg: string, data?: any) => {
      if (config.enableLogging) {
        console.log(`[ExcalidrawSync] ${msg}`, data || "");
      }
    },
    [config.enableLogging]
  );

  // ============================================
  // CONFLICT RESOLUTION: Version-based merge
  // ============================================
  const mergeElements = useCallback(
    (local: ExcalidrawElement[], incoming: ExcalidrawElement[]) => {
      const localMap = new Map(local.map((e) => [e.id, e]));
      const incomingMap = new Map(incoming.map((e) => [e.id, e]));

      const merged = new Map(localMap);

      for (const [id, incomingEl] of incomingMap) {
        const localEl = localMap.get(id);

        if (!localEl) {
          // New element from remote
          merged.set(id, incomingEl);
          log("Added new element from remote", { id });
        } else if (incomingEl.version && localEl.version) {
          // Both have versions - compare
          if (incomingEl.version > localEl.version) {
            // Remote is newer
            if (
              incomingEl.versionNonce &&
              localEl.versionNonce &&
              incomingEl.versionNonce !== localEl.versionNonce
            ) {
              // Concurrent edit - use versionNonce tie-breaker
              const useLowerNonce =
                incomingEl.versionNonce < localEl.versionNonce;
              if (useLowerNonce) {
                merged.set(id, incomingEl);
                log("Concurrent edit - remote has lower versionNonce", { id });
              } else {
                log("Concurrent edit - keeping local (higher versionNonce)", {
                  id,
                });
              }
            } else {
              // Remote is legitimately newer
              merged.set(id, incomingEl);
              log("Remote is newer version", {
                id,
                remote: incomingEl.version,
                local: localEl.version,
              });
            }
          } else {
            // Local is same or newer - keep local (user has priority)
            log("Keeping local (same or newer version)", {
              id,
              remote: incomingEl.version,
              local: localEl.version,
            });
          }
        } else {
          // No version info - keep local as fallback
          log("No version info - keeping local", { id });
        }
      }

      return Array.from(merged.values());
    },
    [log]
  );

  // ============================================
  // TRACK USER EDITING STATE
  // ============================================
  useEffect(() => {
    const unsubDown = excalidrawAPI.onPointerDown(() => {
      isUserEditingRef.current = true;
      setSyncState((prev) => (prev === "IDLE" ? "EDITING" : prev));
      log("User started editing");
    });

    return unsubDown;
  }, [excalidrawAPI, log]);

  useEffect(() => {
    const unsubUp = excalidrawAPI.onPointerUp(() => {
      isUserEditingRef.current = false;
      log("User stopped editing");

      // Apply pending remote updates after user stops
      if (pendingRemoteUpdateRef.current) {
        log("Applying pending remote update");
        setSyncState("UPDATING_FROM_PEER");
        const pending = pendingRemoteUpdateRef.current;
        pendingRemoteUpdateRef.current = null;

        // Defer to next frame to avoid React batching issues
        setTimeout(() => {
          applyRemoteUpdate(pending);
        }, 0);
      } else if (syncState === "SYNCING_DIRTY") {
        // If we were syncing and got new changes, re-sync
        setSyncState("EDITING");
      }
    });

    return unsubUp;
  }, [excalidrawAPI, log, syncState]);

  // ============================================
  // LOCAL CHANGES: Debounce and send upstream
  // ============================================
  const handleLocalChange = useCallback(
    (elements: ExcalidrawElement[]) => {
      // Move to EDITING state if not already syncing
      setSyncState((prev) => {
        if (prev === "SYNCING") return "SYNCING_DIRTY";
        if (prev === "IDLE") return "EDITING";
        return prev;
      });

      // Increment local version
      setLocalVersion((prev) => prev + 1);

      // Clear existing debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Debounce before sending
      debounceTimeoutRef.current = setTimeout(() => {
        const currentVersion = localVersion + 1;

        // Check: is this actually different from what we last sent?
        if (lastSentVersionRef.current === currentVersion) {
          log("Skipping sync - version unchanged");
          return;
        }

        setSyncState((prev) => (prev === "SYNCING_DIRTY" ? "SYNCING" : "SYNCING"));
        log("Syncing local changes", { elements: elements.length, version: currentVersion });

        // TODO: Send to your backend here
        // await sendToBackend(elements, currentVersion)
        // .then(() => {
        //   lastSentVersionRef.current = currentVersion;
        //   setSyncState(isUserEditingRef.current ? "EDITING" : "IDLE");
        // })
        // .catch((err) => {
        //   log("Sync error", err);
        //   setSyncState("IDLE"); // retry on next change
        // })

        // For now, simulate it
        setTimeout(() => {
          lastSentVersionRef.current = currentVersion;
          setSyncState(isUserEditingRef.current ? "EDITING" : "IDLE");
          log("Sync complete");
        }, 100);
      }, config.debounceMs);
    },
    [config.debounceMs, localVersion, log]
  );

  // ============================================
  // REMOTE UPDATES: Merge and apply
  // ============================================
  const applyRemoteUpdate = useCallback(
    async (incomingElements: ExcalidrawElement[]) => {
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTimeRef.current;

      // Throttle: don't apply too frequently
      if (timeSinceLastSync < config.throttleMs) {
        log("Throttling remote update", { timeSince: timeSinceLastSync });
        pendingRemoteUpdateRef.current = incomingElements;
        return;
      }

      // Check: is user currently editing?
      if (isUserEditingRef.current) {
        log("User editing - queuing remote update");
        pendingRemoteUpdateRef.current = incomingElements;
        setSyncState((prev) => {
          if (prev === "SYNCING") return "SYNCING_DIRTY";
          return prev;
        });
        return;
      }

      // Get current state
      const currentElements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();

      // Merge
      const merged = mergeElements(currentElements, incomingElements);

      // Check if actually changed
      const contentChanged = JSON.stringify(merged) !== JSON.stringify(currentElements);

      if (!contentChanged) {
        log("No content changes after merge");
        setSyncState(isUserEditingRef.current ? "EDITING" : "IDLE");
        return;
      }

      log("Applying remote update", {
        incoming: incomingElements.length,
        merged: merged.length,
      });

      // Apply the merge
      excalidrawAPI.updateScene({
        elements: merged,
        appState,
        captureUpdate: CaptureUpdateAction.NEVER, // ← Critical: prevent undo/redo pollution
      });

      lastSyncTimeRef.current = now;
      setSyncState(isUserEditingRef.current ? "EDITING" : "IDLE");
    },
    [excalidrawAPI, mergeElements, config.throttleMs, log]
  );

  // ============================================
  // EXTERNAL TRIGGER: For receiving updates from backend
  // ============================================
  useEffect(() => {
    // This would be connected to your backend subscription
    // For example: Firebase listener, Socket.IO event, etc.
    // 
    // Example:
    // const unsubscribe = firebaseCollection.onSnapshot((snapshot) => {
    //   const remoteElements = snapshot.docs.map(doc => doc.data())
    //   applyRemoteUpdate(remoteElements)
    // })
    // return unsubscribe

    // For now, no-op
  }, [applyRemoteUpdate]);

  return {
    syncState,
    isSynced: syncState === "IDLE",
    handleLocalChange,
    applyRemoteUpdate,
  };
};
Option 2: Simpler - Firebase Pattern
For simpler use cases without true multiplayer:

typescript
import { ExcalidrawAPI, ExcalidrawElement, CaptureUpdateAction } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "lodash"; // or implement your own

export const useExcalidrawFirebaseSync = (
  excalidrawAPI: ExcalidrawAPI,
  upstreamElements: ExcalidrawElement[] | null
) => {
  const [isLocalDirty, setIsLocalDirty] = useState(false);
  const lastVersionRef = useRef(0);
  const isUserEditingRef = useRef(false);

  // Simple version-based merge
  const mergeElements = useCallback(
    (local: ExcalidrawElement[], remote: ExcalidrawElement[]) => {
      const localMap = new Map(local.map((e) => [e.id, e]));
      const remoteMap = new Map(remote.map((e) => [e.id, e]));

      const result = new Map(localMap);

      for (const [id, remoteEl] of remoteMap) {
        const localEl = localMap.get(id);

        if (!localEl) {
          result.set(id, remoteEl);
        } else if ((remoteEl.version || 0) > (localEl.version || 0)) {
          result.set(id, remoteEl);
        }
        // else: keep local
      }

      return Array.from(result.values());
    },
    []
  );

  // Debounced local change handler
  const handleChange = useCallback(
    debounce((elements: ExcalidrawElement[]) => {
      setIsLocalDirty(true);
      // TODO: Send elements to Firebase here
      // db.collection('drawing').doc('main').set({ elements, timestamp: serverTimestamp() })
    }, 500),
    []
  );

  // Listen to onChange
  useEffect(() => {
    const unsubscribe = excalidrawAPI.onChange((elements) => {
      handleChange(elements);
    });
    return unsubscribe;
  }, [excalidrawAPI, handleChange]);

  // Track user editing
  useEffect(() => {
    const down = excalidrawAPI.onPointerDown(() => {
      isUserEditingRef.current = true;
    });
    return down;
  }, [excalidrawAPI]);

  useEffect(() => {
    const up = excalidrawAPI.onPointerUp(() => {
      isUserEditingRef.current = false;
    });
    return up;
  }, [excalidrawAPI]);

  // Listen to upstream changes
  useEffect(() => {
    if (!upstreamElements || isUserEditingRef.current) {
      return;
    }

    const current = excalidrawAPI.getSceneElements();
    const merged = mergeElements(current, upstreamElements);

    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      excalidrawAPI.updateScene({
        elements: merged,
        appState: excalidrawAPI.getAppState(),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      setIsLocalDirty(false);
    }
  }, [upstreamElements, excalidrawAPI, mergeElements]);

  return { isLocalDirty };
};
Usage Example
typescript
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import { useRef, useState } from "react";
import { useExcalidrawSync } from "./hooks/useExcalidrawSync";

export const CollaborativeDrawing = ({ userId }: { userId: string }) => {
  const excalidrawAPIRef = useRef(null);
  const [remoteElements, setRemoteElements] = useState(null);

  const { syncState, isSynced, handleLocalChange, applyRemoteUpdate } =
    useExcalidrawSync(excalidrawAPIRef.current, {
      debounceMs: 400,
      throttleMs: 300,
      enableLogging: true,
    });

  // Listen to backend updates (example with Socket.IO)
  useEffect(() => {
    const socket = io(BACKEND_URL);

    socket.on("drawing:update", async (data) => {
      const elements = JSON.parse(data.elements);
      await applyRemoteUpdate(elements);
    });

    return () => socket.disconnect();
  }, [applyRemoteUpdate]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "10px",
          backgroundColor: isSynced ? "#e8f5e9" : "#fff3e0",
        }}
      >
        Status: {syncState} {!isSynced && "⚠️ Not synced"}
      </div>

      <Excalidraw
        ref={excalidrawAPIRef}
        onChange={handleLocalChange}
        excalidrawAPI={(api) => {
          excalidrawAPIRef.current = api;
        }}
      />
    </div>
  );
};
State Machine
States Explained
text
┌─────────────────────────────────────────────────────────────┐
│ IDLE                                                        │
│ No activity. Waiting for user input or remote updates.     │
└─────────────────────────────────────────────────────────────┘
              ↓
       User starts drawing
              ↓
┌─────────────────────────────────────────────────────────────┐
│ EDITING                                                     │
│ User is actively drawing/editing. onChange fires.          │
│ Debounce timer running. Don't apply remote updates.        │
└─────────────────────────────────────────────────────────────┘
              ↓
       Debounce timeout fires
              ↓
┌─────────────────────────────────────────────────────────────┐
│ SYNCING                                                     │
│ Sending local changes to backend. Waiting for ACK.        │
│ If changes come during this → SYNCING_DIRTY               │
└─────────────────────────────────────────────────────────────┘
              ↓
       Backend ACK received
              ↓
    ┌─────────────────────────┐
    │ If SYNCING_DIRTY        │ ──→ Re-enter SYNCING
    │ If user editing        │ ──→ EDITING
    │ Otherwise              │ ──→ IDLE
    └─────────────────────────┘

Remote update arrives anytime:
├─ If user editing      → queue it
├─ If SYNCING/DIRTY     → queue it
└─ Otherwise            → apply immediately
     ↓
┌─────────────────────────────────────────────────────────────┐
│ UPDATING_FROM_PEER                                          │
│ Applying remote changes. Short-lived state.                │
│ Transitions back to previous state after apply.            │
└─────────────────────────────────────────────────────────────┘
API Reference Summary
Core Methods
Method	Signature	When to Use
updateScene()	(sceneData) => void	Apply remote/merged elements to canvas
onChange()	(callback) => unsubscribe	Listen to ALL local changes (debounce!)
getSceneElements()	() => ExcalidrawElement[]	Get current elements before merge
getAppState()	() => AppState	Get zoom, selection, etc.
onPointerDown()	(callback) => unsubscribe	Detect when user starts editing
onPointerUp()	(callback) => unsubscribe	Detect when user stops editing
resetScene()	() => void	Clear canvas
setToast()	(message) => void	Show notification
captureUpdate Values
Value	Behavior	Use Case
IMMEDIATELY	Add to undo/redo stack right away	Local user edits
EVENTUALLY	Add to undo/redo eventually (batched)	Async operations
NEVER	Don't add to undo/redo stack	Remote updates (prevents divergence)
ExcalidrawElement Fields for Sync
Field	Type	Purpose
id	string	Unique identifier
version	number	Incremented on every edit
versionNonce	number	Random tie-breaker for concurrent edits
updated	number	Timestamp of last update
isDeleted	boolean	Mark as deleted (soft delete)
Testing Checklist
 Local changes don't create infinite loop

 Remote updates don't interrupt active editing

 Text input focus is preserved when remote updates arrive

 Version numbers are respected in merge

 versionNonce breaks ties deterministically (all peers converge)

 Debounce/throttle values prevent update storms

 Offline changes queue properly

 State machine transitions correctly

 Undo/redo doesn't include remote updates

Production Checklist
 Logging disabled in production (or conditional)

 Error handling for backend sync failures

 Retry logic for failed sends

 Memory cleanup (unsubscribe from all listeners)

 Performance monitoring for update frequency

 Conflict metrics tracking (how often versionNonce breaks ties?)

 User feedback on sync status

 Rate limiting on client to prevent backend overload