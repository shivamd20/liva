import { z } from "zod";
import {
    ExcalidrawElement,
    MoveElementSchema,
    ResizeElementSchema,
    UpdateElementStyleSchema,
    UpdateTextSchema,
    CreateElementsSchema,
    DeleteElementsSchema,
    GroupElementsSchema,
} from "./schemas";

export type ToolImplementation<T = any> = (
    elements: ExcalidrawElement[],
    args: T,
    constraints?: {
        allowDelete?: boolean;
        allowNewElements?: boolean;
        maxNewElements?: number;
    }
) => ExcalidrawElement[];

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: z.ZodType<any>;
    execute: ToolImplementation;
}

export const moveElement: ToolDefinition = {
    name: "moveElement",
    description: "Move an element by dx, dy",
    parameters: MoveElementSchema,
    execute: (elements, args) => {
        return elements.map((el) => {
            if (el.id === args.id) {
                return {
                    ...el,
                    x: el.x + args.dx,
                    y: el.y + args.dy,
                    version: (el.version || 0) + 1,
                    versionNonce: Date.now(),
                };
            }
            return el;
        });
    },
};

export const resizeElement: ToolDefinition = {
    name: "resizeElement",
    description: "Resize an element to width, height",
    parameters: ResizeElementSchema,
    execute: (elements, args) => {
        return elements.map((el) => {
            if (el.id === args.id) {
                return {
                    ...el,
                    width: args.width,
                    height: args.height,
                    version: (el.version || 0) + 1,
                    versionNonce: Date.now(),
                };
            }
            return el;
        });
    },
};

export const updateElementStyle: ToolDefinition = {
    name: "updateElementStyle",
    description: "Update element style properties",
    parameters: UpdateElementStyleSchema,
    execute: (elements, args) => {
        return elements.map((el) => {
            if (el.id === args.id) {
                return {
                    ...el,
                    strokeColor: args.strokeColor ?? el.strokeColor,
                    backgroundColor: args.backgroundColor ?? el.backgroundColor,
                    fillStyle: args.fillStyle ?? el.fillStyle,
                    strokeWidth: args.strokeWidth ?? el.strokeWidth,
                    version: (el.version || 0) + 1,
                    versionNonce: Date.now(),
                };
            }
            return el;
        });
    },
};

export const updateText: ToolDefinition = {
    name: "updateText",
    description: "Update text content and font size",
    parameters: UpdateTextSchema,
    execute: (elements, args) => {
        return elements.map((el) => {
            if (el.id === args.id && el.type === "text") {
                return {
                    ...el,
                    text: args.text,
                    fontSize: args.fontSize ?? el.fontSize,
                    version: (el.version || 0) + 1,
                    versionNonce: Date.now(),
                };
            }
            return el;
        });
    },
};

export const createElements: ToolDefinition = {
    name: "createElements",
    description: "Create new elements",
    parameters: CreateElementsSchema,
    execute: (elements, args, constraints) => {
        if (constraints?.allowNewElements === false) {
            throw new Error("Creating new elements is not allowed");
        }

        const currentNewCount = elements.filter(e => e.customData?.isNew).length;
        if (constraints?.maxNewElements && (currentNewCount + args.elements.length > constraints.maxNewElements)) {
            throw new Error(`Exceeded max new elements limit (${constraints.maxNewElements})`);
        }

        const newElements: ExcalidrawElement[] = args.elements.map((e: any) => ({
            id: crypto.randomUUID(),
            type: e.type,
            x: e.x,
            y: e.y,
            width: e.width || 100,
            height: e.height || 100,
            angle: 0,
            strokeColor: e.strokeColor || "#000000",
            backgroundColor: e.backgroundColor || "transparent",
            fillStyle: "hachure",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 1,
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: null,
            seed: Math.floor(Math.random() * 100000),
            version: 1,
            versionNonce: Date.now(),
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            text: e.text || "",
            fontSize: 20,
            fontFamily: 1,
            textAlign: "left",
            verticalAlign: "top",
            baseline: 18,
            customData: { isNew: true }
        }));

        return [...elements, ...newElements];
    },
};

export const deleteElements: ToolDefinition = {
    name: "deleteElements",
    description: "Delete elements",
    parameters: DeleteElementsSchema,
    execute: (elements, args, constraints) => {
        if (constraints?.allowDelete === false) {
            throw new Error("Deleting elements is not allowed");
        }

        const idsToDelete = new Set(args.ids);
        return elements.map(el => {
            if (idsToDelete.has(el.id)) {
                return {
                    ...el,
                    isDeleted: true,
                    version: (el.version || 0) + 1,
                    versionNonce: Date.now(),
                };
            }
            return el;
        });
    },
};

export const groupElements: ToolDefinition = {
    name: "groupElements",
    description: "Group multiple elements",
    parameters: GroupElementsSchema,
    execute: (elements, args) => {
        const groupId = crypto.randomUUID();
        const idsToGroup = new Set(args.ids);

        return elements.map(el => {
            if (idsToGroup.has(el.id)) {
                return {
                    ...el,
                    groupIds: [...(el.groupIds || []), groupId],
                    version: (el.version || 0) + 1,
                    versionNonce: Date.now(),
                };
            }
            return el;
        });
    },
};

export const TOOLS: Record<string, ToolDefinition> = {
    moveElement,
    resizeElement,
    updateElementStyle,
    updateText,
    createElements,
    deleteElements,
    groupElements,
};
