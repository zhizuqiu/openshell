/**
 * Shell Tools for LangChain Agent
 * Using tool() API from langchain 1.2.10
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn, type ChildProcess } from "child_process";
import { getCommandManager } from "../session/command-manager.js";

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
      // Kill the entire process group (negative PID on Unix)
      if (proc.pid) {
        try {
          process.kill(-proc.pid, "SIGTERM");
        } catch {
          // Fallback to killing just the process
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

  const bashTool = tool(
    async (input: { command: string; abortSignal?: AbortSignal }) => {
      const { command, abortSignal } = input;

      return new Promise<string>((resolve, reject) => {
        const child = spawn(command, [], {
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
          detached: process.platform !== "win32", // Create new process group on Unix
        });

        const processInfo: ProcessInfo = {
          command,
          startTime: Date.now(),
          abortSignal,
        };
        runningProcesses.set(child, processInfo);

        let stdout = "";
        let stderr = "";
        let isCancelled = false;
        let isTimedOut = false;
        let hasExited = false;

        // Handle abort signal
        const abortHandler = () => {
          isCancelled = true;
          if (!hasExited) {
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
        };

        if (abortSignal) {
          if (abortSignal.aborted) {
            abortHandler();
          } else {
            abortSignal.addEventListener("abort", abortHandler, { once: true });
          }
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

          // Build result metadata
          const metadata: string[] = [];
          const duration = Date.now() - processInfo.startTime;

          if (isCancelled) {
            metadata.push(`Command cancelled by user after ${duration}ms`);
          } else if (isTimedOut) {
            metadata.push(`Command timed out after ${duration}ms`);
          }

          if (code !== null && code !== 0 && !isCancelled) {
            metadata.push(`Exit code: ${code}`);
          }

          // Format output
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

        // Optional timeout handling (can be added via input)
        if ((input as any).timeout && (input as any).timeout > 0) {
          setTimeout(
            () => {
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
            },
            (input as any).timeout,
          );
        }
      });
    },
    {
      name: "execute_command",
      description:
        "Execute a system command on the local machine. Works across platforms (bash/zsh on Unix, PowerShell/cmd on Windows). Use for file operations, running scripts, or any system commands.",
      schema: z.object({
        command: z
          .string()
          .describe(
            'The command to execute (e.g., "ls -la", "dir", "cat file.txt")',
          ),
      }),
    },
  );

  const startCommandTool = tool(
    async ({
      command,
      description,
    }: {
      command: string;
      description: string;
    }) => {
      try {
        const result = await commandManager.startCommand(command, description);
        return `Background command started:
- Command ID: ${result.command_id}
- Status: ${result.status}
- PID: ${result.pid}

Use get_command to check progress, stop_command to stop it.`;
      } catch (error) {
        return `Failed to start command: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
    {
      name: "start_command",
      description:
        "Start a long-running command in the background. Use this for tasks that take more than a few seconds. The command runs independently and doesn't block the conversation.",
      schema: z.object({
        command: z.string().describe("The command to execute"),
        description: z
          .string()
          .describe("Brief description of what this command does"),
      }),
    },
  );

  const getCommandTool = tool(
    async ({ command_id }: { command_id: string }) => {
      const cmd = commandManager.getCommand(command_id);
      if (!cmd) {
        return `Command not found: ${command_id}`;
      }

      const output =
        commandManager.getCommandOutput(command_id) || "(no output yet)";
      const durationSec = (cmd.duration / 1000).toFixed(1);

      return `Command: ${cmd.command}
Description: ${cmd.description}
Status: ${cmd.status}
Duration: ${durationSec}s
Exit Code: ${cmd.exitCode ?? "N/A"}

Output:
${output}`;
    },
    {
      name: "get_command",
      description:
        "Get the status and output of a background command. Use the command_id returned by start_command.",
      schema: z.object({
        command_id: z
          .string()
          .describe("The command ID returned by start_command"),
      }),
    },
  );

  const listCommandsTool = tool(
    async ({ status }: { status?: string } = {}) => {
      const commands = commandManager.listCommands(status);

      if (commands.length === 0) {
        return status
          ? `No commands found with status: ${status}`
          : "No background commands found.";
      }

      const summary = commands
        .map(
          (c) =>
            `- ID: ${c.id} | Status: ${c.status} | Command: ${c.command} | Duration: ${(c.duration / 1000).toFixed(1)}s`,
        )
        .join("\n");

      return `Background commands (${commands.length}):\n${summary}`;
    },
    {
      name: "list_commands",
      description:
        "List all background commands. Optionally filter by status (running, completed, failed, cancelled).",
      schema: z.object({
        status: z.string().optional().describe("Filter by status (optional)"),
      }),
    },
  );

  const stopCommandTool = tool(
    async ({ command_id }: { command_id: string }) => {
      const result = commandManager.stopCommand(command_id);

      if (result.status === "not_found") {
        return `Command not found or not running: ${command_id}`;
      }

      return `Command stopped: ${command_id}
Status: cancelled

The process has been terminated. Use delete_command to remove the record.`;
    },
    {
      name: "stop_command",
      description:
        "Stop a running background command by sending SIGTERM to the process.",
      schema: z.object({
        command_id: z.string().describe("The command ID to stop"),
      }),
    },
  );

  const deleteCommandTool = tool(
    async ({ command_id }: { command_id: string }) => {
      const result = commandManager.deleteCommand(command_id);

      if (result.success) {
        return `Command record deleted: ${command_id}
Resources have been freed.`;
      }

      return `Failed to delete command: ${command_id}
Command not found.`;
    },
    {
      name: "delete_command",
      description:
        "Delete a background command record. Use this to clean up completed/failed/cancelled commands and free resources.",
      schema: z.object({
        command_id: z.string().describe("The command ID to delete"),
      }),
    },
  );

  return [
    bashTool,
    startCommandTool,
    getCommandTool,
    listCommandsTool,
    stopCommandTool,
    deleteCommandTool,
  ];
}
