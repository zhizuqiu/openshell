/**
 * Shell Tools for LangChain Agent
 * Using tool() API from langchain 1.2.10
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn, type ChildProcess } from "child_process";
import { getCommandManager } from "../session/command-manager.js";
import { createFileTools } from "./file-tools.js";
import { Question, type QuestionType } from "../question.js";

// Track running child processes for cleanup on exit
const runningProcesses = new Map<ChildProcess, ProcessInfo>();

interface ProcessInfo {
  command: string;
  startTime: number;
  abortSignal?: AbortSignal;
}

/**
 * Get all running child processes
 */
export function getRunningProcesses(): Map<ChildProcess, ProcessInfo> {
  return runningProcesses;
}

/**
 * Kill all running child processes
 */
export function killAllProcesses(): void {
  for (const [proc] of runningProcesses.entries()) {
    try {
      if (proc.pid) {
        try {
          process.kill(-proc.pid, "SIGTERM");
        } catch {
          proc.kill("SIGTERM");
        }
      } else {
        proc.kill("SIGTERM");
      }
    } catch {
      // Process already exited
    }
  }
  runningProcesses.clear();
}

/**
 * Kill processes matching the abort signal
 */
export function killProcessesBySignal(abortSignal: AbortSignal): void {
  for (const [proc, info] of runningProcesses.entries()) {
    if (info.abortSignal === abortSignal) {
      try {
        if (proc.pid) {
          try {
            process.kill(-proc.pid, "SIGTERM");
          } catch {
            proc.kill("SIGTERM");
          }
        } else {
          proc.kill("SIGTERM");
        }
      } catch {
        // Process already exited
      }
      runningProcesses.delete(proc);
    }
  }
}

/**
 * Create tools for shell operations using the tool() API
 */
