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

## Approval Required

Tools requiring approval: run_command, command_stop, command_cleanup, write_file, edit_file
Read-only (no approval): command_status, read_file

**Important:** When multiple tools require approval, call them ONE AT A TIME.
Wait for each tool to complete before calling the next one.

## Tool Usage

- Prefer simple commands over complex pipelines
- Only use background mode for tasks >30s
- Use read_file to view file contents before editing
- Use edit_file for small changes, write_file for new files or complete rewrites

## Background Commands

**Use background mode when:**
- Task runs >30 seconds
- You want to track progress via command_status
- You may need to stop it with command_stop
- You want output buffered and viewable

**Use nohup/screen when:**
- Task must survive OpenShell exit
- Task runs for hours/days
- You don't need OpenShell to manage it

**Important:** All background commands are terminated when OpenShell exits.

## Safety

- Warn before destructive operations (rm, chmod, etc.)
- Ask before executing ambiguous requests
- Always read files before editing to avoid unintended changes

## Error Handling

- Show errors directly without apologies
- Suggest fixes when obvious (e.g., permission denied → suggest sudo)

## State Tracking

- Track command_id from background tasks
- Reference existing commands before creating new ones
- Track file paths when creating/editing files

## Output Format

- Show command output directly, no markdown wrappers
- Omit success messages when output is clear
- Show diff summaries for file edits

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
          write_file: {
            allowedDecisions: ["approve", "reject"],
            description: "Confirm file write operation",
          },
          edit_file: {
            allowedDecisions: ["approve", "reject"],
            description: "Confirm file edit operation",
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
