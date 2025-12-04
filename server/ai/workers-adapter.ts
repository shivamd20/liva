import { AITransformQuery, AIResponse } from "./schemas";
import { ToolExecutor } from "./tool-executor";
import { TOOLS } from "./tools";
import { z } from "zod";

// Helper to convert Zod schema to JSON Schema for AI tools
function zodToJsonSchema(schema: z.ZodType<any>): any {
    if (schema instanceof z.ZodObject) {
        const properties: Record<string, any> = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(schema.shape)) {
            properties[key] = zodToJsonSchema(value as z.ZodType<any>);
            if (!value.isOptional()) {
                required.push(key);
            }
        }

        return {
            type: "object",
            properties,
            required: required.length > 0 ? required : undefined,
        };
    }

    if (schema instanceof z.ZodString) return { type: "string" };
    if (schema instanceof z.ZodNumber) return { type: "number" };
    if (schema instanceof z.ZodBoolean) return { type: "boolean" };
    if (schema instanceof z.ZodArray) {
        return {
            type: "array",
            items: zodToJsonSchema(schema.element),
        };
    }
    if (schema instanceof z.ZodEnum) {
        return {
            type: "string",
            enum: schema.options,
        };
    }

    return { type: "string" }; // Fallback
}

export async function runAI(
    env: any,
    query: AITransformQuery
): Promise<AIResponse> {
    const executor = new ToolExecutor(query.elements, query.constraints);
    const startTime = Date.now();

    // 1. Select Model
    // Map internal model IDs to Gemini models
    let model = "gemini-2.0-flash";
    if (query.modelOverride?.includes("pro")) {
        model = "gemini-2.0-pro-exp-02-05";
    }

    // 2. Define Tools for Gemini
    const tools = Object.values(TOOLS).map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters as any),
    }));

    // 3. System Prompt
    const systemPrompt = `You are an expert Excalidraw assistant. 
  Your task is to modify the given board elements based on the user's query.
  You have access to tools to move, resize, style, create, delete, and group elements.
  
  Current Board Stats:
  - Total Elements: ${query.elements.length}
  - Element IDs: ${query.elements.map(e => e.id).join(", ")}
  
  User Query: "${query.query}"
  
  Constraints:
  - Allow Delete: ${query.constraints?.allowDelete ?? false}
  - Allow New Elements: ${query.constraints?.allowNewElements ?? true}
  
  Instructions:
  - Use the provided tools to satisfy the user's request.
  - If the request is impossible or unsafe, explain why.
  - Do not hallucinate element IDs. Use the IDs provided in the context.
  - Be efficient.
  `;

    try {
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not configured");
        }

        // 4. Call Gemini API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const payload = {
            system_instruction: {
                parts: [{ text: systemPrompt }]
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: query.query }]
                }
            ],
            tools: [
                {
                    function_declarations: tools
                }
            ],
            tool_config: {
                function_calling_config: {
                    mode: "AUTO"
                }
            }
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
        }

        const data: any = await response.json();

        // 5. Execute Tools
        const candidates = data.candidates || [];
        const content = candidates[0]?.content;
        const parts = content?.parts || [];

        let reasoning = "";

        for (const part of parts) {
            if (part.text) {
                reasoning += part.text + "\n";
            }

            if (part.functionCall) {
                const call = part.functionCall;
                // Gemini returns args as a simple object, which matches what we expect
                executor.execute(call.name, call.args);
            }
        }

        const result = executor.getResult();

        return {
            success: true,
            updatedElements: result.elements,
            metadata: {
                appliedCount: result.logs.filter(l => l.status === "applied").length,
                rejectedCount: result.logs.filter(l => l.status === "rejected").length,
                errorCount: result.logs.filter(l => l.status === "error").length,
                executionTimeMs: Date.now() - startTime,
                model,
                tokensUsed: data.usageMetadata?.totalTokenCount,
            },
            operations: result.logs,
            reasoning: reasoning.trim(),
        };

    } catch (error: any) {
        console.error("AI Execution Error:", error);
        return {
            success: false,
            updatedElements: query.elements, // Return original
            metadata: {
                appliedCount: 0,
                rejectedCount: 0,
                errorCount: 1,
                executionTimeMs: Date.now() - startTime,
                model,
            },
            operations: [],
            fallback: `AI processing failed: ${error.message}`,
        };
    }
}
