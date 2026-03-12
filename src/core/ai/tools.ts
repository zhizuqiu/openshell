/**
 * Shell Tools for LangChain Agent
 * Using tool() API from langchain 1.2.10
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Create tools for shell operations using the tool() API
 */
export function createShellTools() {
  const bashTool = tool(
    async (input: any) => {
      try {
        const { stdout, stderr } = await execAsync(input.command);
        if (stderr && !stdout) {
          return `Error: ${stderr}`;
        }
        return stdout || 'Command executed successfully (no output)';
      } catch (error) {
        return `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
    {
      name: 'execute_command',
      description:
        'Execute a system command on the local machine. Works across platforms (bash/zsh on Unix, PowerShell/cmd on Windows). Use for file operations, running scripts, or any system commands.',
      schema: z.object({
        command: z
          .string()
          .describe(
            'The command to execute (e.g., "ls -la", "dir", "cat file.txt")',
          ),
      }),
    },
  );

  return [bashTool];
}
