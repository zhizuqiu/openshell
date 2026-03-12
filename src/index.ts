#!/usr/bin/env node

/**
 * OpenShell CLI Entry Point
 */

import { main } from "./openshell.js";

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
