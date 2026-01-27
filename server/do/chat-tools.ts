import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';
// import { ExcalidrawElement } from '../ai/schemas';

// Schemas
// Schemas (Plain JSON Schema to avoid Zod ~standard issues with Gemini)
const readBoardInput = {
    type: "object",
    properties: {},
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
    ];
};
