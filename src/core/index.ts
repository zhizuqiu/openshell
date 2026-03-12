/**
 * OpenShell Core Library
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, '..', '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

export const VERSION = packageJson.version;

export interface Config {
  version: string;
  debug?: boolean;
  autoExecute?: boolean;
}

export function getVersion(): string {
  return VERSION;
}

export function createConfig(options?: Partial<Config>): Config {
  return {
    version: VERSION,
    debug: false,
    autoExecute: false,
    ...options,
  };
}

// Export AI modules
export * from './ai/agent.js';
export * from './ai/tools.js';
export * from './session/session.js';
