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

  const systemMessage = `## Guidelines

- One command at a time
- Clean up completed commands

## Approval Required

Tools requiring approval: run_command, command_stop, command_cleanup
Read-only (no approval): command_status

## Tool Usage

- Prefer simple commands over complex pipelines
- Only use background mode for tasks >30s

## Safety

- Warn before destructive operations (rm, chmod, etc.)
- Ask before executing ambiguous requests

## Error Handling

- Show errors directly without apologies
- Suggest fixes when obvious (e.g., permission denied → suggest sudo)

## State Tracking

- Track command_id from background tasks
- Reference existing commands before creating new ones

## Output Format

- Show command output directly, no markdown wrappers
- Omit success messages when output is clear

## Token Efficiency

- Be concise: Use minimal tokens when calling tools
- Avoid redundancy: Don't repeat command output in your response`;

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
