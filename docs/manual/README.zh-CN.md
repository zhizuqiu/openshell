[English](../../README.md) | 中文

# OpenShell

🚀 **OpenShell** 是一个基于 AI 驱动的顶级 Shell 运维助手终端工具，使用 [Ink](https://github.com/vadimdemedes/ink) 和 [LangChain](https://github.com/langchain-ai/langchainjs) 构建。

使用自然语言直接管理系统。无需再苦记复杂的命令——只需提问，让 AI 在"人类在环"安全机制的保护下为您处理繁重任务。

## ✨ 核心特性

- 🤖 **自然语言智能**：轻松查询系统信息（"有哪些进程在运行？"）或直接修改文件（"创建 config.yaml 的备份"）。
- 📡 **稳健的流式 UI**：实时展示 AI 的推理和输出，提供流畅、无闪烁的顶级终端交互体验。
- 🛡️ **人类在环 (HITL)**：安全第一。敏感操作（文件修改、系统变更）必须经过用户的显式批准。
- ⚡ **自主模式**：通过 `Ctrl+A` 快速切换"自主执行"，让 AI 无需干扰地执行操作（适用于信任的环境）。
- 🧩 **深层类型安全**：基于严格的 TypeScript 构建，并与 LangChain/LangGraph 官方 Schema 对齐，可靠性极高。
- ⌨️ **输入稳定性**：自定义键盘解析器确保即使在高速流式输出期间也不会丢失用户输入的字符。
- 🔍 **动态命令执行**：支持跨平台命令（Unix 上的 bash/zsh，Windows 上的 PowerShell/cmd）。

## 📸 演示

[![asciicast](https://asciinema.org/a/7tbFGLf4FiJQMRJ4.svg)](https://asciinema.org/a/7tbFGLf4FiJQMRJ4)

## 🚀 快速开始

### 前提条件

- **Node.js**: >= 20.0.0 (必需)

> **注意**: OpenShell 使用现代 ESM 模块，需要 Node.js 20 或更高版本。如果遇到 `SyntaxError: Unexpected token {`，请升级 Node.js。

**升级 Node.js**：

```bash
# 使用 nvm（推荐）
nvm install 20 && nvm use 20

# 使用 Homebrew (macOS)
brew install node@20

# 官方安装包
# https://nodejs.org/zh-cn/download/
```

### 全局安装

```bash
npm install -g @zhizuqiu/openshell@latest
openshell
```

### 本地开发

```bash
git clone https://github.com/zhizuqiu/openshell.git
cd openshell/openshell
npm install
npm run build
npm start
```

## ⚙️ 环境变量配置

OpenShell 支持通过 `.env` 文件配置环境变量（项目根目录或 `~/.config/openshell/.env`）。

| 变量名             | 必选   | 描述                           | 默认值                      |
| :----------------- | :----- | :----------------------------- | :-------------------------- |
| `OPENAI_API_KEY`   | **是** | AI 模型 API Key                | -                           |
| `OPENAI_API_MODEL` | 否     | 模型名称 (如 qwen-max, gpt-4o) | `gpt-4o`                    |
| `OPENAI_BASE_URL`  | 否     | 自定义提供商接口地址           | `https://api.openai.com/v1` |
| `OPENSHHELL_LANG`  | 否     | UI 语言 (`zh-CN` 或 `en-US`)   | `en-US`                     |

## 🕹️ 交互方式

- **Enter**: 发送消息
- **! (起始位置)**: 进入 Shell 模式（直接执行命令）
- **Esc**: 退出 Shell 模式 / 取消当前任务
- **Ctrl+A**: 切换自主执行模式 (Auto-execute)
- **Arrow Up/Down**: 浏览命令历史（Agent/Shell 模式分离）
- **Ctrl+C**: 退出程序

### 🐚 Shell 模式

在输入框起始位置按 `!` 进入 **Shell 模式**，直接执行命令：

```
[Shell] > ls -la    # 按 Enter 直接执行，不经过 AI
[Shell] > git status
[Shell] > pwd
```

- **Enter**: 立即执行命令
- **Esc** 或 **Backspace (起始位置)**: 退出 Shell 模式，返回 Agent 模式
- 命令历史与 Agent 模式分离
- 命令执行后自动返回 Agent 模式

## 📁 配置文件

### 配置文件位置

OpenShell 按以下顺序读取 `.env` 配置文件（优先使用第一个匹配项）：

1. `~/.config/openshell/.env`（全局配置，推荐）
2. `./.env`（项目级配置）

### 设置方法

```bash
# 创建全局配置目录
mkdir -p ~/.config/openshell

# 创建并编辑配置文件
vim ~/.config/openshell/.env
```

### 配置示例

```bash
# 必需：AI 模型 API Key
OPENAI_API_KEY=your-api-key-here

# 可选：模型名称（默认：gpt-4o）
OPENAI_API_MODEL=gpt-4o

# 可选：自定义 API 接口地址
OPENAI_BASE_URL=https://api.openai.com/v1

# 可选：UI 语言（zh-CN 或 en-US，默认：en-US）
OPENSHHELL_LANG=zh-CN
```

### 使用不同的 AI 提供商

**OpenAI:**

```bash
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_MODEL=gpt-4o
```

**Azure OpenAI:**

```bash
OPENAI_API_KEY=your-azure-key
OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment
OPENAI_API_MODEL=gpt-4o
```

**本地模型 (Ollama 等):**

```bash
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_MODEL=llama3
```

**其他提供商 (DeepSeek、月之暗面等):**

```bash
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_API_MODEL=deepseek-chat
```

## 📄 许可证

MIT © [zhizuqiu](https://github.com/zhizuqiu)
