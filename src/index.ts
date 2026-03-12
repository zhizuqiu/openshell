#!/usr/bin/env node

/**
 * OpenShell CLI Entry Point
 */

import { main } from "./openshell.js";
import { killAllProcesses } from "./core/ai/tools.js";
import { getCommandManager } from "./core/session/command-manager.js";

// Cleanup function to kill all running child processes
function cleanup(): void {
  // Cleanup background commands (stop lease renewal, kill processes)
  getCommandManager().cleanupAll();

  // Kill any remaining processes
  killAllProcesses();
}

// Listen for exit signals and cleanup child processes
process.on("SIGINT", () => {
  cleanup();
  process.exit(130); // 128 + SIGINT (2)
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(143); // 128 + SIGTERM (15)
});

process.on("exit", cleanup);

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  cleanup();
  console.error("Uncaught exception:", err);
  process.exit(1);
});

main().catch((error: unknown) => {
  cleanup();
  console.error(error);
  process.exit(1);
});
