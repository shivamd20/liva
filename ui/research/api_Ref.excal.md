EXCALIDRAW SYNC - API REFERENCE & IMPLEMENTATION SUMMARY
Quick Reference: APIs Used in Real Implementations
API MATRIX
API	Method	Signature	When Real-World Uses It	Why
updateScene	Send merged elements to canvas	(sceneData) => void	Every remote update received	Apply peer changes without recreating canvas
onChange	Listen to all local changes	(callback) => unsubscribe	Every time user edits	Detect when to debounce + send upstream
getSceneElements	Get current elements	() => ExcalidrawElement[]	Before merging with remote	Need to compare local vs incoming
getAppState	Get canvas state	() => AppState	Before updateScene call	Pass required appState to updateScene
onPointerDown	User starts editing	(callback) => unsubscribe	Set editing flag true	Know when NOT to apply remote updates
onPointerUp	User stops editing	(callback) => unsubscribe	Set editing flag false, apply pending	Apply queued remote updates after user stops
scrollToContent	Scroll to specific element	(target, opts) => void	(Optional) Rarely used in collab	For UX: focus on peer's recent edit
setActiveTool	Change active tool	(tool) => void	(Optional) Rarely used	Could use to sync tool selection
captureUpdate Parameter (CRITICAL)
typescript
// For LOCAL user changes → use IMMEDIATELY
updateScene({
  elements,
  appState,
  captureUpdate: CaptureUpdateAction.IMMEDIATELY
})

// For REMOTE peer changes → use NEVER (absolutely critical)
updateScene({
  elements,
  appState,
  captureUpdate: CaptureUpdateAction.NEVER  // ← Prevents undo/redo divergence
})
Real-World Implementations: What They Do
1. Excalidraw Official (Socket.IO)
Source: excalidraw.com + excalidraw-room GitHub

text
User draws → onChange fires → Socket.IO broadcast → 
  All peers receive → Merge with versionNonce → updateScene(NEVER)
Merge Algorithm:

Compare element.version (higher wins)

If versions tied: compare element.versionNonce (lower wins - deterministic)

All peers converge on same state because versionNonce is same across network

APIs Used:

onChange() - raw broadcast (no debounce)

updateScene() - with NEVER

getSceneElements() - for merge

getAppState() - for updateScene call

Debounce/Throttle:

Mouse events: debounce 30-100ms for performance

Element changes: broadcast immediately (relies on WebSocket batch)

2. Firebase Pattern (YouTube Video)
Source: "Firebase Excalidraw - Implementing live sync" - detailed walkthrough

text
User draws → onChange fires → debounce 1000ms → 
  Compare versions → Firebase.set() → 
  Firebase.onSnapshot() → Merge locally → updateScene(NEVER)
Merge Algorithm:

typescript
const merged = merge(local, incoming);
// For each element:
//   if (incoming.version > local.version) use incoming
//   else use local (user priority)
APIs Used:

onChange() - with debounce (1000ms shown in video)

updateScene() - with NEVER

getSceneElements() - for merge

getAppState() - for updateScene

Debounce/Throttle:

Local → Firebase: debounce 1000ms

Firebase → Local: throttle 300-500ms

Key: don't interrupt user while editing

3. State Machine Pattern (Advanced)
Source: Multiple YouTube implementations + GitHub discussions

text
User starts drawing:
  IDLE → EDITING

onChange fires, debounce done:
  EDITING → SYNCING → (backend ack) → IDLE
  
Remote update arrives:
  If EDITING: queue it
  If SYNCING: mark SYNCING_DIRTY
  If IDLE: apply immediately

User stops editing:
  Apply any pending remote updates
APIs Used:

onChange() - with debounce

onPointerDown() / onPointerUp() - state tracking

updateScene() - with NEVER

getSceneElements() - for merge

getAppState() - for updateScene

Key Insight: This pattern prevents interrupting user edits = better UX

Production Checklist
APIs You MUST Use
 updateScene() with CaptureUpdateAction.NEVER for remote updates

 onChange() for local changes (DEBOUNCE IT)

 getSceneElements() before merging

 getAppState() before calling updateScene

 onPointerUp() to detect when user stops editing

Debounce/Throttle Values
typescript
// Local → Backend
debounce: 400-500ms (Firebase uses 1000ms, but that feels slow)

// Backend → Local
throttle: 300-500ms (max 1 update per 300ms)

// Don't apply while user editing: use onPointerDown/Up flags
Merge Algorithm
typescript
// Minimum viable
for (element in incoming) {
  if (incoming.version > local.version) {
    keep incoming
  } else {
    keep local // user priority
  }
}

// Production (with tie-break)
if (incoming.version > local.version) {
  keep incoming
} else if (incoming.version === local.version) {
  // Concurrent edit: use versionNonce to break tie deterministically
  if (incoming.versionNonce < local.versionNonce) {
    keep incoming
  } else {
    keep local
  }
} else {
  keep local
}
Infinite Loop Prevention
typescript
// DO THIS:
const [lastSentVersion, setLastSentVersion] = useState(0)

