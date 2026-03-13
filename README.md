English | [中文](./docs/manual/README.zh-CN.md)

# OpenShell

🚀 **OpenShell** is a state-of-the-art AI-powered shell operations assistant terminal tool built with [Ink](https://github.com/vadimdemedes/ink) and [LangChain](https://github.com/langchain-ai/langchainjs).

Interact with your system using natural language. No more memorizing complex commands—just ask and let the AI handle the heavy lifting with full Human-in-the-Loop safety.

## ✨ Key Features

- 🤖 **Natural Language Intelligence**: Query system info ("How many processes are running?") or modify files ("Create a backup of config.yaml") with ease.
- 📡 **Robust Streaming UI**: Experience real-time AI reasoning and output with a premium, flick-free terminal interface.
- 🛡️ **Human-in-the-Loop (HITL)**: Safety first. Sensitive operations (file modifications, system changes) require explicit user approval.
- ⚡ **Autonomous Mode**: Switch to "Auto-execute" with `Ctrl+A` for the AI to perform operations without interruptions (best for trusted environments).
- 🧩 **Deep Type Safety**: Built with strict TypeScript and aligned with official LangChain/LangGraph schemas for maximum reliability.
- ⌨️ **Input Stability**: Custom keyboard parser ensures no character loss, even during high-frequency streaming.
- 🔍 **Dynamic Command Execution**: Supports cross-platform commands (bash/zsh on Unix, PowerShell/cmd on Windows).

## 📸 Demo

[![asciicast](https://asciinema.org/a/7tbFGLf4FiJQMRJ4.svg)](https://asciinema.org/a/7tbFGLf4FiJQMRJ4)

## 🚀 Quick Start

### Prerequisites

- **Node.js**: >= 20.0.0 (required)

> **Note**: OpenShell uses modern ESM modules and requires Node.js 20 or later. If you encounter `SyntaxError: Unexpected token {`, please upgrade Node.js.

**Upgrade Node.js**:

```bash
# Using nvm (recommended)
nvm install 20 && nvm use 20

# Using Homebrew (macOS)
brew install node@20

# Official installer
# https://nodejs.org/en/download/
```

### Global Installation

```bash
npm install -g @zhizuqiu/openshell@latest
openshell
```

### Local Development

```bash
git clone https://github.com/zhizuqiu/openshell.git
cd openshell/openshell
npm install
npm run build
npm start
```

## ⚙️ Configuration

OpenShell supports two configuration methods: **Environment Variables** and **Configuration Files**.

### Environment Variables

| Variable           | Required | Description                         | Default                     |
| :----------------- | :------- | :---------------------------------- | :-------------------------- |
| `OPENAI_API_KEY`   | **Yes**  | AI model API Key                    | -                           |
| `OPENAI_API_MODEL` | No       | Model name (e.g., qwen-max, gpt-4o) | `gpt-4o`                    |
| `OPENAI_BASE_URL`  | No       | Custom provider endpoint            | `https://api.openai.com/v1` |
| `OPENSHHELL_LANG`  | No       | UI language (`zh-CN` or `en-US`)    | `en-US`                     |

### Configuration File

OpenShell reads configuration from `.env` files in the following order (first match wins):

1. `~/.config/openshell/.env` (Global config, recommended)
2. `./.env` (Project-level config)

**Setup:**

```bash
# Create global config directory
mkdir -p ~/.config/openshell

# Create and edit config file
vim ~/.config/openshell/.env
```

**Example:**

```bash
# Required: AI model API Key
OPENAI_API_KEY=your-api-key-here

# Optional: Model name (default: gpt-4o)
OPENAI_API_MODEL=gpt-4o

# Optional: Custom API endpoint
OPENAI_BASE_URL=https://api.openai.com/v1

# Optional: UI language (zh-CN or en-US, default: en-US)
OPENSHHELL_LANG=en-US
```

## 🕹️ Controls

- **Enter**: Send message
- **! (at start)**: Enter Shell Mode (direct command execution)
- **Esc**: Exit Shell Mode / Cancel current task
- **Ctrl+A**: Toggle Autonomous Mode (Auto-execute)
- **Arrow Up/Down**: Command history (separate for Agent/Shell modes)
- **Ctrl+C**: Exit

### 🐚 Shell Mode

Press `!` at the beginning of the input box to enter **Shell Mode** for direct command execution:

```
[Shell] > ls -la    # Press Enter to execute directly, no AI involved
[Shell] > git status
[Shell] > pwd
```

- **Enter**: Execute command immediately
- **Esc** or **Backspace (at position 0)**: Exit Shell Mode back to Agent Mode
- Command history is separate from Agent Mode
- Auto-exits to Agent Mode after command execution

## 📄 License

MIT © [zhizuqiu](https://github.com/zhizuqiu)
