/**
 * Shell Tools for LangChain Agent
 * Using tool() API from langchain 1.2.10
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn } from "child_process";

// Track running child processes for cleanup on exit
const runningProcesses = new Set<any>();

/**
 * Get all running child processes
 */
export function getRunningProcesses(): Set<any> {
  return runningProcesses;
}

/**
 * Kill all running child processes
 */
export function killAllProcesses(): void {
  for (const proc of runningProcesses) {
    try {
      // Kill the entire process group (negative PID on Unix)
      if (proc.pid) {
        process.kill(-proc.pid, "SIGTERM");
      } else {
        proc.kill("SIGTERM");
      }
    } catch (e) {
      // Process already exited
    }
  }
  runningProcesses.clear();
}

/**
 * Create tools for shell operations using the tool() API
 */
export function createShellTools() {
  const bashTool = tool(
    async (input: any) => {
      return new Promise<string>((resolve) => {
        const child = spawn(input.command, [], {
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
          detached: true, // Create new process group
        });

        runningProcesses.add(child);

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        child.on("close", (code: number | null) => {
          runningProcesses.delete(child);
          if (stderr && !stdout) {
            resolve(`Error: ${stderr}`);
          } else {
            resolve(stdout || "Command executed successfully (no output)");
          }
        });

        child.on("error", (err: Error) => {
          runningProcesses.delete(child);
          resolve(`Error executing command: ${err.message}`);
        });
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

  return [bashTool];
}
