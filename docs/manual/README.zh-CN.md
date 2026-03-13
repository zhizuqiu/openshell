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

<script src="https://asciinema.org/a/7tbFGLf4FiJQMRJ4.js" id="asciicast-7tbFGLf4FiJQMRJ4" async="true"></script>

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
- **Ctrl+A**: 切换自主执行模式 (Auto-execute)
- **Arrow Up/Down**: 浏览命令历史
- **Ctrl+C**: 退出程序

## 📄 许可证

MIT © [zhizuqiu](https://github.com/zhizuqiu)
