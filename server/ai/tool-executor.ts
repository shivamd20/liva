import { ExcalidrawElement, OperationLogSchema, ConstraintsSchema } from "./schemas";
import { TOOLS } from "./tools";
import { z } from "zod";

type OperationLog = z.infer<typeof OperationLogSchema>;
type Constraints = z.infer<typeof ConstraintsSchema>;

export class ToolExecutor {
    private elements: ExcalidrawElement[];
    private constraints: Constraints;
    private logs: OperationLog[] = [];

    constructor(elements: ExcalidrawElement[], constraints?: Constraints) {
        this.elements = [...elements]; // Work on a copy
        this.constraints = constraints || {
            allowDelete: false,
            allowNewElements: true,
            maxNewElements: 5,
        };
    }

    public execute(toolName: string, args: any): void {
        const tool = TOOLS[toolName];
        if (!tool) {
            this.logs.push({
                tool: toolName,
                args,
                status: "error",
                reason: `Tool '${toolName}' not found`,
            });
            return;
        }

        try {
            // 1. Validate arguments
            const validatedArgs = tool.parameters.parse(args);

            // 2. Pre-execution checks (e.g. element existence)
            // This is partly handled by the tool logic itself, but we can add generic checks here if needed.
            // For example, checking if target IDs exist in the current elements list.
            if (validatedArgs.id) {
                const exists = this.elements.some(e => e.id === validatedArgs.id && !e.isDeleted);
                if (!exists) {
                    throw new Error(`Element with ID ${validatedArgs.id} not found`);
                }
            }
            if (validatedArgs.ids) {
                const missing = validatedArgs.ids.filter((id: string) => !this.elements.some(e => e.id === id && !e.isDeleted));
                if (missing.length > 0) {
                    throw new Error(`Elements with IDs ${missing.join(", ")} not found`);
                }
            }

            // 3. Execute tool
            const updatedElements = tool.execute(this.elements, validatedArgs, this.constraints);

            // 4. Post-execution validation (integrity check)
            // Ensure no IDs were lost or corrupted
            if (updatedElements.length < this.elements.filter(e => !e.isDeleted).length && !this.constraints.allowDelete) {
                throw new Error("Elements were deleted but allowDelete is false");
            }

            this.elements = updatedElements;

            this.logs.push({
                tool: toolName,
                args: validatedArgs,
                status: "applied",
            });

        } catch (error: any) {
            this.logs.push({
                tool: toolName,
                args,
                status: "rejected",
                reason: error.message || "Unknown error",
            });
            // We do NOT update this.elements if there was an error (transactional per tool call)
        }
    }

    public getResult() {
        return {
            elements: this.elements,
            logs: this.logs,
        };
    }
}
