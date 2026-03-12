# OpenShell 开发指南

## 📦 项目概述

OpenShell 是一个基于 AI 的通用 Shell CLI 工具，使用 Ink（终端 React）、LangChain 和 TypeScript 构建。

**包名**: `@zhizuqiu/openshell`  
**Node**: >=20.0.0  
**模块**: ESM (`"type": "module"`)

**项目历史**: 本项目从 Kubernetes 助手迁移为通用 Shell 助手。迁移后需确保所有 K8s 相关的文档、代码、变量名已更新为通用 Shell 术语。

**核心技术栈**:

- **UI**: Ink 6.6.0 + React 19.2.0 + Yargs 17.7.2
- **AI**: LangChain 1.2.10 + LangGraph 1.1.1 + OpenAI SDK 6.16.0
- **系统**: Node.js 原生模块 + @kubernetes/client-node 1.4.0 (可选)
- **验证**: Zod 4.3.5

---

## 🛠️ 命令

### 构建与开发

```bash
npm run build       # 编译 TypeScript 到 dist/
npm run dev         # 构建并运行交互式 CLI
npm run start       # 运行已构建的 CLI
npm run clean       # 删除 dist/ 和构建产物
```

### 代码检查与格式化

```bash
npm run lint        # 运行 ESLint
npm run lint:fix    # 自动修复 ESLint 问题
npm run format      # 使用 Prettier 格式化
npm run typecheck   # 类型检查（不输出文件）
```

### 测试

```bash
npm run test        # 使用 Vitest 运行所有测试
npm run test -- --ui  # 打开 Vitest UI
```

**运行单个测试文件**：

```bash
npx vitest run src/path/to/file.test.ts
```

**运行匹配模式的测试**：

```bash
npx vitest run -t "测试名称模式"
```

**测试文件命名**：`*.test.ts` 或 `*.test.tsx`

---

## 📝 代码风格

### 导入规范

- ESM 导入使用 `.js` 扩展名：`import { x } from './module.js'`
- 导入分组：标准库 → 外部包 → 内部模块
- 类型导入使用 `type`：`import type { Foo } from './types.js'`

### TypeScript

**严格模式配置** (`tsconfig.json`):

- `strict: true` - 启用所有严格类型检查
- `noImplicitAny: true` - 禁止隐式 any
- `noImplicitReturns: true` - 确保所有代码路径都有返回值
- `strictNullChecks: true` - 严格的空值检查
- `verbatimModuleSyntax: true` - 强制正确的 ESM 导入语法

**类型规范**:

- 使用 `unknown` 在类型收窄前代替 `any`
- 对象形状优先使用 interface，联合类型使用 type
- 所有函数参数和返回值必须有显式类型
- 测试文件排除在编译外 (`**/*.test.ts`)

### 命名规范

- **文件**：camelCase（如 `tools.ts`, `AppContainer.tsx`）
- **类**：PascalCase（如 `ShellClient`）
- **函数/变量**：camelCase（如 `createShellTools`）
- **常量**：UPPER_SNAKE_CASE（如 `DEFAULT_COMMAND`）
- **类型/接口**：PascalCase（如 `AgentConfig`）

**迁移规范**: 本项目已从 K8s 助手迁移为通用 Shell 助手。遇到以下 K8s 相关命名时应更新为通用术语：

- `k8s` / `kubernetes` → `system`（如 `k8sConnected` → `systemReady`）
- `kubectl` → 具体命令或 `command`
- `K8s Tools` → `Shell Tools`
- `createK8sTools` → `createShellTools`
- `k8sContext` → `systemContext` 或 `host`
- `namespace` → `user` 或 `directory`

### 格式化 (Prettier)

- 单引号：`'string'`
- 分号：必需
- 尾随逗号：始终使用（多行时）
- 缩进：2 空格
- 行宽：80 字符
- 箭头函数括号：始终 `(x) => x`

### 错误处理

- 异步操作使用 try/catch 包裹
- 工具函数返回用户友好的错误消息
- 保留原始错误消息便于调试：
  ```typescript
  catch (error) {
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
  ```

### ESLint 配置

- 基于 `typescript-eslint` + `eslint-plugin-react` + `eslint-plugin-react-hooks`
- 忽略模式：`dist/`, `node_modules/`, `*.tsbuildinfo`
- 规则：
  - `react/react-in-jsx-scope`: off (React 19 不需要)
  - `react/prop-types`: off (使用 TypeScript)
  - `@typescript-eslint/no-unused-vars`: 允许 `_` 前缀的参数

