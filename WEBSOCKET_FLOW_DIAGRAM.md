# WebSocket Flow Diagram

## Connection Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. WebSocket Connect
       │    ws://host/ws/note/note-123
       ▼
┌─────────────────────────────────────┐
│          Worker (index.ts)          │
│                                     │
│  if (pathname.startsWith('/ws/'))   │
│    → Extract noteId                 │
│    → Get Durable Object stub        │
│    → Forward request                │
└──────────────┬──────────────────────┘
               │
               │ 2. Forward to DO
               ▼
┌─────────────────────────────────────────────┐
│    NoteDurableObject (note-123)             │
│                                             │
│  fetch(request) {                           │
│    if (pathname === '/websocket') {         │
│      → Create WebSocketPair                 │
│      → Accept server side                   │
│      → Store session                        │
│      → Send initial state                   │
│      → Return client side                   │
│    }                                        │
│  }                                          │
└──────────────┬──────────────────────────────┘
               │
               │ 3. Return WebSocket
               ▼
┌─────────────────────────────────────┐
│          Worker (index.ts)          │
│                                     │
│  Return WebSocket to client         │
└──────────────┬──────────────────────┘
               │
               │ 4. WebSocket established
               ▼
┌─────────────┐
│   Client    │
│             │
│  ws.onopen  │ ✅ Connected!
│             │
│  ws.onmessage receives:             │
│  {                                  │
│    type: "initial",                 │
│    data: { id, version, title, ... }│
│  }                                  │
└─────────────┘
```

## Update Flow

```
┌─────────────┐                    ┌─────────────┐
│  Client A   │                    │  Client B   │
│  (Browser)  │                    │  (Browser)  │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ Both connected via WebSocket    │
       │                                  │
       │ 1. HTTP POST /api/v1/updateNote │
       ▼                                  │
┌─────────────────────────────────────┐  │
│          Worker (index.ts)          │  │
│                                     │  │
│  tRPC endpoint                      │  │
└──────────────┬──────────────────────┘  │
               │                          │
               │ 2. Call service          │
               ▼                          │
┌─────────────────────────────────────┐  │
│    NotesServiceDO (service-do.ts)   │  │
│                                     │  │
│  updateNote() {                     │  │
│    → Get DO stub                    │  │
│    → Call stub.updateNote()         │  │
│  }                                  │  │
└──────────────┬──────────────────────┘  │
               │                          │
               │ 3. RPC call to DO        │
               ▼                          │
┌─────────────────────────────────────────────┐
│    NoteDurableObject (note-123)             │
│                                             │
│  updateNote() {                             │
│    → Update storage                         │
│    → broadcastUpdate(current, "update")     │
│  }                                          │
│                                             │
│  broadcastUpdate() {                        │
│    sessions.forEach(session => {            │
│      session.ws.send(JSON.stringify({       │
│        type: "update",                      │
│        data: current                        │
│      }))                                    │
│    })                                       │
│  }                                          │
└──────────────┬──────────────┬──────────────┘
               │              │
               │ 4. Broadcast │
               ▼              ▼
┌─────────────┐          ┌─────────────┐
│  Client A   │          │  Client B   │
│             │          │             │
│ ws.onmessage│          │ ws.onmessage│
│ receives:   │          │ receives:   │
│ {           │          │ {           │
│   type:     │          │   type:     │
│   "update", │          │   "update", │
│   data: ... │          │   data: ... │
│ }           │          │ }           │
└─────────────┘          └─────────────┘
     ✅ Updated!              ✅ Updated!
```

## Session Management

```
┌─────────────────────────────────────────────┐
│    NoteDurableObject                        │
│                                             │
│  sessions: Map<WebSocket, Session>          │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ WebSocket 1 → { id: "abc", ws: ... }│   │
│  ├─────────────────────────────────────┤   │
│  │ WebSocket 2 → { id: "def", ws: ... }│   │
│  ├─────────────────────────────────────┤   │
│  │ WebSocket 3 → { id: "ghi", ws: ... }│   │
│  └─────────────────────────────────────┘   │
│                                             │
│  On update:                                 │
│    → Iterate all sessions                   │
│    → Send message to each WebSocket         │
│    → Remove failed connections              │
│                                             │
│  On close/error:                            │
│    → Remove session from map                │
│    → Automatic cleanup                      │
└─────────────────────────────────────────────┘
```

## Multi-Client Scenario

```
Time →

