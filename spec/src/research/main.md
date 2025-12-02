📊 RESEARCH FINDINGS SUMMARY
Real-World Implementations Analyzed:
Excalidraw Official (Socket.IO) - Uses element.versionNonce for deterministic tie-breaking

Firebase Pattern - Simple version-based merge with debounce

State Machine Approach - Prevents interrupting user edits (best UX)

excalidraw-room - Official collaboration server (GitHub)

alswl/excalidraw-collaboration - Docker-based deployment

🔑 CRITICAL FINDINGS
1. APIs You Actually Need
API	Purpose	Real-World Use
updateScene()	Apply remote changes	Must use CaptureUpdateAction.NEVER for remotes
onChange()	Listen to local changes	MUST debounce 400-500ms
getSceneElements()	Get current state	Needed before merge
getAppState()	Get canvas state	Needed for updateScene call
onPointerUp/Down()	Detect user editing	KEY: Prevents interrupting user
2. The Conflict Resolution Algorithm
Excalidraw Official uses this (proven to work):

typescript
// Compare element.id
if (!localEl) → add incoming element

// Compare element.version (higher wins)
if (incoming.version > local.version) → use incoming

// Tie-break with versionNonce (lower wins - deterministic)
if (same version && different nonce) → lower nonce wins

// Result: All peers converge on same state deterministically
3. The Debounce/Throttle Pattern That Works
text
Local changes:  debounce 400-500ms before sending upstream
Remote updates: throttle to max 1 per 300ms
User editing:   queue remote updates, apply after user stops
4. Why You Get Infinite Loops
The Loop:

text
onChange fires → send to backend → update received → 
  updateScene() called → onChange fires again → LOOP
The Fix:

Use version tracking (skip if version unchanged)

Use deep comparison (skip if content same)

Mark updates with source flag (don't process own changes)

5. The NEVER Flag is CRITICAL
typescript
// ❌ WRONG - Creates divergent undo/redo stacks between peers
updateScene({
  elements,
  appState,
  captureUpdate: CaptureUpdateAction.IMMEDIATELY
})

// ✅ CORRECT - Prevents undo/redo divergence
updateScene({
  elements,
  appState,
  captureUpdate: CaptureUpdateAction.NEVER
})
📁 Files Created For You
1. excalidraw-sync.md
Complete 500+ line implementation guide with:

Detailed API breakdown

Conflict resolution explanation

State machine patterns

Production code examples

2. useExcalidrawSync.ts
Production-ready React hook with:

Full state machine implementation

Version-based merge algorithm

Debounce/throttle logic

Socket.IO + Firebase examples

400+ lines of working code

3. api-reference.md
Quick reference with:

API matrix (which APIs do what)

Real-world patterns from GitHub

What each implementation gets wrong

Testing checklist

Decision tree for your use case

💥 What Real Projects Actually Do
Firebase Implementation Pattern (from YouTube video)
text
User draws → onChange (debounce 1000ms) → Firebase.set() →
Firebase.onSnapshot() → merge versions → updateScene(NEVER)
Excalidraw Official Pattern
text
User draws → onChange (broadcast immediately) → Socket.IO →
All peers → merge with versionNonce → updateScene(NEVER)
State Machine Pattern (Best UX)
text
IDLE → (user starts) → EDITING → (user stops) → SYNCING →
(ack) → IDLE

Remote arrives: if EDITING, queue it. If IDLE, apply now.
