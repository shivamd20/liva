import { ExcalidrawElement, OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { Board } from '../types';

/**
 * Extract board ID from a board card element ID
 */
function extractBoardIdFromElement(element: ExcalidrawElement): string | null {
    if (element.id.startsWith('card-title-')) {
        return element.id.replace('card-title-', '');
    }
    if (element.id.startsWith('card-date-')) {
        return element.id.replace('card-date-', '');
    }
    if (element.id.startsWith('card-')) {
        return element.id.replace('card-', '');
    }
    return null;
}

/**
 * Intelligently merge board list elements
 * 
 * Rules:
 * 1. Deletions of board cards are ignored (restored from remote boards)
 * 2. Visual style changes to existing cards are preserved (color, position, etc.)
 * 3. Board titles and dates are ALWAYS synced from remote boards
 * 4. New boards are appended without duplication
 * 5. Non-board-card elements are preserved as-is
 * 
 * @param localElements - Current elements from the home board
 * @param remoteBoards - List of boards from the backend
 * @returns Merged element array
 */
export function mergeBoardListElements(
    localElements: OrderedExcalidrawElement[],
    remoteBoards: Board[]
): OrderedExcalidrawElement[] {
    // Create a map of board IDs to board data
    const remoteBoardMap = new Map(remoteBoards.map(b => [b.id, b]));

    // Track which board IDs are currently represented in local elements
    const localBoardIds = new Set<string>();
    localElements.forEach(el => {
        const boardId = extractBoardIdFromElement(el);
        if (boardId) {
            localBoardIds.add(boardId);
        }
    });

    // Start with non-board-card elements and existing board cards (with updated text)
    const mergedElements: OrderedExcalidrawElement[] = [];

    localElements.forEach(el => {
        const boardId = extractBoardIdFromElement(el);

        // If it's not a board card element, keep it
        if (!boardId) {
            mergedElements.push(el);
            return;
        }

        // If the board doesn't exist remotely, skip this element (board was deleted)
        const remoteBoard = remoteBoardMap.get(boardId);
        if (!remoteBoard) {
            return;
        }

        // Update title and date text from remote board
        if (el.type === 'text' && el.id.startsWith('card-title-')) {
            // Sync title from remote and lock it
            const updatedEl = { ...el };
            // @ts-ignore - text property exists on text elements
            updatedEl.text = remoteBoard.title || 'Untitled';
            // @ts-ignore
            updatedEl.originalText = remoteBoard.title || 'Untitled';
            // Lock the element to prevent editing
            updatedEl.locked = true;
            // Recalculate width based on new text
            const fontSize = (el as any).fontSize || 20;
            updatedEl.width = (remoteBoard.title || 'Untitled').length * fontSize * 0.6;
            mergedElements.push(updatedEl as OrderedExcalidrawElement);
        } else if (el.type === 'text' && el.id.startsWith('card-date-')) {
            // Sync date from remote and lock it
            const updatedEl = { ...el };
            const dateText = new Date(remoteBoard.updatedAt).toLocaleDateString();
            // @ts-ignore
            updatedEl.text = dateText;
            // @ts-ignore
            updatedEl.originalText = dateText;
            // Lock the element to prevent editing
            updatedEl.locked = true;
            // Recalculate width based on new text
            const fontSize = (el as any).fontSize || 14;
            updatedEl.width = dateText.length * fontSize * 0.6;
            mergedElements.push(updatedEl as OrderedExcalidrawElement);
        } else {
            // Keep other board card elements (rectangle, etc.) with their style changes
            mergedElements.push(el);
        }
    });

    return mergedElements;
}

/**
 * Get the list of board IDs that need to be added to the home board
 * 
 * @param currentElements - Current elements from the home board
 * @param remoteBoards - List of boards from the backend
 * @returns Array of board IDs that need cards created
 */
export function getBoardsNeedingCards(
    currentElements: OrderedExcalidrawElement[],
    remoteBoards: Board[]
): string[] {
    // Track which board IDs are currently represented
    const existingBoardIds = new Set<string>();
    currentElements.forEach(el => {
        const boardId = extractBoardIdFromElement(el);
        if (boardId) {
            existingBoardIds.add(boardId);
        }
    });

    // Find boards that need cards
    return remoteBoards
        .filter(board => !existingBoardIds.has(board.id))
        .map(board => board.id);
}
