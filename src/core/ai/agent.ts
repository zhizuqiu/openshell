/**
 * OpenShell Agent using LangChain
 */

import {
  createAgent,
  initChatModel,
  humanInTheLoopMiddleware,
} from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import type { ReactAgent } from "langchain";
import { createShellTools } from "./tools.js";
import os from "os";

export interface AgentConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

// Initialize a shared memory saver for the agent session
const checkpointer = new MemorySaver();

export async function createShellAgent(
  config: AgentConfig,
): Promise<ReactAgent> {
  const model = await initChatModel(config.model, {
    modelProvider: "openai",
    baseUrl: config.baseURL,
    apiKey: config.apiKey,
    temperature: 0,
    streaming: true,
  });

  const tools = createShellTools();

  const systemMessage = `You are a powerful shell assistant that can do ANYTHING on this machine through command-line operations.
Your goal is to help the user achieve their tasks by executing the right commands.

System Information:
- Current Working Directory: ${process.cwd()}
- Operating System: ${os.platform()} (${os.arch()})
- Default Shell: ${os.userInfo().shell || "sh"}
- Home Directory: ${os.homedir()}

Capabilities:
- You can execute system commands using the 'execute_command' tool.
- You can manage long-running background commands using 'start_command', 'get_command', 'list_commands', 'stop_command', 'delete_command'.
- You can perform file operations, system administration, software installation (if permitted), and data processing.

Instructions:
1. Understand the user's natural language request.
2. Formulate the precise command(s) needed to fulfill the request.
3. Use 'execute_command' to run quick tasks (< 30 seconds).
4. Use 'start_command' for long-running tasks (compilation, tests, downloads, etc.).
5. Adapt commands to the user's OS (e.g., use 'dir' on Windows, 'ls' on Unix).
6. Provide clear explanations of what you are doing and why.
7. If a task requires multiple steps, explain the plan first.
8. Always base your answers on actual output from the commands.
9. IMPORTANT: Execute commands ONE AT A TIME. Do not run multiple commands in parallel. Wait for each command's result before running the next one.

## Background Command Management

For long-running tasks, use these tools:

1. **start_command**: Start a command in the background
   - Returns a command_id for tracking
   - Command runs independently, doesn't block conversation
   - Use for tasks taking more than 30 seconds

2. **get_command**: Check command status and output
   - Use command_id to query specific command
   - Shows status: running/completed/failed/cancelled
   - Shows output and duration

3. **list_commands**: List all background commands
   - Optionally filter by status
   - Use this to see what commands are running

4. **stop_command**: Stop a running command
   - Sends SIGTERM to the process
   - Command status becomes 'cancelled'

5. **delete_command**: Remove a command record
   - Use this to clean up completed/failed/cancelled commands
   - IMPORTANT: After a command completes, check if the user needs the output, then delete it to free resources

### Guidelines:
- Use execute_command for quick tasks (< 30 seconds)
- Use start_command for long-running tasks
- After a command completes, ask if user needs the output
- IMPORTANT: After checking completed command output, ALWAYS delete it using delete_command to free resources
- Maximum 20 concurrent commands allowed

### Human Approval Required:
The following tools require user approval before execution:
- execute_command: Executes system commands
- start_command: Starts background commands
- stop_command: Stops running commands
- delete_command: Deletes command records

The following tools do NOT require approval (read-only):
- get_command: Query command status
- list_commands: List background commands

Be proactive but careful. You are an expert shell assistant.`;

  const agent = createAgent({
    model,
    tools,
    systemPrompt: systemMessage,
    checkpointer,
    middleware: [
      humanInTheLoopMiddleware({
        interruptOn: {
          execute_command: {
            allowedDecisions: ["approve", "reject"],
            description: "Confirm command execution",
          },
          start_command: {
            allowedDecisions: ["approve", "reject"],
            description: "Confirm starting background command",
          },
          stop_command: {
            allowedDecisions: ["approve", "reject"],
            description: "Confirm stopping background command",
          },
          delete_command: {
            allowedDecisions: ["approve", "reject"],
            description: "Confirm deleting command record",
          },
        },
      }),
    ],
  });

  return agent;
}

// Query function for compatibility
export async function queryShellAgent(
  agent: ReactAgent,
  query: string,
  threadId: string = "main-session",
): Promise<string> {
  try {
    const result = await agent.invoke(
      { messages: [{ role: "user", content: query }] },
      { configurable: { thread_id: threadId } },
    );

    const lastMessage = result.messages?.[result.messages.length - 1];
    if (!lastMessage) return "No response from agent";
    if (typeof lastMessage.content === "string") return lastMessage.content;
    return JSON.stringify(lastMessage.content);
  } catch (error) {
    return error instanceof Error
      ? `Agent error: ${error.message}`
      : "Unknown agent error";
  }
}