Client A          Client B          Client C          NoteDurableObject
   |                 |                 |                      |
   |─────────────────┼─────────────────┼─────────────────────▶| Connect
   |                 |                 |                      |
   |◀────────────────┼─────────────────┼──────────────────────| Initial state
   |                 |                 |                      |
   |                 |─────────────────┼─────────────────────▶| Connect
   |                 |                 |                      |
   |                 |◀────────────────┼──────────────────────| Initial state
   |                 |                 |                      |
   |                 |                 |─────────────────────▶| Connect
   |                 |                 |                      |
   |                 |                 |◀─────────────────────| Initial state
   |                 |                 |                      |
   |─────────────────┼─────────────────┼─────────────────────▶| Update note
   |                 |                 |                      |
   |◀────────────────┼─────────────────┼──────────────────────| Broadcast
   |                 |◀────────────────┼──────────────────────| Broadcast
   |                 |                 |◀─────────────────────| Broadcast
   |                 |                 |                      |
   | All clients receive update instantly!                    |
   |                 |                 |                      |
```

## Message Types Timeline

```
Client connects
    ↓
┌─────────────────────────────────────┐
│ type: "initial"                     │
│ → Current state of the note         │
└─────────────────────────────────────┘
    ↓
Someone creates a note (rare, usually already exists)
    ↓
┌─────────────────────────────────────┐
│ type: "create"                      │
│ → New note created                  │
└─────────────────────────────────────┘
    ↓
Someone updates the note
    ↓
┌─────────────────────────────────────┐
│ type: "update"                      │
│ → Note content/title changed        │
└─────────────────────────────────────┘
    ↓
Someone reverts to previous version
    ↓
┌─────────────────────────────────────┐
│ type: "revert"                      │
│ → Note reverted to older version    │
└─────────────────────────────────────┘
```

## Error Handling

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ Connection attempt
       ▼
┌─────────────────────────────────────┐
│          Worker                     │
│                                     │
│  Note doesn't exist?                │
│    → DO still accepts connection    │
│    → Sends no initial state         │
│    → Client receives nothing        │
│                                     │
│  Invalid WebSocket upgrade?         │
│    → Return 426 error               │
│    → Connection fails               │
└─────────────────────────────────────┘
       │
       │ Connection established
       ▼
┌─────────────────────────────────────────────┐
│    NoteDurableObject                        │
│                                             │
│  WebSocket error?                           │
│    → Remove from sessions                   │
│    → Automatic cleanup                      │
│                                             │
│  WebSocket close?                           │
│    → Remove from sessions                   │
│    → Automatic cleanup                      │
│                                             │
│  Broadcast fails?                           │
│    → Catch error                            │
│    → Remove failed session                  │
│    → Continue with other sessions           │
└─────────────────────────────────────────────┘
```

## Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                    NoteDurableObject                     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │           Durable Object Storage               │     │
│  │                                                │     │
│  │  {                                             │     │
│  │    current: { id, version, title, blob, ... } │     │
│  │    history: [ v1, v2, v3, ... ]               │     │
│  │  }                                             │     │
│  └────────────────────────────────────────────────┘     │
│                         ↕                                │
│  ┌────────────────────────────────────────────────┐     │
│  │           WebSocket Sessions                   │     │
│  │                                                │     │
│  │  Map {                                         │     │
│  │    ws1 → { id: "abc", ws: WebSocket }         │     │
│  │    ws2 → { id: "def", ws: WebSocket }         │     │
│  │  }                                             │     │
│  └────────────────────────────────────────────────┘     │
│                         ↓                                │
│                    Broadcast                             │
│                         ↓                                │
└──────────────────────────┬───────────────────────────────┘
                           │
                ┌──────────┼──────────┐
                ↓          ↓          ↓
           Client 1    Client 2    Client 3
```

## Summary

1. **Connection**: Client → Worker → Durable Object → WebSocket established
2. **Initial State**: Durable Object sends current note state immediately
3. **Updates**: Any change triggers broadcast to all connected clients
4. **Cleanup**: Disconnected sessions automatically removed
5. **Scalability**: Each note has its own Durable Object instance

The architecture ensures:
- ✅ Real-time updates
- ✅ Efficient broadcasting
- ✅ Automatic cleanup
- ✅ Scalable design
