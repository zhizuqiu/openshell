/**
 * Shell Tools for LangChain Agent
 * Using tool() API from langchain 1.2.10
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn, type ChildProcess } from "child_process";
import { getCommandManager } from "../session/command-manager.js";
import { createFileTools } from "./file-tools.js";
import { Question } from "../question.js";

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
 * Helper to create standard structured tool response
 */
function createResult(status: "success" | "error" | "canceled", output: string) {
  return JSON.stringify({ status, output });
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
        if (!description) {
          return createResult("error", "Error: 'description' is required when running in background mode.");
        }

        try {
          const result = await commandManager.startCommand(command, description);
          return createResult("success", `Command started in background:
- Command ID: ${result.command_id}
- Status: ${result.status}
- PID: ${result.pid}

Use command_status to check progress, command_stop to stop it.`);
        } catch (error) {
          return createResult("error", `Failed to start background command: ${error instanceof Error ? error.message : "Unknown error"}`);
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
          let isTimedOut = false;
          let hasExited = false;

          const processInfo: ProcessInfo = { command, startTime };
          runningProcesses.set(child, processInfo);

          if (timeout && timeout > 0) {
            setTimeout(() => {
              if (!hasExited) {
                isTimedOut = true;
                try {
                  if (child.pid) process.kill(-child.pid, "SIGTERM");
                  else child.kill("SIGTERM");
                } catch {}
              }
            }, timeout);
          }

          child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
          child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

          child.on("close", (code: number | null) => {
            hasExited = true;
            runningProcesses.delete(child);
            const duration = Date.now() - startTime;

            if (isTimedOut) {
              return resolve(createResult("error", `Command timed out after ${duration}ms. Output so far:\n${stdout}\n${stderr}`));
            }

            if (code !== 0) {
              return resolve(createResult("error", `Command failed with exit code ${code}.\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`));
            }

            resolve(createResult("success", stdout || "Command executed successfully (no output)"));
          });

          child.on("error", (err: Error) => {
            hasExited = true;
            runningProcesses.delete(child);
            resolve(createResult("error", `Error executing command: ${err.message}`));
          });
        });
      }
    },
    {
      name: "run_command",
      description: "Execute a shell command. Use background:true for long-running tasks (>30s).",
      schema: z.object({
        command: z.string().describe("The command to execute"),
        background: z.boolean().optional().describe("Run in background"),
        description: z.string().optional().describe("Required for background mode"),
        timeout: z.number().optional().describe("Timeout in ms"),
      }),
    },
  );

  /**
   * command_status - Query command status
   */
  const commandStatusTool = tool(
    async (input: { command_id?: string; status_filter?: string }) => {
      const { command_id, status_filter } = input || {};

      if (command_id) {
        const cmd = commandManager.getCommand(command_id);
        if (!cmd) return createResult("error", `Command not found: ${command_id}`);

        const output = commandManager.getCommandOutput(command_id) || "(no output yet)";
        return createResult("success", `Command Details:
- ID: ${cmd.id}
- Status: ${cmd.status}
- Output:
${output}`);
      } else {
        const commands = commandManager.listCommands(status_filter);
        if (commands.length === 0) return createResult("success", "No background commands found.");
        const summary = commands.map(c => `- ID: ${c.id} | Status: ${c.status} | Command: ${c.command}`).join("\n");
        return createResult("success", `Background Commands (${commands.length}):\n${summary}`);
      }
    },
    {
      name: "command_status",
      description: "Query background command status.",
      schema: z.object({
        command_id: z.string().optional(),
        status_filter: z.string().optional(),
      }),
    }
  );

  /**
   * command_stop - Stop a running command
   */
  const commandStopTool = tool(
    async ({ command_id }: { command_id: string }) => {
      const result = commandManager.stopCommand(command_id);
      if (result.status === "not_found") return createResult("error", `Command not found: ${command_id}`);
      return createResult("success", `Command stopped: ${command_id}`);
    },
    {
      name: "command_stop",
      description: "Stop a background command.",
      schema: z.object({ command_id: z.string() }),
    }
  );

  /**
   * command_cleanup - Delete command record
   */
  const commandCleanupTool = tool(
    async (input: { command_id: string; stop_first?: boolean }) => {
      const { command_id, stop_first = true } = input;
      const cmd = commandManager.getCommand(command_id);
      if (!cmd) return createResult("error", `Command not found: ${command_id}`);
      if (cmd.status === "running" && stop_first) commandManager.stopCommand(command_id);
      const result = commandManager.deleteCommand(command_id);
      return result.success ? createResult("success", `Cleaned up: ${command_id}`) : createResult("error", `Failed: ${command_id}`);
    },
    {
      name: "command_cleanup",
      description: "Delete command record.",
      schema: z.object({ command_id: z.string(), stop_first: z.boolean().optional() }),
    }
  );

  /**
   * ask_user - Ask user questions for clarification
   */
  const askUserTool = tool(
    async (input: {
      questions: Array<{
        type: "text" | "choice" | "yesno";
        question: string;
        header: string;
        options?: Array<{ label: string; description: string }>;
        multiple?: boolean;
        placeholder?: string;
      }>;
    }) => {
      const { questions } = input;
      if (!questions || questions.length === 0) {
        return createResult("error", "At least one question required.");
      }

      const requestId = `q_${Date.now()}`;
      try {
        const answers = await Question.ask({ id: requestId, questions });
        return createResult("success", `Answers: ${JSON.stringify(answers)}`);
      } catch (error) {
        return createResult("canceled", "User dismissed the question.");
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
              type: z.enum(["text", "choice", "yesno"]).describe("Question type"),
              question: z.string().describe("The actual question to ask"),
              header: z.string().describe("Short label for this question"),
              options: z
                .array(
                  z.object({
                    label: z.string().describe("Concise label"),
                    description: z.string().describe("Detailed choice explanation"),
                  })
                )
                .optional()
                .describe("Options for 'choice' type"),
              multiple: z.boolean().optional().describe("Allow multiple selection"),
              placeholder: z.string().optional().describe("Hint for text type"),
            })
          )
          .min(1)
          .describe("Questions to present to the user"),
      }),
    }
  );

  const fileTools = createFileTools();

  return [runCommandTool, commandStatusTool, commandStopTool, commandCleanupTool, askUserTool, ...fileTools];
}
