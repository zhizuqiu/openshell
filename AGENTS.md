# OpenShell Agent Guidelines

## 📦 Project Overview

**Package**: `@zhizuqiu/openshell` | **Node**: >=20.0.0 | **Module**: ESM

AI-powered Shell CLI tool using Ink (Terminal React), LangChain, and TypeScript.

**Tech Stack**: Ink 6.6 + React 19 + LangChain 1.2 + LangGraph 1.1 + OpenAI SDK + Zod

---

## 🛠️ Commands

### Build & Development

```bash
npm run build       # Compile TypeScript to dist/
npm run dev         # Build and run interactive CLI
npm run start       # Run built CLI
npm run clean       # Remove dist/ and build artifacts
```

### Lint & Format

```bash
npm run lint        # Run ESLint
npm run lint:fix    # Auto-fix ESLint issues
npm run format      # Format with Prettier
npm run typecheck   # Type check (no emit)
```

### Test (Vitest)

```bash
npm run test                    # Run all tests
npm run test -- --ui           # Open Vitest UI
npx vitest run src/path/file.test.ts    # Single test file
npx vitest run -t "pattern"    # Tests matching pattern
```

**Test files**: `*.test.ts` or `*.test.tsx`

---

## 🧪 Development Workflow (TDD)

**Test-Driven Development is required for all new features and bug fixes:**

1. **Write tests first** - Define expected behavior before implementation
2. **Watch tests fail** - Verify the test correctly identifies missing functionality
3. **Implement code** - Write minimum code to pass the tests
4. **Run tests** - Confirm all tests pass
5. **Refactor** - Improve code quality while keeping tests green

### TDD Example Flow

```bash
# 1. Create test file
touch src/ui/MyComponent.test.tsx

# 2. Write failing test
npx vitest run src/ui/MyComponent.test.tsx  # Should fail

# 3. Implement feature
# Edit src/ui/MyComponent.tsx

# 4. Verify tests pass
npx vitest run src/ui/MyComponent.test.tsx  # Should pass

# 5. Run all tests to ensure no regressions
npm run test
```

### Test Conventions

- Place tests next to source files: `Component.tsx` → `Component.test.tsx`
- Use descriptive test names: `describe`, `it("should...")`
- Test edge cases and error conditions
- Mock external dependencies (API, filesystem, etc.)

---

## 📝 Code Style

### Imports (ESM)

- Use `.js` extension: `import { x } from './module.js'`
- Group: stdlib → external packages → internal modules
- Type imports: `import type { Foo } from './types.js'`

### TypeScript (Strict Mode)

- `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`
- Use `unknown` before type narrowing (never `any`)
- Prefer `interface` for object shapes, `type` for unions
- Explicit types on all function parameters and returns
- Test files excluded from compilation

### Naming Conventions

| Type                | Convention       | Example                        |
| ------------------- | ---------------- | ------------------------------ |
| Files               | camelCase        | `tools.ts`, `AppContainer.tsx` |
| Classes             | PascalCase       | `ShellClient`                  |
| Functions/Variables | camelCase        | `createShellTools`             |
| Constants           | UPPER_SNAKE_CASE | `DEFAULT_COMMAND`              |
| Types/Interfaces    | PascalCase       | `AgentConfig`                  |

### Formatting (Prettier)

- Single quotes: `'string'`
- Semicolons: required
- Trailing commas: always (multiline)
- Indent: 2 spaces
- Line width: 80 chars
- Arrow functions: always `(x) => x`

### Error Handling

```typescript
try {
  await asyncOperation();
} catch (error) {
  return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
}
```

- Wrap async operations in try/catch
- Return user-friendly error messages
- Preserve original error for debugging

### ESLint Config

- `typescript-eslint` + `eslint-plugin-react` + `eslint-plugin-react-hooks`
- Ignores: `dist/`, `node_modules/`, `*.tsbuildinfo`
- Rules:
  - `react/react-in-jsx-scope`: off (React 19)
  - `react/prop-types`: off (TypeScript)
  - `@typescript-eslint/no-unused-vars`: allows `_` prefix

### React/Ink Components

- Functional components with TypeScript
- No prop-types (TypeScript)
- Standard React hooks

### Ink Static Component Limitations

- `<Static>` accumulates output and does not clear previous content when `items` changes
- Changing the `key` prop alone does not clear the terminal buffer
- For session switching or history replacement, add system messages as markers instead of attempting to clear/replace
- If screen refresh is needed, use `useStdout()` and write ANSI escape codes: `\x1b[2J\x1b[H`

---

## 🏗️ Project Structure

```
src/
├── core/ai/         # Agent & tools (LangChain)
├── core/session/    # Session & command management
├── ui/              # Ink/React UI components
├── i18n.ts          # Internationalization
└── index.ts         # CLI entry point
```

## ⚙️ Configuration

### Environment Variables (.env or ~/.config/openshell/.env)

| Variable                  | Required | Default                     |
| ------------------------- | -------- | --------------------------- |
| `OPENAI_API_KEY`          | Yes      | -                           |
| `OPENAI_API_MODEL`        | No       | `gpt-4o`                    |
| `OPENAI_BASE_URL`         | No       | `https://api.openai.com/v1` |
| `OPENSHHELL_LANG`         | No       | `en-US`                     |
| `OPENSHHELL_DEBUG`        | No       | `false`                     |
| `OPENSHHELL_AUTO_EXECUTE` | No       | `false`                     |

**Example** (`~/.config/openshell/.env`):

```bash
OPENAI_API_KEY=sk-...
OPENAI_API_MODEL=gpt-4o
OPENSHHELL_DEBUG=true
```

## 🚀 Publish to npm

```bash
npm version patch --no-git-tag-version
npm run build
npm publish --access public
git add package.json && git commit -m "chore: bump version to X.X.X"
git tag vX.X.X
```

## ⚠️ Development Rules

1. **No Commits Without Permission**: Do NOT commit code changes unless the user explicitly asks you to commit
2. **Internationalize User-Facing Text**: All prompt messages, hints, and instructional text must use the i18n system (`t()` function) - never hardcode strings

## ⚠️ Common Issues

| Issue                 | Solution                            |
| --------------------- | ----------------------------------- |
| `Cannot find module`  | Use `.js` extension in imports      |
| `403 Forbidden` (npm) | Bump version, cannot overwrite      |
| `EOTP` (npm)          | Use `--otp=<code>` or non-2FA token |
