# OpenShell Project Context

> [!IMPORTANT]
> **Mandate:** All communication with the user must be conducted in **Chinese (中文)**.

OpenShell is a state-of-the-art AI-powered shell operations assistant built with [Ink](https://github.com/vadimdemedes/ink) and [LangChain](https://github.com/langchain-ai/langchainjs). It allows users to interact with their system using natural language while maintaining safety through Human-in-the-Loop (HITL) approvals.

## 🏗 Architecture & Technologies

- **Runtime:** Node.js (>= 20.0.0) with TypeScript and ESM.
- **UI Layer:** [Ink](https://github.com/vadimdemedes/ink) (React-based terminal renderer) for a rich, streaming terminal interface.
- **AI Layer:** [LangChain](https://github.com/langchain-ai/langchainjs) and [LangGraph](https://github.com/langchain-ai/langgraphjs) for agentic workflows and streaming updates.
- **Core Logic:**
    - `src/core/ai/agent.ts`: Defines the LangGraph agent, system prompts, and HITL middleware.
    - `src/core/ai/tools.ts`: Implements shell execution tools (`run_command`, `command_status`, etc.) and interactive user questioning (`ask_user`).
    - `src/core/ai/file-tools.ts`: Provides file system operations.
    - `src/ui/AppContainer.tsx`: Manages the main UI state and AI streaming lifecycle.

## 🚀 Key Commands

| Task | Command |
| :--- | :--- |
| **Install Dependencies** | `npm install` |
| **Build Project** | `npm run build` (runs `tsc`) |
| **Run OpenShell** | `npm start` (runs `node dist/index.js`) |
| **Development** | `npm run dev` (builds and starts) |
| **Testing** | `npm test` (runs `vitest`) |
| **Linting** | `npm run lint` / `npm run lint:fix` |
| **Formatting** | `npm run format` (runs `prettier`) |
| **Type Checking** | `npm run typecheck` |

## 🛠 AI Capabilities & Tools

The OpenShell agent has access to several specialized tools:

- **`run_command`**: Executes shell commands. Supports `background: true` for long-running tasks.
- **`command_status`**: Queries the status or output of background commands.
- **`command_stop` / `command_cleanup`**: Manages the lifecycle of background processes.
- **`ask_user`**: Enables the agent to ask the user clarifying multi-choice questions.
- **File Tools**: `read_file`, `write_file`, `edit_file`, `delete_file`, `list_directory`, etc.

## 🛡 Development Conventions

- **Safety First (HITL):** All sensitive operations (command execution, file modifications) **must** be configured for user approval in `src/core/ai/agent.ts`.
- **ESM Modules:** Always use ESM imports. In `.ts` files, imports of local files must include the `.js` extension (e.g., `import { foo } from "./foo.js"`).
- **Strict Typing:** Leverage TypeScript's strict mode and Zod schemas for tool parameters.
- **Context Awareness:** The agent is instructed to prioritize operations within the Current Working Directory (CWD) and assume relative paths unless specified otherwise.
- **Internationalization:** Support for English (`en-US`) and Chinese (`zh-CN`) is managed in `src/ui/i18n.ts`.

## 📂 Project Structure

- `src/core/`: Core library logic, AI agents, and session management.
- `src/ui/`: React/Ink components for the terminal interface.
- `docs/`: Manuals and requirements in multiple languages.
- `scripts/`: Operational and maintenance scripts.