export function createShellTools() {
  const commandManager = getCommandManager();

  /**
   * run_command - Execute a shell command (sync or background)
   */
  const runCommandTool = tool(
    async (input: {
      command: string;
      background?: boolean;
      description?: string;
      timeout?: number;
    }) => {
      const { command, background = false, description, timeout } = input;

      if (background) {
        // Background mode - start command and return immediately
        if (!description) {
          return "Error: 'description' is required when running in background mode.";
        }

        try {
          const result = await commandManager.startCommand(
            command,
            description,
          );
          return `Command started in background:
- Command ID: ${result.command_id}
- Status: ${result.status}
- PID: ${result.pid}

Use command_status to check progress, command_stop to stop it.`;
        } catch (error) {
          return `Failed to start background command: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      } else {
        // Synchronous mode - wait for completion
        return new Promise<string>((resolve) => {
          const child = spawn(command, [], {
            shell: true,
            stdio: ["ignore", "pipe", "pipe"],
            detached: process.platform !== "win32",
          });

          const startTime = Date.now();
          let stdout = "";
          let stderr = "";
          const isCancelled = false;
          let isTimedOut = false;
          let hasExited = false;

          const processInfo: ProcessInfo = {
            command,
            startTime,
          };
          runningProcesses.set(child, processInfo);

          // Handle timeout
          if (timeout && timeout > 0) {
            setTimeout(() => {
              if (!hasExited) {
                isTimedOut = true;
                try {
                  if (child.pid) {
                    try {
                      process.kill(-child.pid, "SIGTERM");
                    } catch {
                      child.kill("SIGTERM");
                    }
                  } else {
                    child.kill("SIGTERM");
                  }
                } catch {
                  // Process already exited
                }
              }
            }, timeout);
          }

          child.stdout.on("data", (data: Buffer) => {
            stdout += data.toString();
          });

          child.stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });

          child.on("close", (code: number | null) => {
            hasExited = true;
            runningProcesses.delete(child);

            const duration = Date.now() - startTime;
            const metadata: string[] = [];

            if (isCancelled) {
              metadata.push(`Command cancelled by user after ${duration}ms`);
            } else if (isTimedOut) {
              metadata.push(`Command timed out after ${duration}ms`);
            }

            if (code !== null && code !== 0 && !isCancelled) {
              metadata.push(`Exit code: ${code}`);
            }

            let result = stdout || "Command executed successfully (no output)";

            if (stderr && !stdout && !isCancelled) {
              result = `Error: ${stderr}`;
            }

            if (metadata.length > 0) {
              result += `\n\n<command_metadata>\n${metadata.join("\n")}\n</command_metadata>`;
            }

            resolve(result);
          });

          child.on("error", (err: Error) => {
            hasExited = true;
            runningProcesses.delete(child);
            resolve(`Error executing command: ${err.message}`);
          });
        });
      }
    },
    {
      name: "run_command",
      description:
        "Execute a shell command. Use background:true for long-running tasks (>30s). Synchronous by default.",
      schema: z.object({
        command: z.string().describe("The command to execute"),
        background: z
          .boolean()
          .optional()
          .describe(
            "Run in background (true) or wait for completion (false, default)",
          ),
        description: z
          .string()
          .optional()
          .describe(
            "Required when background:true - describes what the command does",
          ),
        timeout: z
          .number()
          .optional()
          .describe(
            "Timeout in milliseconds (only applies to synchronous mode)",
          ),
      }),
    },
  );

  /**
   * command_status - Query command status (single or list)
   */
  const commandStatusTool = tool(
    async (input: { command_id?: string; status_filter?: string }) => {
      const { command_id, status_filter } = input || {};

      if (command_id) {
        // Single command details
        const cmd = commandManager.getCommand(command_id);
        if (!cmd) {
          return `Command not found: ${command_id}`;
        }

        const output =
          commandManager.getCommandOutput(command_id) || "(no output yet)";
        const durationSec = (cmd.duration / 1000).toFixed(1);

        return `Command Details:
- ID: ${cmd.id}
- Command: ${cmd.command}
- Description: ${cmd.description}
- Status: ${cmd.status}
- Duration: ${durationSec}s
- Exit Code: ${cmd.exitCode ?? "N/A"}

Output:
${output}`;
      } else {
        // List all commands
        const commands = commandManager.listCommands(status_filter);

        if (commands.length === 0) {
          return status_filter
            ? `No commands found with status: ${status_filter}`
            : "No background commands found.";
        }

        const summary = commands
          .map(
            (c) =>
              `- ID: ${c.id} | Status: ${c.status} | Command: ${c.command} | Duration: ${(c.duration / 1000).toFixed(1)}s`,
          )
          .join("\n");

        return `Background Commands (${commands.length}):\n${summary}`;
      }
    },
    {
      name: "command_status",
      description:
        "Query command status. Provide command_id for details, omit for list of all commands.",
      schema: z.object({
        command_id: z
          .string()
          .optional()
          .describe("Command ID to query (omit to list all)"),
        status_filter: z
          .string()
          .optional()
          .describe(
            "Filter by status when listing (running/completed/failed/cancelled)",
          ),
      }),
    },
  );

  /**
   * command_stop - Stop a running command
   */
  const commandStopTool = tool(
    async ({ command_id }: { command_id: string }) => {
      const result = commandManager.stopCommand(command_id);

      if (result.status === "not_found") {
        return `Command not found or not running: ${command_id}`;
      }

      return `Command stopped: ${command_id}
Status: cancelled

The process has been terminated. Use command_cleanup to remove the record.`;
    },
    {
      name: "command_stop",
      description:
        "Stop a running background command by sending SIGTERM. The record is kept for reference.",
      schema: z.object({
        command_id: z.string().describe("The command ID to stop"),
      }),
    },
  );

  /**
   * command_cleanup - Delete command record (stops first if running)
   */
  const commandCleanupTool = tool(
    async (input: { command_id: string; stop_first?: boolean }) => {
      const { command_id, stop_first = true } = input;

      // Check if command exists and is running
      const cmd = commandManager.getCommand(command_id);
      if (!cmd) {
        return `Command not found: ${command_id}`;
      }

      // Stop first if running and stop_first is true
      if (cmd.status === "running" && stop_first) {
        commandManager.stopCommand(command_id);
      }

      // Delete the record
      const result = commandManager.deleteCommand(command_id);

      if (result.success) {
        return `Command cleaned up: ${command_id}
- Record deleted
- Process ${cmd.status === "running" ? "was stopped and " : ""}removed
- Resources freed`;
      }

      return `Failed to clean up command: ${command_id}`;
    },
    {
      name: "command_cleanup",
      description:
        "Delete a command record. Stops running commands before deletion by default.",
      schema: z.object({
        command_id: z.string().describe("The command ID to clean up"),
        stop_first: z
          .boolean()
          .optional()
          .describe("Stop running command before deletion (default: true)"),
      }),
    },
  );

  const fileTools = createFileTools();

  /**
   * ask_user - Ask the user questions for clarification
   */
  const askUserTool = tool(
    async (input: {
      questions: Array<{
        type: QuestionType;
        question: string;
        header: string;
        options?: Array<{ label: string; description: string }>;
        multiple?: boolean;
        placeholder?: string;
      }>;
    }) => {
      const { questions } = input;

      if (!questions || questions.length === 0) {
        return "Error: At least one question is required.";
      }

      const requestId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      try {
        const answers = await Question.ask({
          id: requestId,
          questions: questions.map((q) => ({
            type: q.type,
            question: q.question,
            header: q.header,
            options: q.options,
            multiple: q.multiple ?? false,
            placeholder: q.placeholder,
          })),
        });

        const formattedAnswers = questions
          .map((q, i) => {
            const answerList = answers[i] || [];
            return `"${q.question}"="${answerList.join(", ") || "(no answer)"}"`;
          })
          .join("; ");

        return `User provided answers: ${formattedAnswers}. Proceed with this context.`;
      } catch (error) {
        return `User dismissed the question without answering or an error occurred: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
    {
      name: "ask_user",
      description:
        "Ask the user questions for clarification when their request is ambiguous or more information is needed.",
      schema: z.object({
        questions: z
          .array(
            z.object({
              type: z
                .enum(["text", "choice", "yesno"])
                .describe("Question type"),
              question: z.string().describe("The actual question to ask"),
              header: z
                .string()
                .describe(
                  "Short label for this question (e.g. 'Config', 'Confirmation')"
                ),
              options: z
                .array(
                  z.object({
                    label: z.string().describe("Concise label"),
                    description: z
                      .string()
                      .describe("Detailed choice explanation"),
                  })
                )
                .optional()
                .describe("Options for 'choice' type (2-5 recommended)"),
              multiple: z
                .boolean()
                .optional()
                .describe("Allow multiple selection for choice type"),
              placeholder: z
                .string()
                .optional()
                .describe("Hint text for text type"),
            })
          )
          .min(1)
          .describe("Questions to present to the user"),
      }),
    }
  );

  return [
    runCommandTool,
    commandStatusTool,
    commandStopTool,
    commandCleanupTool,
    askUserTool,
    ...fileTools,
  ];
}
