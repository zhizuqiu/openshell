/**
 * OpenShell Agent using LangChain
 */

import {
  createAgent,
  initChatModel,
  humanInTheLoopMiddleware,
} from "langchain";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import type { ReactAgent } from "langchain";
import { createShellTools } from "./tools.js";
import os from "os";
import path from "path";
import fs from "fs/promises";

export interface AgentConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

// Global checkpointer instance
let checkpointer: SqliteSaver | null = null;

/**
 * Initialize the SQLite checkpointer
 */
async function getCheckpointer() {
  if (checkpointer) return checkpointer;

  const envPath = process.env["OPENSHELL_DB_PATH"];
  let dbPath: string;

  if (envPath) {
    dbPath = envPath;
  } else {
    const dbDir = path.join(os.homedir(), ".openshell");
    await fs.mkdir(dbDir, { recursive: true });
    dbPath = path.join(dbDir, "openshell.db");
  }

  // Use fromConnString for more robust internal setup
  checkpointer = SqliteSaver.fromConnString(dbPath);
  return checkpointer;
}

import Database from "better-sqlite3";

export async function listAllSessions(): Promise<
  { thread_id: string; updated_at: string }[]
> {
  const envPath = process.env["OPENSHELL_DB_PATH"];
  const dbPath =
    envPath || path.join(os.homedir(), ".openshell", "openshell.db");

  try {
    const db = new Database(dbPath);
    // 强制使用 better-sqlite3 执行同步查询
    const rows = db
      .prepare(
        `
      SELECT thread_id, checkpoint_id 
      FROM checkpoints 
      GROUP BY thread_id 
      ORDER BY checkpoint_id DESC 
      LIMIT 20
    `,
      )
      .all() as any[];

    db.close();

    return rows.map((r) => ({
      thread_id: r.thread_id,
      updated_at: new Date().toISOString(), // 暂时用当前时间，因为 metadata 是加密/序列化的
    }));
  } catch (err) {
    return [];
  }
}

export async function deleteSession(threadId: string): Promise<boolean> {
  const envPath = process.env["OPENSHELL_DB_PATH"];
  const dbPath =
    envPath || path.join(os.homedir(), ".openshell", "openshell.db");

  try {
    const db = new Database(dbPath);
    db.prepare("DELETE FROM checkpoints WHERE thread_id = ?").run(threadId);
    db.prepare("DELETE FROM writes WHERE thread_id = ?").run(threadId);
    db.close();
    return true;
  } catch (err) {
    return false;
  }
}

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
  const currentCheckpointer = await getCheckpointer();

  const systemMessage = `## Guidelines

## Approval Required

Tools requiring approval: run_command, command_stop, command_cleanup, write_file, edit_file
Read-only (no approval): command_status, read_file

**Important:** When multiple tools require approval, call them ONE AT A TIME.
Wait for each tool to complete before calling the next one.

## Human Feedback Handling

- If user rejects a tool call, DO NOT retry the same action
- Accept the rejection and propose alternative approaches
- Ask user for clarification if the request is ambiguous
- Never argue with or challenge user decisions

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
- Avoid redundancy: Don't repeat command output in your response

## System Information

- Current Working Directory: ${process.cwd()}
- Operating System: ${os.platform()} (${os.arch()})
- Default Shell: ${os.userInfo().shell || "sh"}
- Home Directory: ${os.homedir()}

## File Operation Priority

Always prefer operating on files within the Current Working Directory (${process.cwd()}).
When the user request is ambiguous about file paths, assume they mean files relative to this directory.
Only access files outside this directory when explicitly requested.`;

  const agent = createAgent({
    model,
    tools,
    systemPrompt: systemMessage,
    checkpointer: currentCheckpointer,
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
