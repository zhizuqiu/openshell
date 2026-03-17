#!/usr/bin/env node

/**
 * OpenShell CLI Entry Point
 */

// 1. 初始化环境变量 (必须在所有业务 import 之前，防止某些模块在 top-level 读取 process.env)
import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import os from "os";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 优先级：~/.config/openshell/.env 为基础配置，项目根目录 .env 为覆盖配置
const homeOpenshellEnvPath = join(os.homedir(), ".config", "openshell", ".env");
const localEnvPath = join(__dirname, "..", ".env");

// 先加载用户全局配置
if (fs.existsSync(homeOpenshellEnvPath)) {
  config({ path: homeOpenshellEnvPath, override: true, quiet: true });
}

// 再加载项目本地配置 (override: true 确保本地优先)
if (fs.existsSync(localEnvPath)) {
  config({ path: localEnvPath, override: true, quiet: true });
}

// 2. 导入业务逻辑
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
