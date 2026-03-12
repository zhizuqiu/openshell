English | [中文](./docs/manual/README.zh-CN.md)

# Cubectl

🚀 **Cubectl** is a state-of-the-art AI-powered Kubernetes operations assistant terminal tool built with [Ink](https://github.com/vadimdemedes/ink) and [LangChain](https://github.com/langchain-ai/langchainjs).

Interact with your Kubernetes clusters using natural language. No more memorizing complex `kubectl` flags—just ask and let the AI handle the heavy lifting with full Human-in-the-Loop safety.

## ✨ Key Features

- 🤖 **Natural Language Intelligence**: Query resources ("How many nodes are ready?") or modify them ("Scale my deployment to 3 replicas") with ease.
- 📡 **Robust Streaming UI**: Experience real-time AI reasoning and output with a premium, flick-free terminal interface.
- 🛡️ **Human-in-the-Loop (HITL)**: Safety first. Sensitive operations (create, patch, delete) require explicit user approval.
- ⚡ **Autonomous Mode**: Switch to "Auto-execute" with `Ctrl+A` for the AI to perform operations without interruptions (best for trusted environments).
- 🧩 **Deep Type Safety**: Built with strict TypeScript and aligned with official LangChain/LangGraph schemas for maximum reliability.
- ⌨️ **Input Stability**: Custom keyboard parser ensures no character loss, even during high-frequency streaming.
- 🔍 **Dynamic Resource Discovery**: Supports standard resources and CRDs via dynamic Kubernetes client resolution.

## 🚀 Quick Start

### Prerequisites

- **Node.js**: >= 20.0.0
- **Kubernetes**: A valid `~/.kube/config`

### Global Installation

```bash
npm install -g @zhizuqiu/cubectl@latest
cubectl
```

### Local Development

```bash
git clone https://github.com/zhizuqiu/cubectl.git
cd cubectl/cubectl
npm install
npm run build
npm start
```

## ⚙️ Configuration

Cubectl supports environment variables via `.env` files (Project root or `~/.cubectl/.env`).

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
