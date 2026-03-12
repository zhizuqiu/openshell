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
export function getVersion() {
    return VERSION;
}
export function createConfig(options) {
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
//# sourceMappingURL=index.js.map