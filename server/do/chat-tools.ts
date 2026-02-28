import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

export const readBoardDef = toolDefinition({
    name: 'read_board',
    description: 'Capture the current whiteboard as a screenshot. Returns a base64 PNG image. Use this to see what the user has drawn, written, or arranged on their board before commenting on it.',
    inputSchema: {
        type: "object",
        properties: {},
    },
    outputSchema: z.object({
        image: z.string().describe("Base64 data URL of the board screenshot"),
    }),
});

export const addStickyNoteDef = toolDefinition({
    name: 'add_sticky_note',
    description: 'Place a sticky note on the whiteboard. The note appears as a colored rectangle with text in the center of the current viewport. Use for capturing ideas, action items, summaries, or any text the user wants on the board.',
    inputSchema: {
        type: "object",
        properties: {
            text: {
                type: "string",
                description: "The text to write on the sticky note. Keep it concise — 1-3 short lines work best.",
            },
            color: {
                type: "string",
                enum: ["yellow", "blue", "green", "pink", "orange"],
                description: "Background color. Defaults to yellow. Use blue for questions/ideas, green for decisions/done items, pink for important/urgent, orange for warnings/blockers.",
            },
        },
        required: ["text"],
    },
    outputSchema: z.object({
        id: z.string().describe("ID of the created sticky note element"),
    }),
});

export const highlightAreaDef = toolDefinition({
    name: 'highlight_area',
    description: 'Temporarily highlight a region of the board to draw the user\'s attention. Creates a pulsing outline that disappears after a few seconds. Use when referencing a specific part of the board during conversation.',
    inputSchema: {
        type: "object",
        properties: {
            description: {
                type: "string",
                description: "Which area to highlight, e.g. 'the flowchart in the center' or 'top-right sticky notes'. Used to find the relevant region.",
            },
        },
        required: ["description"],
    },
    outputSchema: z.object({
        success: z.boolean(),
    }),
});

export const createTools = (
    env: Env,
    boardId: string,
    persistVisualization: (mermaid: string, title?: string) => Promise<{ id: string }>
) => {
    return [readBoardDef, addStickyNoteDef, highlightAreaDef];
};