onChange = (elements) => {
  const currentVersion = elements?.version || 0
  
  // Skip if version unchanged
  if (currentVersion === lastSentVersion) return
  
  debounce(() => {
    sendToBackend(elements)
    setLastSentVersion(currentVersion)
  }, 400)
}

// OR DO THIS:
useDeepComparison = (curr, prev) => {
  return JSON.stringify(curr) !== JSON.stringify(prev)
}

onChange = (elements) => {
  if (!useDeepComparison(elements, lastElements)) return
  debounce(() => sendToBackend(elements), 400)
}
Focus Preservation
typescript
// Before applying remote update:
const shouldApplyUpdate = (element: ExcalidrawElement) => {
  const appState = excalidrawAPI.getAppState()
  const isSelected = appState.selectedElementIds[element.id]
  
  // If user selected this element, don't update it (preserve focus)
  return !isSelected
}

// If shouldn't apply, queue for later
if (!shouldApplyUpdate(element)) {
  pendingUpdates.push(element)
  return
}
Real Code Patterns from GitHub
Pattern 1: Simple Version-Based Merge
typescript
// From Firebase implementation
const reconcile = (local: Elements[], remote: Elements[]) => {
  const map = new Map(local.map(e => [e.id, e]))
  
  for (const el of remote) {
    const existing = map.get(el.id)
    if (!existing || el.version > existing.version) {
      map.set(el.id, el)
    }
  }
  
  return Array.from(map.values())
}
Pattern 2: versionNonce Tie-Break (Excalidraw Official)
typescript
// From excalidraw-room
const reconcile = (local: Elements[], remote: Elements[]) => {
  for (const remoteEl of remote) {
    const localEl = local.find(e => e.id === remoteEl.id)
    
    if (!localEl) {
      local.push(remoteEl)
    } else if (remoteEl.version > localEl.version) {
      Object.assign(localEl, remoteEl)
    } else if (remoteEl.version === localEl.version) {
      // Concurrent edit - use versionNonce
      if (remoteEl.versionNonce < localEl.versionNonce) {
        Object.assign(localEl, remoteEl)
      }
    }
  }
  return local
}
Pattern 3: State Machine (Real Implementation)
typescript
// From YouTube video - Advanced pattern
type State = "IDLE" | "EDITING" | "SYNCING" | "SYNCING_DIRTY" | "UPDATING"

const transition = (current: State, event: string): State => {
  const table = {
    IDLE: { startEdit: "EDITING", remoteUpdate: "UPDATING" },
    EDITING: { changeEnd: "SYNCING", remoteUpdate: "EDITING" },
    SYNCING: { ack: "IDLE", remoteUpdate: "SYNCING_DIRTY" },
    SYNCING_DIRTY: { ack: "SYNCING" },
    UPDATING: { done: "IDLE" }
  }
  
  return table[current][event] || current
}
What Each Real Implementation Gets Wrong (or Doesn't Handle)
Implementation	Strength	Weakness
Excalidraw Official	True CRDT-like with versionNonce	Complexity high, hardcoded Socket.IO
Firebase Pattern	Simple, works for many cases	Doesn't handle concurrent same-element edits well
State Machine	Best UX (never interrupts user)	More code, more complex
Decision Tree: Which Pattern to Use?
text
Do you need true real-time collab with many concurrent users?
├─ YES → Use Excalidraw Official pattern (versionNonce + Socket.IO)
└─ NO
    └─ Do you have Firebase/Realtime DB?
        ├─ YES → Use Firebase pattern (version-based merge, debounce)
        └─ NO
            └─ Is UX priority (never interrupt user)?
                ├─ YES → Use State Machine pattern
                └─ NO → Use simple version-based merge (lightweight)
Testing Your Implementation
Tests to Run
typescript
// Test 1: Local changes don't create infinite loop
test("onChange doesn't fire itself", () => {
  let changeCount = 0
  onChange(() => changeCount++)
  
  user.draw()
  expect(changeCount).toBe(1) // Should fire once
})

// Test 2: Remote updates don't interrupt editing
test("updateScene doesn't interrupt user editing", () => {
  user.startDrawing()
  simulateRemoteUpdate(elements)
  expect(textInputHasFocus).toBe(true) // Focus preserved
})

// Test 3: Versions merge correctly
test("higher version wins", () => {
  const local = { id: "1", version: 5, data: "old" }
  const remote = { id: "1", version: 6, data: "new" }
  const merged = merge([local], [remote])
  expect(merged.data).toBe("new")
})

// Test 4: Debounce/throttle prevents storms
test("debounce prevents rapid sends", async () => {
  let sends = 0
  onChange = debounce(() => sends++, 400)
  
  for (let i = 0; i < 10; i++) {
    simulateChange()
  }
  
  expect(sends).toBe(0) // Not sent yet
  await wait(500)
  expect(sends).toBe(1) // Sent once after debounce
})
Final Decision: What to Implement
Recommended approach for your case:

Start with: Version-based merge (Pattern 1)

Add: Debounce 400ms local → backend

Add: Throttle 300ms backend → local

Add: onPointerUp/Down for "don't interrupt user"

Later if needed: Add versionNonce for concurrent edit tie-breaking

This gives you 80% of the benefit with 20% of the complexity.