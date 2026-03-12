/**
 * Command Manager for Background Commands
 *
 * This module provides lifecycle management for background commands:
 * - Start, query, stop, delete commands
 * - Concurrency limiting (default: 20)
 * - Output buffering (default: 1MB)
 * - Lease-based automatic cleanup
 */

import { spawn, type ChildProcess } from "child_process";
import { LeaseManager } from "./lease-manager.js";

export interface CommandSession {
  id: string;
  command: string;
  description: string;
  status: "running" | "completed" | "failed" | "cancelled";
  output: string;
  exitCode?: number;
  startTime: number;
  endTime?: number;
  process: ChildProcess;
  leaseId: string;
}

export interface CommandSummary {
  id: string;
  command: string;
  description: string;
  status: string;
  duration: number;
  exitCode?: number;
}

export interface CommandManagerConfig {
  maxConcurrent: number;
  maxOutputSize: number;
}

const DEFAULT_CONFIG: CommandManagerConfig = {
  maxConcurrent: parseInt(
    process.env["OPENSDK_MAX_CONCURRENT_COMMANDS"] || "20",
    10,
  ),
  maxOutputSize: parseInt(
    process.env["OPENSDK_MAX_OUTPUT_SIZE"] || "1048576",
    10,
  ),
};

export class CommandManager {
  private commands: Map<string, CommandSession> = new Map();
  private leaseManager: LeaseManager;
  private readonly config: CommandManagerConfig;

  constructor(config: Partial<CommandManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.leaseManager = new LeaseManager({}, (leaseId) =>
      this.handleLeaseExpired(leaseId),
    );
    this.leaseManager.startRenewal();
  }

  /**
   * Start a background command
   */
  async startCommand(
    command: string,
    description: string,
  ): Promise<{
    command_id: string;
    status: "running";
    pid: number;
  }> {
    // Check concurrency limit
    const runningCount = Array.from(this.commands.values()).filter(
      (c) => c.status === "running",
    ).length;

    if (runningCount >= this.config.maxConcurrent) {
      throw new Error(
        `Maximum concurrent commands limit reached (${this.config.maxConcurrent}). Please stop some commands first.`,
      );
    }

    // Generate command ID
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Spawn the process
    const child = spawn(command, [], {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });

    // Create lease
    const leaseId = this.leaseManager.createLease(commandId);

    // Create command session
    const session: CommandSession = {
      id: commandId,
      command,
      description,
      status: "running",
      output: "",
      startTime: Date.now(),
      process: child,
      leaseId,
    };

    this.commands.set(commandId, session);

    // Handle stdout
    child.stdout.on("data", (data: Buffer) => {
      this.appendOutput(session, data.toString());
    });

    // Handle stderr
    child.stderr.on("data", (data: Buffer) => {
      this.appendOutput(session, `[stderr] ${data.toString()}`);
    });

    // Handle process exit
    child.on("close", (code) => {
      session.status = code === 0 ? "completed" : "failed";
      session.exitCode = code ?? undefined;
      session.endTime = Date.now();
    });

    // Handle process error
    child.on("error", (err) => {
      session.status = "failed";
      session.output += `\n[error] ${err.message}`;
      session.endTime = Date.now();
    });

    return {
      command_id: commandId,
      status: "running",
      pid: child.pid ?? 0,
    };
  }

  /**
   * Append output with size limit
   */
  private appendOutput(session: CommandSession, chunk: string): void {
    session.output += chunk;

    // Trim if exceeds limit (keep last N bytes)
    if (session.output.length > this.config.maxOutputSize) {
      session.output = session.output.slice(-this.config.maxOutputSize);
    }
  }

  /**
   * Get command status
   */
  getCommand(commandId: string): CommandSummary | undefined {
    const session = this.commands.get(commandId);
    if (!session) return undefined;

    return {
      id: session.id,
      command: session.command,
      description: session.description,
      status: session.status,
      duration: (session.endTime ?? Date.now()) - session.startTime,
      exitCode: session.exitCode,
    };
  }

  /**
   * Get command output
   */
  getCommandOutput(commandId: string): string | undefined {
    return this.commands.get(commandId)?.output;
  }

  /**
   * List all commands
   */
  listCommands(status?: string): CommandSummary[] {
    const commands = Array.from(this.commands.values()).map((session) => ({
      id: session.id,
      command: session.command,
      description: session.description,
      status: session.status,
      duration: (session.endTime ?? Date.now()) - session.startTime,
      exitCode: session.exitCode,
    }));

    if (status) {
      return commands.filter((c) => c.status === status);
    }

    return commands;
  }

  /**
   * Stop a running command
   */
  stopCommand(commandId: string): { status: "cancelled" | "not_found" } {
    const session = this.commands.get(commandId);
    if (!session || session.status !== "running") {
      return { status: "not_found" };
    }

    // Kill the process
    try {
      if (session.process.pid) {
        try {
          process.kill(-session.process.pid, "SIGTERM");
        } catch {
          session.process.kill("SIGTERM");
        }
      } else {
        session.process.kill("SIGTERM");
      }
    } catch {
      // Process already exited
    }

    session.status = "cancelled";
    session.endTime = Date.now();

    return { status: "cancelled" };
  }

  /**
   * Delete a command record
   */
  deleteCommand(commandId: string): { success: boolean } {
    const session = this.commands.get(commandId);
    if (!session) {
      return { success: false };
    }

    // Delete associated lease
    this.leaseManager.deleteLease(session.leaseId);

    // Kill process if still running
    if (session.status === "running") {
      try {
        if (session.process.pid) {
          try {
            process.kill(-session.process.pid, "SIGKILL");
          } catch {
            session.process.kill("SIGKILL");
          }
        } else {
          session.process.kill("SIGKILL");
        }
      } catch {
        // Process already exited
      }
    }

    this.commands.delete(commandId);
    return { success: true };
  }

  /**
   * Handle lease expiration
   */
  private handleLeaseExpired(leaseId: string): void {
    // Find command with expired lease
    for (const session of this.commands.values()) {
      if (session.leaseId === leaseId && session.status === "running") {
        // Kill the process
        try {
          if (session.process.pid) {
            try {
              process.kill(-session.process.pid, "SIGTERM");
            } catch {
              session.process.kill("SIGTERM");
            }
          } else {
            session.process.kill("SIGTERM");
          }
        } catch {
          // Process already exited
        }

        session.status = "cancelled";
        session.endTime = Date.now();
        session.output +=
          "\n\n[system] Command terminated: lease expired (OpenShell exited without renewing)";
      }
    }
  }

  /**
   * Cleanup all commands (called on exit)
   */
  cleanupAll(): void {
    // Stop lease renewal
    this.leaseManager.stop();

    // Kill all running processes
    for (const session of this.commands.values()) {
      if (session.status === "running") {
        try {
          if (session.process.pid) {
            try {
              process.kill(-session.process.pid, "SIGTERM");
            } catch {
              session.process.kill("SIGTERM");
            }
          } else {
            session.process.kill("SIGTERM");
          }
        } catch {
          // Process already exited
        }
      }
    }
  }

  /**
   * Get the lease manager (for testing)
   */
  getLeaseManager(): LeaseManager {
    return this.leaseManager;
  }
}

// Global singleton instance
let commandManagerInstance: CommandManager | null = null;

export function getCommandManager(): CommandManager {
  if (!commandManagerInstance) {
    commandManagerInstance = new CommandManager();
  }
  return commandManagerInstance;
}
