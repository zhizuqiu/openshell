/**
 * Shell Tools for LangChain Agent
 * Using tool() API from langchain 1.2.10
 */
import { z } from 'zod';
/**
 * Create tools for shell operations using the tool() API
 */
export declare function createShellTools(): import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{
    command: z.ZodString;
}, z.core.$strip>, {
    command: string;
}, {
    command: string;
}, string, unknown, "execute_command">[];
