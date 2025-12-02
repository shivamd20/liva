/**
 * Version-based merge algorithm for Excalidraw elements
 * 
 * Strategy: Higher version wins, user priority on ties
 */
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export function mergeElements(
  local: readonly OrderedExcalidrawElement[],
  incoming: OrderedExcalidrawElement[]
): OrderedExcalidrawElement[] {
  const localMap = new Map(local.map((e) => [e.id, e]));
  const incomingMap = new Map(incoming.map((e) => [e.id, e]));
  const result = new Map(localMap);

  // Process incoming elements
  for (const [id, incomingEl] of incomingMap) {
    const localEl = localMap.get(id);

    if (!localEl) {
      // New element from remote
      result.set(id, incomingEl);
    } else {
      // Compare versions (higher wins)
      const localVersion = localEl.version || 0;
      const incomingVersion = incomingEl.version || 0;

      if (incomingVersion > localVersion) {
        result.set(id, incomingEl);
      }
      // Keep local if same or newer (user priority)
    }
  }

  return Array.from(result.values());
}
