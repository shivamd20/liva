import { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { Board } from '../types';

// Helper to create a unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to create a basic rectangle
const createRectangle = (
    x: number,
    y: number,
    width: number,
    height: number,
    backgroundColor: string = 'transparent',
    strokeColor: string = '#000000',
    id?: string
): ExcalidrawElement => ({
    id: id || generateId(),
    type: 'rectangle',
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor,
    backgroundColor,
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: Math.random() * 100000,
    version: 1,
    versionNonce: 0,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    index: null,
});

// Helper to create text
const createText = (
    x: number,
    y: number,
    text: string,
    fontSize: number = 20,
    color: string = '#000000',
    id?: string
): ExcalidrawElement => ({
    id: id || generateId(),
    type: 'text',
    x,
    y,
    width: text.length * fontSize * 0.6, // Approximate width
    height: fontSize * 1.2,
    angle: 0,
    strokeColor: color,
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.random() * 100000,
    version: 1,
    versionNonce: 0,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    index: null,
    text,
    fontSize,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: text,
    autoResize: true,
    lineHeight: 1.2 as any,
});

export const generateHomeBoardElements = (boards: Board[]): ExcalidrawElement[] => {
    const elements: ExcalidrawElement[] = [];

    // 1. About Section
    const title = createText(100, 100, 'Welcome to Liva', 40, '#000000', 'home-title');
    (title as any).locked = true;
    elements.push(title);

    const subtitle = createText(100, 160, 'A collaborative whiteboard for your ideas.', 20, '#666666', 'home-subtitle');
    (subtitle as any).locked = true;
    elements.push(subtitle);

    // 2. My Boards Section
    const boardsStartY = 250;
    const myBoardsTitle = createText(100, boardsStartY, 'My Boards', 30, '#000000', 'home-my-boards-title');
    (myBoardsTitle as any).locked = true;
    elements.push(myBoardsTitle);

    // Create Board Button
    const createBtnX = 300;
    const createBtn = createRectangle(createBtnX, boardsStartY, 140, 40, '#28a745', '#218838', 'home-create-btn');
    // @ts-ignore
    createBtn.link = '/board/new';
    (createBtn as any).locked = true;
    elements.push(createBtn);

    const createBtnText = createText(createBtnX + 20, boardsStartY + 10, 'New Board', 20, '#ffffff', 'home-create-btn-text');
    (createBtnText as any).locked = true;
    elements.push(createBtnText);

    if (boards.length === 0) {
        // elements.push(createText(100, boardsStartY + 60, 'No boards yet. Create one!', 20, '#888888', 'home-no-boards'));
    } else {
        boards.forEach((board, index) => {
            elements.push(...createBoardCard(board, index, boardsStartY));
        });
    }

    return elements;
};

export const createBoardCard = (board: Board, index: number, startY: number): ExcalidrawElement[] => {
    const elements: ExcalidrawElement[] = [];
    const x = 100 + (index % 3) * 220;
    const y = startY + 60 + Math.floor(index / 3) * 120;

    // Board card background
    // Use deterministic ID based on board ID
    const cardId = `card-${board.id}`;
    const card = createRectangle(x, y, 200, 80, '#f0f0f0', '#cccccc', cardId);
    // @ts-ignore
    card.link = `/board/${board.id}`;
    (card as any).locked = true;

    // Truncate title if too long
    const maxTitleLength = 20;
    const title = board.title || 'Untitled';
    const displayTitle = title.length > maxTitleLength
        ? title.substring(0, maxTitleLength) + '...'
        : title;

    elements.push(card);

    // Create title text element and lock it to prevent editing
    const titleElement = createText(x + 10, y + 10, displayTitle, 20, '#000000', `card-title-${board.id}`);
    (titleElement as any).locked = true;
    elements.push(titleElement);

    // Create date text element and lock it to prevent editing
    const dateElement = createText(x + 10, y + 40, new Date(board.updatedAt).toLocaleDateString(), 14, '#666666', `card-date-${board.id}`);
    (dateElement as any).locked = true;
    elements.push(dateElement);

    return elements;
};
