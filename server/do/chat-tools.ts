import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';
// import { ExcalidrawElement } from '../ai/schemas';

// Schemas
// Schemas (Plain JSON Schema to avoid Zod ~standard issues with Gemini)
const readBoardInput = {
    type: "object",
    properties: {},
};

const generateVisualizationInput = {
    type: "object",
    properties: {
        mermaid: { type: "string", description: "Mermaid JS diagram code" },
        title: { type: "string", description: "Title of the visualization" },
    },
    required: ["mermaid"],
};

// Definitions
export const readBoardDef = toolDefinition({
    name: 'read_board',
    description: 'Get the current visible board state as an image. Call this to see what is on the board.',
    inputSchema: readBoardInput,
    outputSchema: z.object({
        image: z.string().describe("Base64 encoded image of the board"),
    }),
});

export const generateVisualizationDef = toolDefinition({
    name: 'generateVisualization',
    description: 'Generate an inline visualization/diagram using Mermaid.js. Call this when you want to show a diagram to the user.',
    inputSchema: generateVisualizationInput,
    outputSchema: z.object({
        visualizationId: z.string(),
        success: z.boolean(),
    }),
});

// Factory
export const createTools = (
    env: Env,
    boardId: string,
    persistVisualization: (mermaid: string, title?: string) => Promise<{ id: string }>
) => {
    return [
        // For read_board, we only pass the DEFINITION to the server side (LLM).
        // The implementation is on the client.
        readBoardDef,

        // Visualization is now client-side only (definition passed, execution on client)
        generateVisualizationDef,
    ];
};
