/**
 * OpenShell Agent using LangChain
 */
import type { ReactAgent } from 'langchain';
export interface AgentConfig {
    apiKey: string;
    baseURL: string;
    model: string;
}
export declare function createShellAgent(config: AgentConfig): Promise<ReactAgent>;
export declare function queryShellAgent(agent: ReactAgent, query: string, threadId?: string): Promise<string>;
