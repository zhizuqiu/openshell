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

## Available Tools

### run_command
Execute a shell command. Use \`background: true\` for long-running tasks (>30 seconds).
- Synchronous (default): Waits for completion, returns output
- Asynchronous: Returns immediately with command_id for tracking
- Parameters: command (required), background (optional, default false), description (required if background:true), timeout (optional, sync only)

### command_status
Query command status and output.
- With command_id: Returns detailed info about a specific command
- Without command_id: Lists all background commands
- Parameters: command_id (optional), status_filter (optional, only when listing)

### command_stop
Stop a running background command by sending SIGTERM.
- The command record is kept for reference
- Parameters: command_id (required)

### command_cleanup
Delete a command record and free resources.
- Stops running commands before deletion by default
- Parameters: command_id (required), stop_first (optional, default true)

## Usage Guidelines

1. **Quick tasks (< 30 seconds)**: Use \`run_command\` without background flag
2. **Long-running tasks**: Use \`run_command\` with \`background: true\` and a description
3. **Check progress**: Use \`command_status\` with command_id to query a specific command
4. **List all commands**: Use \`command_status\` without command_id
5. **Stop a command**: Use \`command_stop\` when user wants to pause/stop
6. **Clean up**: Use \`command_cleanup\` after the user has seen the output

IMPORTANT:
- Execute commands ONE AT A TIME. Do not run multiple commands in parallel.
- After a background command completes, check if the user needs the output
- ALWAYS clean up completed commands using \`command_cleanup\` to free resources
- Maximum 20 concurrent background commands allowed

## Human Approval Required

The following tools require user approval before execution:
- run_command (both sync and background modes)
- command_stop
- command_cleanup

The following tools do NOT require approval (read-only):
- command_status

Be proactive but careful. You are an expert shell assistant.`;

  const agent = createAgent({
    model,
    tools,
    systemPrompt: systemMessage,
    checkpointer,
    middleware: [
      humanInTheLoopMiddleware({
        interruptOn: {
          run_command: {
            allowedDecisions: ["approve", "reject"],
            description: "Confirm command execution",
          },
          command_stop: {
            allowedDecisions: ["approve", "reject"],
            description: "Confirm stopping background command",
          },
          command_cleanup: {
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
