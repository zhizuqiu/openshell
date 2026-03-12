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

## 🚀 Quick Start

### Prerequisites

- **Node.js**: >= 20.0.0

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

OpenShell supports environment variables via `.env` files (Project root or `~/.openshell/.env`).

| Variable           | Required | Description                         | Default                     |
| :----------------- | :------- | :---------------------------------- | :-------------------------- |
| `OPENAI_API_KEY`   | **Yes**  | AI model API Key                    | -                           |
| `OPENAI_API_MODEL` | No       | Model name (e.g., qwen-max, gpt-4o) | `gpt-4o`                    |
| `OPENAI_BASE_URL`  | No       | Custom provider endpoint            | `https://api.openai.com/v1` |

## 🕹️ Controls

- **Enter**: Send message
- **Ctrl+A**: Toggle Autonomous Mode (Auto-execute)
- **Arrow Up/Down**: Command history
- **Ctrl+C**: Exit

## 📄 License

MIT © [zhizuqiu](https://github.com/zhizuqiu)
