/**
 * OpenShell Agent using LangChain
 */
import { createAgent, initChatModel, humanInTheLoopMiddleware, } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { createShellTools } from './tools.js';
import os from 'os';
// Initialize a shared memory saver for the agent session
const checkpointer = new MemorySaver();
export async function createShellAgent(config) {
    const model = await initChatModel(config.model, {
        modelProvider: 'openai',
        baseUrl: config.baseURL,
        apiKey: config.apiKey,
        temperature: 0,
        streaming: true,
    });
    const tools = createShellTools();
    const systemMessage = `You are a powerful shell assistant that can do ANYTHING on this machine through command-line operations.
Your goal is to help the user achieve their tasks by executing the right commands.

System Information:
- Current Working Directory: ${process.cwd()}
- Operating System: ${os.platform()} (${os.arch()})
- Default Shell: ${os.userInfo().shell || 'sh'}
- Home Directory: ${os.homedir()}

Capabilities:
- You can execute system commands using the 'execute_command' tool.
- You can perform file operations, system administration, software installation (if permitted), and data processing.

Instructions:
1. Understand the user's natural language request.
2. Formulate the precise command(s) needed to fulfill the request.
3. Use 'execute_command' to run them.
4. Adapt commands to the user's OS (e.g., use 'dir' on Windows, 'ls' on Unix).
5. Provide clear explanations of what you are doing and why.
6. If a task requires multiple steps, explain the plan first.
7. Always base your answers on actual output from the commands.

Be proactive but careful. You are an expert shell assistant.`;
    const agent = createAgent({
        model,
        tools,
        systemPrompt: systemMessage,
        checkpointer,
        middleware: [
            humanInTheLoopMiddleware({
                interruptOn: {
                    execute_command: {
                        allowedDecisions: ['approve', 'reject'],
                        description: 'Confirm command execution',
                    },
                },
            }),
        ],
    });
    return agent;
}
// Query function for compatibility
export async function queryShellAgent(agent, query, threadId = 'main-session') {
    try {
        const result = await agent.invoke({ messages: [{ role: 'user', content: query }] }, { configurable: { thread_id: threadId } });
        const lastMessage = result.messages?.[result.messages.length - 1];
        if (!lastMessage)
            return 'No response from agent';
        if (typeof lastMessage.content === 'string')
            return lastMessage.content;
        return JSON.stringify(lastMessage.content);
    }
    catch (error) {
        return error instanceof Error
            ? `Agent error: ${error.message}`
            : 'Unknown agent error';
    }
}
//# sourceMappingURL=agent.js.map