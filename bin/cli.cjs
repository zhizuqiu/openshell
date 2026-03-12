#!/usr/bin/env node

/**
 * OpenShell CLI Entry Point (CommonJS wrapper)
 * This file checks Node.js version before loading the ESM module
 */

"use strict";

// Check Node.js version at runtime
// OpenShell requires Node.js >= 20.0.0 for ESM support and modern APIs
const REQUIRED_NODE_VERSION = 20;
const currentVersion = process.version;
const majorVersion = parseInt(currentVersion.slice(1).split(".")[0], 10);

if (majorVersion < REQUIRED_NODE_VERSION) {
  console.error(
    "\n" +
      "╔════════════════════════════════════════════════════════════════╗\n" +
      "║                                                                ║\n" +
      "║   OpenShell - Node.js Version Error                           ║\n" +
      "║                                                                ║\n" +
      "║   Current Node.js version: " +
      currentVersion +
      "\n" +
      "║   Required Node.js version: >= 20.0.0                          ║\n" +
      "║                                                                ║\n" +
      "║   Please upgrade Node.js to continue.                          ║\n" +
      "║                                                                ║\n" +
      "║   Quick upgrade options:                                       ║\n" +
      "║   ───────────────────────                                      ║\n" +
      "║   1. Using nvm (recommended):                                  ║\n" +
      "║      nvm install 20 && nvm use 20                              ║\n" +
      "║                                                                ║\n" +
      "║   2. Using Homebrew (macOS):                                   ║\n" +
      "║      brew install node@20                                      ║\n" +
      "║                                                                ║\n" +
      "║   3. Official installer:                                       ║\n" +
      "║      https://nodejs.org/en/download/                           ║\n" +
      "║                                                                ║\n" +
      "╚════════════════════════════════════════════════════════════════╝\n",
  );
  process.exit(1);
}

// Node.js version is OK, load the ESM module
// Use dynamic import() which returns a Promise
(async () => {
  try {
    const { main } = await import("../dist/index.js");
    await main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