### React/Ink 组件

- 使用带 TypeScript 的函数式组件
- 无需 prop-types（使用 TypeScript）
- Hooks 遵循标准 React 约定

---

## 🏗️ 项目结构

```
src/
├── core/
│   ├── ai/
│   │   ├── agent.ts      # LangChain agent 创建
│   │   └── tools.ts      # 工具定义
│   ├── session/          # 会话管理
│   └── utils/            # 工具函数
├── ui/
│   ├── AppContainer.tsx  # 主 UI 组件
│   ├── MessageComponent.tsx
│   ├── input/            # 键盘处理
│   └── types.ts
├── i18n.ts               # 国际化
└── index.ts              # CLI 入口
```

---

## 🏛️ 架构设计

### 核心模块

1. **AI Agent** (`src/core/ai/agent.ts`)
   - 使用 LangChain `createAgent` 和 LangGraph 管理对话流程
   - 集成 `MemorySaver` 支持多轮对话上下文
   - HITL (Human-in-the-Loop) 机制确保敏感操作需用户确认

2. **工具系统** (`src/core/ai/tools.ts`)
   - 使用 `tool()` API 定义工具
   - Zod schema 验证输入参数
   - 错误处理返回用户友好消息

3. **流式 UI** (`src/ui/AppContainer.tsx`)
   - 基于 Ink/React 的终端 UI
   - 使用 `updates` 模式实时输出 Agent 响应
   - 自定义键盘解析器确保输入稳定性

4. **会话管理** (`src/core/session/session.ts`)
   - 管理对话历史和状态
   - 支持多轮上下文记忆

---

## ⚙️ 配置

### 环境变量 (.env)

| 变量               | 必需 | 说明            | 默认值                      |
| ------------------ | ---- | --------------- | --------------------------- |
| `OPENAI_API_KEY`   | 是   | AI 模型 API Key | -                           |
| `OPENAI_API_MODEL` | 否   | 模型名称        | `gpt-4o`                    |
| `OPENAI_BASE_URL`  | 否   | 自定义 API 端点 | `https://api.openai.com/v1` |

配置文件位置：项目根目录 `.env` 或 `~/.openshell/.env`

---

## 🚀 发布到 npm

### 前置条件

- 确保已登录：`npm whoami`
- 确保代码已构建：`npm run build`

### 发布流程

1. **检查当前版本**：`node -p "require('./package.json').version"`
2. **升级版本**：`npm version patch --no-git-tag-version`
3. **构建**：`npm run build`
4. **发布**：`npm publish --access public`
5. **提交**：`git add package.json && git commit -m "chore: bump version to X.X.X"`
6. **打标签**：`git tag vX.X.X`

### Token 管理

- 使用不含 2FA 的 token 避免 OTP 验证
- 设置 token：`npm set //registry.npmjs.org/:_authToken <token>`
- 生成地址：https://www.npmjs.com/settings/YOUR_USERNAME/tokens

### 常见问题

| 问题                                         | 解决方案                                    |
| -------------------------------------------- | ------------------------------------------- |
| `401 Unauthorized`                           | 运行 `npm login` 或 `npm adduser`           |
| `403 Forbidden - cannot overwrite published` | 升级版本后重新发布                          |
| `EOTP - requires one-time password`          | 使用 `--otp=<code>` 或不含 2FA 的 token     |
| `No configured push destination`             | 添加远程仓库：`git remote add origin <url>` |

---

## 🧩 添加新工具

1. 在 `src/core/ai/tools.ts` 中使用 `tool()` API 定义
2. 使用 Zod 进行 schema 验证
3. 添加到 `createShellTools` 返回数组
4. 敏感操作需在 `src/core/ai/agent.ts` 的 HITL 中添加：
   ```typescript
   execute_command: {
     allowedDecisions: ['approve', 'reject'],
     description: '确认命令执行',
   }
   ```

---

## 🌍 国际化

- 使用 `src/i18n.ts` 中的 `t()` 函数
- 键名使用点号表示法：`app.ready`、`status.enabled`
- 支持英语和中文

---

## ⚠️ 常见问题

| 问题                     | 解决方案                                |
| ------------------------ | --------------------------------------- |
| `Cannot find module`     | 确保导入使用 `.js` 扩展名               |
| `401 Unauthorized` (npm) | 运行 `npm login`                        |
| `403 Forbidden` (npm)    | 升级版本，无法覆盖已发布版本            |
| `EOTP` (npm)             | 使用 `--otp=<code>` 或不含 2FA 的 token |
