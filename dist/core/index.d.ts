/**
 * OpenShell Core Library
 */
export declare const VERSION: any;
export interface Config {
    version: string;
    debug?: boolean;
    autoExecute?: boolean;
}
export declare function getVersion(): string;
export declare function createConfig(options?: Partial<Config>): Config;
export * from './ai/agent.js';
export * from './ai/tools.js';
export * from './session/session.js';
