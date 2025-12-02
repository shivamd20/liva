# BoardEditor Component

Clean Excalidraw integration with bidirectional sync.

## Structure

```
BoardEditor.tsx          → Main component (presentation only)
├── useExcalidrawSync    → Sync logic hook
└── excalidrawMerge      → Merge algorithm utility
```

## Files

### `BoardEditor.tsx`
- Renders Excalidraw component
- Passes board data and callbacks
- Delegates all sync logic to hook

### `hooks/useExcalidrawSync.ts`
- Debounces local changes (400ms)
- Handles remote updates with merge
- Prevents infinite loops
- Manages cleanup

### `utils/excalidrawMerge.ts`
- Version-based merge algorithm
- Higher version wins
- User priority on ties

## How It Works

1. **Local Changes**: User draws → debounced → sent to parent
2. **Remote Changes**: Board prop updates → merged with local → applied to canvas
3. **Loop Prevention**: Tracks last sent state to skip echo updates

## Usage

```tsx
<BoardEditor
  board={board}
  onChange={(updatedBoard) => saveBoard(updatedBoard)}
  menuItems={<CustomMenuItems />}
/>
```

The component handles all sync complexity internally.
