#!/usr/bin/env node

/**
 * OpenShell CLI Entry Point
 */

import { main } from "./openshell.js";

// Check Node.js version at runtime
// OpenShell requires Node.js >= 20.0.0 for ESM support and modern APIs
const REQUIRED_NODE_VERSION = 20;
const currentVersion = process.version;
const majorVersion = parseInt(currentVersion.slice(1).split(".")[0], 10);

if (majorVersion < REQUIRED_NODE_VERSION) {
  console.error(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   OpenShell - Node.js Version Error                           ║
║                                                                ║
║   Current Node.js version: ${currentVersion}
║   Required Node.js version: >= 20.0.0                          ║
║                                                                ║
║   Please upgrade Node.js to continue.                          ║
║                                                                ║
║   Quick upgrade options:                                       ║
║   ───────────────────────                                      ║
║   1. Using nvm (recommended):                                  ║
║      nvm install 20 && nvm use 20                              ║
║                                                                ║
║   2. Using Homebrew (macOS):                                   ║
║      brew install node@20                                      ║
║                                                                ║
║   3. Official installer:                                       ║
║      https://nodejs.org/en/download/                           ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

// Monkey-patch Promise to support .toPromise() if it doesn't exist.
// This is a workaround for a bug in @kubernetes/client-node v1.4.0's rxjsStub
// where it expects middleware to return an object with .toPromise(),
// but the library's own auth middleware returns a plain Promise.
if (!(Promise.prototype as any).toPromise) {
  (Promise.prototype as any).toPromise = function () {
    return this;
  };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
