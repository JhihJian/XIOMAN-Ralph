# Ralph Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use summ:executing-plans to implement this plan task-by-task.

**Goal:** 构建 Ralph —— 一个基于 pi-coding-agent SDK 的 ReAct+Reflection 自主 Agent CLI，打包为 Docker 容器。

**Architecture:** 独立 TypeScript CLI，SENSE→DECIDE→ACT→REFLECT 状态机循环。DECIDE/REFLECT 阶段用无工具 LLM 推理（`callLLM`），ACT 阶段用 pi-coding-agent SDK 带完整工具集（`callAgent`）。四层记忆系统以 Markdown 文件持久化，挂载在 `/workspace/memory/`。

**Tech Stack:** TypeScript, Node.js 22, `@mariozechner/pi-coding-agent` (0.55.x), `@mariozechner/pi-ai`, `commander`, `vitest`

---

## 前提：了解 pi-coding-agent SDK

在开始前，先通读这两个文件建立上下文：
- `/data/github/pi-mono/packages/coding-agent/docs/sdk.md`
- `/data/github/pi-mono/packages/coding-agent/examples/sdk/01-minimal.ts`
- `/data/github/pi-mono/packages/coding-agent/examples/sdk/05-tools.ts`

关键 API 要点：
- `createAgentSession({ sessionManager: SessionManager.inMemory(), model, tools: [] })` → 无工具纯推理
- `createAgentSession({ cwd, tools: createCodingTools(cwd) })` → 完整工具集（read/write/edit/bash）
- `getModel("anthropic", "claude-sonnet-4-5")` → 获取模型对象，返回 undefined 则模型不存在
- 每次 `createAgentSession` 都是全新上下文（Fresh Context）

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/` 目录结构

**Step 1: 创建 package.json**

```json
{
  "name": "ralph",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "ralph": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@mariozechner/pi-coding-agent": "^0.55.4",
    "@mariozechner/pi-ai": "^0.55.4",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.7.0",
    "vitest": "^1.4.0",
    "@types/node": "^20.0.0"
  }
}
```

**Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: 创建目录结构**

```bash
mkdir -p src/states src/memory src/pi
```

**Step 4: 安装依赖**

```bash
cd /data/dev/XIOMAN-Ralph && npm install
```

Expected: `node_modules/` 出现，无 error。

**Step 5: 验证 TypeScript 编译器可用**

```bash
npx tsc --version
```

Expected: `Version 5.x.x`

**Step 6: Commit**

```bash
git add package.json tsconfig.json
git commit -m "feat: project scaffold with pi-coding-agent dependency"
```

---

## Task 2: types.ts

**Files:**
- Create: `src/types.ts`

**Step 1: 创建类型定义**

```typescript
// src/types.ts

export interface FourLayerMemory {
  goal: string;
  semantic: string;
  procedural: string;
  episodic: string;
}

export interface Context {
  goal: string;
  semantic: string;
  procedural: string;
  recentEpisodes: string;
  projectState: string;
}

export interface Candidate {
  action: string;
  impact: number;      // 1-5
  urgency: number;     // 1-5
  confidence: number;  // 0.1-1.0
  reasoning: string;
}

export interface Decision {
  candidates: Candidate[];
  selected: Candidate;
  priority: number;    // impact * urgency * confidence
  stopReason: string | null;
}

export interface ActResult {
  success: boolean;
  output: string;
}

export interface LoopOptions {
  maxIterations: number;
  once: boolean;
  memoryDir: string;
  workspaceDir: string;
}
```

**Step 2: 验证无编译错误**

```bash
npx tsc --noEmit
```

Expected: 无输出（无错误）。

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add type definitions"
```

---

## Task 3: config.ts + 测试

**Files:**
- Create: `src/config.ts`
- Create: `src/tests/config.test.ts`

**Step 1: 写失败测试**

```typescript
// src/tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('config', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    // 还原环境变量
    process.env.RALPH_PROVIDER = origEnv.RALPH_PROVIDER;
    process.env.RALPH_MODEL = origEnv.RALPH_MODEL;
  });

  it('uses defaults when env vars are absent', async () => {
    delete process.env.RALPH_PROVIDER;
    delete process.env.RALPH_MODEL;
    // 重新导入模块以获取新的 env 值（使用动态导入绕过 ESM 缓存）
    const { getConfig } = await import('../config.js?t=' + Date.now());
    const config = getConfig();
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4-5');
  });

  it('reads provider and model from env vars', async () => {
    process.env.RALPH_PROVIDER = 'openai';
    process.env.RALPH_MODEL = 'gpt-4o';
    const { getConfig } = await import('../config.js?t=' + Date.now());
    const config = getConfig();
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
  });
});
```

**Step 2: 运行测试，确认失败**

```bash
npm test -- config
```

Expected: FAIL with "Cannot find module '../config.js'"

**Step 3: 创建 config.ts**

```typescript
// src/config.ts

export interface Config {
  provider: string;
  model: string;
  workspaceDir: string;
}

export function getConfig(): Config {
  return {
    provider: process.env.RALPH_PROVIDER ?? 'anthropic',
    model: process.env.RALPH_MODEL ?? 'claude-sonnet-4-5',
    workspaceDir: process.env.RALPH_WORKSPACE ?? '/workspace',
  };
}
```

**Step 4: 运行测试，确认通过**

```bash
npm test -- config
```

Expected: PASS（注意：ESM 缓存可能导致动态导入测试不稳定，若失败可简化为直接测试默认值）

**Step 5: Commit**

```bash
git add src/config.ts src/tests/config.test.ts
git commit -m "feat: add config module with env var support"
```

---

## Task 4: memory/manager.ts + 测试

**Files:**
- Create: `src/memory/manager.ts`
- Create: `src/tests/memory.test.ts`

**Step 1: 写失败测试**

```typescript
// src/tests/memory.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadMemory, appendEpisodic, updateMemoryFile, initMemory } from '../memory/manager.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ralph-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true });
});

describe('initMemory', () => {
  it('creates four memory files', async () => {
    await initMemory(tmpDir);
    const { readFileSync } = await import('fs');
    expect(readFileSync(join(tmpDir, 'goal.md'), 'utf-8')).toContain('# Goal');
    expect(readFileSync(join(tmpDir, 'semantic.md'), 'utf-8')).toContain('# Semantic Memory');
    expect(readFileSync(join(tmpDir, 'procedural.md'), 'utf-8')).toContain('# Procedural Memory');
    expect(readFileSync(join(tmpDir, 'episodic.md'), 'utf-8')).toContain('# Episodic Memory');
  });
});

describe('loadMemory', () => {
  it('reads all four files', async () => {
    await initMemory(tmpDir);
    const memory = await loadMemory(tmpDir);
    expect(memory.goal).toContain('# Goal');
    expect(memory.semantic).toContain('# Semantic Memory');
    expect(memory.procedural).toContain('# Procedural Memory');
    expect(memory.episodic).toContain('# Episodic Memory');
  });

  it('throws if goal.md is missing', async () => {
    await expect(loadMemory(tmpDir)).rejects.toThrow();
  });
});

describe('appendEpisodic', () => {
  it('appends entry to episodic.md', async () => {
    await initMemory(tmpDir);
    await appendEpisodic(tmpDir, {
      timestamp: '2026-03-04T10:00:00Z',
      iteration: 1,
      action: '修复类型错误',
      priority: 0.85,
      result: 'success',
      learning: '类型定义应集中管理',
    });
    const { readFileSync } = await import('fs');
    const content = readFileSync(join(tmpDir, 'episodic.md'), 'utf-8');
    expect(content).toContain('修复类型错误');
    expect(content).toContain('success');
  });
});

describe('updateMemoryFile', () => {
  it('appends content to semantic.md', async () => {
    await initMemory(tmpDir);
    await updateMemoryFile(tmpDir, 'semantic', '\n## New Pattern\n- Use strict types');
    const { readFileSync } = await import('fs');
    const content = readFileSync(join(tmpDir, 'semantic.md'), 'utf-8');
    expect(content).toContain('New Pattern');
  });
});
```

**Step 2: 运行测试，确认失败**

```bash
npm test -- memory
```

Expected: FAIL with "Cannot find module"

**Step 3: 实现 memory/manager.ts**

```typescript
// src/memory/manager.ts
import { readFile, writeFile, appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { FourLayerMemory } from '../types.js';

const INITIAL_TEMPLATES = {
  'goal.md': `# Goal

> 在此填写你希望 Ralph 完成的目标。

## Success Criteria
- [ ] 目标1
- [ ] 目标2

## Constraints
- 约束条件1
`,
  'semantic.md': `# Semantic Memory

## Project Context
（Ralph 会自动维护此文件）

## Key Concepts
`,
  'procedural.md': `# Procedural Memory

## Patterns（成功经验）

## Anti-Patterns（失败教训）
`,
  'episodic.md': `# Episodic Memory

`,
};

export async function initMemory(memoryDir: string): Promise<void> {
  await mkdir(memoryDir, { recursive: true });
  for (const [filename, content] of Object.entries(INITIAL_TEMPLATES)) {
    const path = join(memoryDir, filename);
    if (!existsSync(path)) {
      await writeFile(path, content, 'utf-8');
    }
  }
}

export async function loadMemory(memoryDir: string): Promise<FourLayerMemory> {
  const read = (file: string) => readFile(join(memoryDir, file), 'utf-8');
  const [goal, semantic, procedural, episodic] = await Promise.all([
    read('goal.md'),
    read('semantic.md'),
    read('procedural.md'),
    read('episodic.md'),
  ]);
  return { goal, semantic, procedural, episodic };
}

export function getRecentEpisodes(episodic: string, n: number): string {
  const sections = episodic.split('\n---\n').filter(Boolean);
  return sections.slice(-n).join('\n---\n');
}

export interface EpisodicEntry {
  timestamp: string;
  iteration: number;
  action: string;
  priority: number;
  result: 'success' | 'failed';
  learning: string;
}

export async function appendEpisodic(
  memoryDir: string,
  entry: EpisodicEntry
): Promise<void> {
  const text = `
## ${entry.timestamp} - Iteration #${entry.iteration}
**Action**: ${entry.action} (Priority: ${entry.priority.toFixed(2)})
**Result**: ${entry.result}
**Learning**: ${entry.learning}

---
`;
  await appendFile(join(memoryDir, 'episodic.md'), text, 'utf-8');
}

export async function updateMemoryFile(
  memoryDir: string,
  layer: 'semantic' | 'procedural',
  content: string
): Promise<void> {
  await appendFile(join(memoryDir, `${layer}.md`), content, 'utf-8');
}
```

**Step 4: 运行测试，确认通过**

```bash
npm test -- memory
```

Expected: PASS 4/4

**Step 5: Commit**

```bash
git add src/memory/manager.ts src/tests/memory.test.ts
git commit -m "feat: four-layer memory manager with init/load/append"
```

---

## Task 5: pi/client.ts

**Files:**
- Create: `src/pi/client.ts`

> 注意：此模块直接调用 LLM，不写单元测试。集成测试在 Task 11 验证。

**Step 1: 创建 pi/client.ts**

```typescript
// src/pi/client.ts
import { createAgentSession, SessionManager, createCodingTools, AuthStorage, ModelRegistry } from '@mariozechner/pi-coding-agent';
import { getModel } from '@mariozechner/pi-ai';
import { getConfig } from '../config.js';

function getConfiguredModel() {
  const { provider, model } = getConfig();
  const m = getModel(provider as any, model as any);
  if (!m) {
    throw new Error(`未知模型: ${provider}/${model}。请检查 RALPH_PROVIDER 和 RALPH_MODEL 环境变量。`);
  }
  return m;
}

async function collectTextOutput(
  session: Awaited<ReturnType<typeof createAgentSession>>['session']
): Promise<string> {
  return new Promise((resolve) => {
    let result = '';
    const unsubscribe = session.subscribe((event) => {
      if (
        event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta'
      ) {
        result += event.assistantMessageEvent.delta;
      }
      if (event.type === 'agent_end') {
        unsubscribe();
        resolve(result);
      }
    });
  });
}

/**
 * 纯推理调用：用于 DECIDE 和 REFLECT 阶段（无工具）
 */
export async function callLLM(prompt: string): Promise<string> {
  const authStorage = AuthStorage.create();
  const modelRegistry = new ModelRegistry(authStorage);

  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    model: getConfiguredModel(),
    tools: [],
    authStorage,
    modelRegistry,
  });

  const outputPromise = collectTextOutput(session);
  await session.prompt(prompt);
  return outputPromise;
}

/**
 * 带工具调用：用于 ACT 阶段（read, write, edit, bash）
 */
export async function callAgent(prompt: string): Promise<string> {
  const { workspaceDir } = getConfig();
  const authStorage = AuthStorage.create();
  const modelRegistry = new ModelRegistry(authStorage);

  const { session } = await createAgentSession({
    cwd: workspaceDir,
    sessionManager: SessionManager.inMemory(),
    model: getConfiguredModel(),
    tools: createCodingTools(workspaceDir),
    authStorage,
    modelRegistry,
  });

  const outputPromise = collectTextOutput(session);
  await session.prompt(prompt);
  return outputPromise;
}
```

**Step 2: 验证编译无错误**

```bash
npx tsc --noEmit
```

Expected: 无错误

**Step 3: Commit**

```bash
git add src/pi/client.ts
git commit -m "feat: pi-coding-agent SDK wrapper (callLLM + callAgent)"
```

---

## Task 6: states/sense.ts + 测试

**Files:**
- Create: `src/states/sense.ts`
- Create: `src/tests/sense.test.ts`

**Step 1: 写失败测试**

```typescript
// src/tests/sense.test.ts
import { describe, it, expect } from 'vitest';
import { buildContext } from '../states/sense.js';
import type { FourLayerMemory } from '../types.js';

const mockMemory: FourLayerMemory = {
  goal: '# Goal\n完成任务',
  semantic: '# Semantic Memory\n项目类型: TypeScript',
  procedural: '# Procedural Memory\n先写测试',
  episodic: '# Episodic Memory\n\n## 2026-03-04 - Iteration #1\n**Action**: 初始化项目\n---',
};

describe('buildContext', () => {
  it('includes all four memory layers', () => {
    const context = buildContext(mockMemory, 'git status: clean\nfiles: 3');
    expect(context.goal).toContain('完成任务');
    expect(context.semantic).toContain('TypeScript');
    expect(context.procedural).toContain('先写测试');
    expect(context.recentEpisodes).toContain('初始化项目');
  });

  it('includes project state', () => {
    const context = buildContext(mockMemory, 'git status: 2 modified files');
    expect(context.projectState).toContain('2 modified files');
  });

  it('limits recent episodes to last 10', () => {
    // 生成 15 条 episode
    const manyEpisodes = Array.from({ length: 15 }, (_, i) =>
      `## ts - Iteration #${i + 1}\n**Action**: 动作${i + 1}\n---`
    ).join('\n');
    const memory = { ...mockMemory, episodic: `# Episodic Memory\n\n${manyEpisodes}` };
    const context = buildContext(memory, '');
    // 只包含最近10条，不包含最早的
    expect(context.recentEpisodes).not.toContain('动作1');
    expect(context.recentEpisodes).toContain('动作15');
  });
});
```

**Step 2: 运行测试，确认失败**

```bash
npm test -- sense
```

Expected: FAIL

**Step 3: 实现 states/sense.ts**

```typescript
// src/states/sense.ts
import { execSync } from 'child_process';
import { getRecentEpisodes } from '../memory/manager.js';
import type { FourLayerMemory, Context } from '../types.js';
import { getConfig } from '../config.js';

export function buildContext(memory: FourLayerMemory, projectState: string): Context {
  return {
    goal: memory.goal,
    semantic: memory.semantic,
    procedural: memory.procedural,
    recentEpisodes: getRecentEpisodes(memory.episodic, 10),
    projectState,
  };
}

export async function sense(memory: FourLayerMemory): Promise<Context> {
  const { workspaceDir } = getConfig();

  let projectState = '';
  try {
    const gitStatus = execSync('git status --short', {
      cwd: workspaceDir,
      encoding: 'utf-8',
      timeout: 5000,
    });
    const recentFiles = execSync('ls -lt | head -10', {
      cwd: workspaceDir,
      encoding: 'utf-8',
      timeout: 5000,
    });
    projectState = `Git Status:\n${gitStatus}\nRecent Files:\n${recentFiles}`;
  } catch {
    projectState = '（无法获取项目状态）';
  }

  return buildContext(memory, projectState);
}
```

**Step 4: 运行测试，确认通过**

```bash
npm test -- sense
```

Expected: PASS 3/3

**Step 5: Commit**

```bash
git add src/states/sense.ts src/tests/sense.test.ts
git commit -m "feat: SENSE state - context assembly from four-layer memory"
```

---

## Task 7: states/decide.ts + 测试

**Files:**
- Create: `src/states/decide.ts`
- Create: `src/tests/decide.test.ts`

**Step 1: 写失败测试**

```typescript
// src/tests/decide.test.ts
import { describe, it, expect } from 'vitest';
import { calculatePriority, buildDecidePrompt, parseDecision } from '../states/decide.js';
import type { Candidate, Context } from '../types.js';

const mockContext: Context = {
  goal: '# Goal\n完成项目',
  semantic: '# Semantic Memory',
  procedural: '# Procedural Memory',
  recentEpisodes: '',
  projectState: 'clean',
};

const mockCandidate: Candidate = {
  action: '修复类型错误',
  impact: 4,
  urgency: 3,
  confidence: 0.9,
  reasoning: '类型错误阻碍编译',
};

describe('calculatePriority', () => {
  it('computes impact * urgency * confidence', () => {
    expect(calculatePriority(mockCandidate)).toBeCloseTo(4 * 3 * 0.9);
  });
});

describe('buildDecidePrompt', () => {
  it('contains all context sections', () => {
    const prompt = buildDecidePrompt(mockContext);
    expect(prompt).toContain('完成项目');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('stopReason');
  });
});

describe('parseDecision', () => {
  it('parses valid JSON response', () => {
    const response = JSON.stringify({
      candidates: [mockCandidate],
      selected: mockCandidate,
      stopReason: null,
    });
    const decision = parseDecision(response, 1);
    expect(decision.selected.action).toBe('修复类型错误');
    expect(decision.priority).toBeCloseTo(4 * 3 * 0.9);
    expect(decision.stopReason).toBeNull();
  });

  it('parses stop reason', () => {
    const response = JSON.stringify({
      candidates: [],
      selected: mockCandidate,
      stopReason: '目标已达成',
    });
    const decision = parseDecision(response, 1);
    expect(decision.stopReason).toBe('目标已达成');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseDecision('not json', 1)).toThrow();
  });
});
```

**Step 2: 运行测试，确认失败**

```bash
npm test -- decide
```

Expected: FAIL

**Step 3: 实现 states/decide.ts**

```typescript
// src/states/decide.ts
import { callLLM } from '../pi/client.js';
import type { Candidate, Context, Decision } from '../types.js';

export function calculatePriority(c: Candidate): number {
  return c.impact * c.urgency * c.confidence;
}

export function buildDecidePrompt(context: Context): string {
  return `你是 Ralph 的决策引擎。根据当前上下文，决定下一步最优行动。

## 当前目标
${context.goal}

## 项目知识
${context.semantic}

## 经验模式
${context.procedural}

## 近期迭代
${context.recentEpisodes || '（无历史记录）'}

## 当前项目状态
${context.projectState}

## 任务
1. 生成 1-3 个候选行动
2. 为每个候选计算 Priority = Impact(1-5) × Urgency(1-5) × Confidence(0.1-1.0)
3. 选择 Priority 最高的行动
4. 如果目标已全部达成，或确认无法达成，输出 stopReason

## 输出格式（仅输出 JSON，不要有其他文字）
{
  "candidates": [
    {
      "action": "行动描述",
      "impact": 1-5,
      "urgency": 1-5,
      "confidence": 0.1-1.0,
      "reasoning": "为什么这个行动重要"
    }
  ],
  "selected": { ...同上格式 },
  "stopReason": null
}

stopReason 可以是: null | "目标已达成" | "目标无法达成: <原因>"
`;
}

export function parseDecision(response: string, iteration: number): Decision {
  // 提取 JSON（有时 LLM 会包裹在 markdown 代码块中）
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`DECIDE 响应无法解析为 JSON: ${response.slice(0, 200)}`);

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    candidates: parsed.candidates,
    selected: parsed.selected,
    priority: calculatePriority(parsed.selected),
    stopReason: parsed.stopReason || null,
  };
}

export async function decide(context: Context, iteration: number): Promise<Decision> {
  const prompt = buildDecidePrompt(context);
  const response = await callLLM(prompt);
  return parseDecision(response, iteration);
}
```

**Step 4: 运行测试，确认通过**

```bash
npm test -- decide
```

Expected: PASS 5/5

**Step 5: Commit**

```bash
git add src/states/decide.ts src/tests/decide.test.ts
git commit -m "feat: DECIDE state - priority scoring and stop condition"
```

---

## Task 8: states/act.ts + 测试

**Files:**
- Create: `src/states/act.ts`
- Create: `src/tests/act.test.ts`

**Step 1: 写失败测试**

```typescript
// src/tests/act.test.ts
import { describe, it, expect } from 'vitest';
import { buildActPrompt, parseActResult } from '../states/act.js';
import type { Candidate } from '../types.js';

const mockAction: Candidate = {
  action: '运行 npm test 检查测试状态',
  impact: 4,
  urgency: 3,
  confidence: 0.9,
  reasoning: '需要确认当前测试是否通过',
};

describe('buildActPrompt', () => {
  it('contains action description', () => {
    const prompt = buildActPrompt(mockAction);
    expect(prompt).toContain('运行 npm test 检查测试状态');
    expect(prompt).toContain('需要确认当前测试是否通过');
  });
});

describe('parseActResult', () => {
  it('marks success when no ERROR keyword', () => {
    const result = parseActResult('Tests passed: 5/5');
    expect(result.success).toBe(true);
    expect(result.output).toBe('Tests passed: 5/5');
  });

  it('marks failure when ERROR keyword present', () => {
    const result = parseActResult('ERROR: compilation failed');
    expect(result.success).toBe(false);
  });
});
```

**Step 2: 运行测试，确认失败**

```bash
npm test -- act
```

Expected: FAIL

**Step 3: 实现 states/act.ts**

```typescript
// src/states/act.ts
import { callAgent } from '../pi/client.js';
import type { ActResult, Candidate } from '../types.js';

export function buildActPrompt(action: Candidate): string {
  return `你是 Ralph 的执行引擎。执行以下具体行动：

## 要执行的行动
${action.action}

## 背景
${action.reasoning}

## 要求
- 使用可用工具（read, write, edit, bash）完成行动
- 如遇错误，尝试修复后继续
- 完成后输出执行结果摘要
`;
}

export function parseActResult(output: string): ActResult {
  return {
    success: !output.includes('ERROR') && !output.includes('FAILED'),
    output,
  };
}

export async function act(action: Candidate): Promise<ActResult> {
  const prompt = buildActPrompt(action);
  const output = await callAgent(prompt);
  return parseActResult(output);
}
```

**Step 4: 运行测试，确认通过**

```bash
npm test -- act
```

Expected: PASS 3/3

**Step 5: Commit**

```bash
git add src/states/act.ts src/tests/act.test.ts
git commit -m "feat: ACT state - agent execution via pi-coding-agent SDK"
```

---

## Task 9: states/reflect.ts + 测试

**Files:**
- Create: `src/states/reflect.ts`
- Create: `src/tests/reflect.test.ts`

**Step 1: 写失败测试**

```typescript
// src/tests/reflect.test.ts
import { describe, it, expect } from 'vitest';
import { buildReflectPrompt, parseReflection } from '../states/reflect.js';
import type { Context, Decision, ActResult, Candidate } from '../types.js';

const mockContext: Context = {
  goal: '# Goal\n完成项目',
  semantic: '',
  procedural: '',
  recentEpisodes: '',
  projectState: '',
};

const mockCandidate: Candidate = {
  action: '修复类型错误',
  impact: 4,
  urgency: 3,
  confidence: 0.9,
  reasoning: '阻碍编译',
};

const mockDecision: Decision = {
  candidates: [mockCandidate],
  selected: mockCandidate,
  priority: 10.8,
  stopReason: null,
};

const mockResult: ActResult = {
  success: true,
  output: '类型错误已修复，tsc 编译成功',
};

describe('buildReflectPrompt', () => {
  it('contains action and result', () => {
    const prompt = buildReflectPrompt(mockContext, mockDecision, mockResult);
    expect(prompt).toContain('修复类型错误');
    expect(prompt).toContain('tsc 编译成功');
    expect(prompt).toContain('JSON');
  });
});

describe('parseReflection', () => {
  it('parses valid reflection response', () => {
    const response = JSON.stringify({
      patterns: ['编译前先运行 tsc 检查'],
      antiPatterns: [],
      learning: '类型错误应尽早修复',
    });
    const reflection = parseReflection(response);
    expect(reflection.patterns).toHaveLength(1);
    expect(reflection.patterns[0]).toContain('tsc');
    expect(reflection.learning).toContain('类型错误');
  });

  it('handles empty patterns', () => {
    const response = JSON.stringify({
      patterns: [],
      antiPatterns: [],
      learning: '无特殊发现',
    });
    const reflection = parseReflection(response);
    expect(reflection.patterns).toHaveLength(0);
  });
});
```

**Step 2: 运行测试，确认失败**

```bash
npm test -- reflect
```

Expected: FAIL

**Step 3: 实现 states/reflect.ts**

```typescript
// src/states/reflect.ts
import { callLLM } from '../pi/client.js';
import { appendEpisodic, updateMemoryFile } from '../memory/manager.js';
import type { ActResult, Context, Decision } from '../types.js';
import { getConfig } from '../config.js';

export interface Reflection {
  patterns: string[];
  antiPatterns: string[];
  learning: string;
}

export function buildReflectPrompt(
  context: Context,
  decision: Decision,
  result: ActResult
): string {
  return `你是 Ralph 的反思引擎。分析本轮迭代，提取可复用的经验。

## 本轮行动
${decision.selected.action}（Priority: ${decision.priority.toFixed(2)}）

## 执行结果
成功: ${result.success}
输出:
${result.output.slice(0, 2000)}

## 当前目标
${context.goal}

## 任务
分析本轮迭代，提取经验教训。

## 输出格式（仅输出 JSON，不要有其他文字）
{
  "patterns": ["成功经验1（可选，没有则为空数组）"],
  "antiPatterns": ["失败教训1（可选，没有则为空数组）"],
  "learning": "本轮最重要的一句话总结"
}
`;
}

export function parseReflection(response: string): Reflection {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`REFLECT 响应无法解析为 JSON: ${response.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]);
}

export async function reflect(
  context: Context,
  decision: Decision,
  result: ActResult,
  iteration: number,
  memoryDir: string
): Promise<void> {
  const prompt = buildReflectPrompt(context, decision, result);
  const response = await callLLM(prompt);
  const reflection = parseReflection(response);

  if (reflection.patterns.length > 0) {
    await updateMemoryFile(memoryDir, 'semantic', `\n${reflection.patterns.map(p => `- ${p}`).join('\n')}`);
  }

  if (reflection.antiPatterns.length > 0) {
    await updateMemoryFile(memoryDir, 'procedural', `\n${reflection.antiPatterns.map(p => `- ${p}`).join('\n')}`);
  }

  await appendEpisodic(memoryDir, {
    timestamp: new Date().toISOString(),
    iteration,
    action: decision.selected.action,
    priority: decision.priority,
    result: result.success ? 'success' : 'failed',
    learning: reflection.learning,
  });
}
```

**Step 4: 运行测试，确认通过**

```bash
npm test -- reflect
```

Expected: PASS 3/3

**Step 5: Commit**

```bash
git add src/states/reflect.ts src/tests/reflect.test.ts
git commit -m "feat: REFLECT state - pattern extraction and memory update"
```

---

## Task 10: loop.ts + 测试

**Files:**
- Create: `src/loop.ts`
- Create: `src/tests/loop.test.ts`

**Step 1: 写失败测试**

```typescript
// src/tests/loop.test.ts
import { describe, it, expect, vi } from 'vitest';
import { shouldStop } from '../loop.js';

describe('shouldStop', () => {
  it('returns true when maxIterations reached', () => {
    expect(shouldStop(100, { maxIterations: 100, once: false, memoryDir: '', workspaceDir: '' })).toBe(true);
  });

  it('returns false when under maxIterations', () => {
    expect(shouldStop(50, { maxIterations: 100, once: false, memoryDir: '', workspaceDir: '' })).toBe(false);
  });

  it('returns true when once mode and iteration > 1', () => {
    expect(shouldStop(2, { maxIterations: 100, once: true, memoryDir: '', workspaceDir: '' })).toBe(true);
  });

  it('returns false when once mode and iteration === 1', () => {
    expect(shouldStop(1, { maxIterations: 100, once: true, memoryDir: '', workspaceDir: '' })).toBe(false);
  });
});
```

**Step 2: 运行测试，确认失败**

```bash
npm test -- loop
```

Expected: FAIL

**Step 3: 实现 loop.ts**

```typescript
// src/loop.ts
import { loadMemory } from './memory/manager.js';
import { sense } from './states/sense.js';
import { decide } from './states/decide.js';
import { act } from './states/act.js';
import { reflect } from './states/reflect.js';
import type { LoopOptions } from './types.js';

export function shouldStop(iteration: number, options: LoopOptions): boolean {
  if (iteration > options.maxIterations) return true;
  if (options.once && iteration > 1) return true;
  return false;
}

export async function runLoop(options: LoopOptions): Promise<void> {
  const memory = await loadMemory(options.memoryDir);
  let iteration = 0;

  // 优雅退出处理
  let interrupted = false;
  process.on('SIGINT', () => {
    console.log('\n\n收到中断信号，完成当前迭代后退出...');
    interrupted = true;
  });

  while (!interrupted) {
    iteration++;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Iteration #${iteration}`);
    console.log('='.repeat(50));

    try {
      // SENSE
      console.log('\n[SENSE] 读取上下文...');
      const context = await sense(memory);

      // DECIDE
      console.log('\n[DECIDE] 分析决策...');
      const decision = await decide(context, iteration);

      if (decision.stopReason) {
        console.log(`\n✓ 循环结束: ${decision.stopReason}`);
        break;
      }

      console.log(`\n决策: ${decision.selected.action}`);
      console.log(`优先级: ${decision.priority.toFixed(2)}`);

      // ACT
      console.log('\n[ACT] 执行行动...');
      const result = await act(decision.selected);
      console.log(`结果: ${result.success ? '成功' : '失败'}`);

      // REFLECT
      console.log('\n[REFLECT] 提取经验...');
      await reflect(context, decision, result, iteration, options.memoryDir);

      // 重新加载记忆（REFLECT 可能更新了文件）
      const updatedMemory = await loadMemory(options.memoryDir);
      Object.assign(memory, updatedMemory);

    } catch (error) {
      const err = error as Error;
      console.error(`\n[ERROR] 迭代 #${iteration} 出错: ${err.message}`);
      // 可恢复错误：记录并继续
      iteration++; // 防止死循环
    }

    if (shouldStop(iteration, options)) {
      console.log(`\n达到停止条件（迭代 ${iteration}/${options.maxIterations}）`);
      break;
    }
  }
}
```

**Step 4: 运行测试，确认通过**

```bash
npm test -- loop
```

Expected: PASS 4/4

**Step 5: 运行所有测试**

```bash
npm test
```

Expected: 全部 PASS

**Step 6: Commit**

```bash
git add src/loop.ts src/tests/loop.test.ts
git commit -m "feat: main loop with SENSE-DECIDE-ACT-REFLECT cycle"
```

---

## Task 11: index.ts（CLI 入口）

**Files:**
- Create: `src/index.ts`

**Step 1: 实现 CLI 入口**

```typescript
// src/index.ts
import { Command } from 'commander';
import { runLoop } from './loop.js';
import { initMemory } from './memory/manager.js';
import { getConfig } from './config.js';

const program = new Command();

program
  .name('ralph')
  .description('ReAct + Reflection 自主 Agent')
  .version('0.1.0');

program
  .command('run', { isDefault: true })
  .description('启动 Agent 循环')
  .option('--once', '只执行一次迭代', false)
  .option('--max-iterations <n>', '最大迭代次数', '100')
  .action(async (options) => {
    const config = getConfig();
    const memoryDir = `${config.workspaceDir}/memory`;

    console.log(`Ralph 启动`);
    console.log(`模型: ${config.provider}/${config.model}`);
    console.log(`Workspace: ${config.workspaceDir}`);
    console.log(`记忆目录: ${memoryDir}`);

    await runLoop({
      maxIterations: parseInt(options.maxIterations),
      once: options.once,
      memoryDir,
      workspaceDir: config.workspaceDir,
    });
  });

program
  .command('init')
  .description('初始化记忆文件（在 workspace/memory/ 下创建模板）')
  .action(async () => {
    const config = getConfig();
    const memoryDir = `${config.workspaceDir}/memory`;
    await initMemory(memoryDir);
    console.log(`✓ 记忆文件已初始化: ${memoryDir}`);
    console.log(`  请编辑 goal.md 填写你的目标，然后运行 ralph 启动 Agent。`);
  });

program.parse();
```

**Step 2: 构建**

```bash
npm run build
```

Expected: `dist/` 目录出现，无编译错误。

**Step 3: 验证 CLI 帮助信息**

```bash
node dist/index.js --help
node dist/index.js init --help
```

Expected: 显示帮助信息，命令列表正确。

**Step 4: 冒烟测试 init 命令（无需 API key）**

```bash
mkdir -p /tmp/ralph-test-workspace
RALPH_WORKSPACE=/tmp/ralph-test-workspace node dist/index.js init
ls /tmp/ralph-test-workspace/memory/
```

Expected: 显示 `goal.md  semantic.md  procedural.md  episodic.md`

**Step 5: 清理**

```bash
rm -rf /tmp/ralph-test-workspace
```

**Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat: CLI entry point with run and init commands"
```

---

## Task 12: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Step 1: 创建 .dockerignore**

```
node_modules
dist
*.log
.git
```

**Step 2: 创建 Dockerfile**

```dockerfile
FROM node:22-alpine

WORKDIR /app

# 安装依赖（利用 layer 缓存）
COPY package*.json ./
RUN npm ci --only=production

# 复制源码并构建
COPY . .
RUN npm install --include=dev && npm run build

# 工作目录（运行时挂载）
WORKDIR /workspace

ENTRYPOINT ["node", "/app/dist/index.js"]
CMD ["run"]
```

**Step 3: 构建镜像**

```bash
cd /data/dev/XIOMAN-Ralph && docker build -t ralph .
```

Expected: 构建成功，最后输出 `Successfully tagged ralph:latest`

**Step 4: 测试 init 命令（无需 API key）**

```bash
mkdir -p /tmp/ralph-workspace
docker run --rm \
  -v /tmp/ralph-workspace:/workspace \
  ralph init
```

Expected: 输出 `✓ 记忆文件已初始化`

**Step 5: 验证文件创建**

```bash
ls /tmp/ralph-workspace/memory/
```

Expected: `goal.md  semantic.md  procedural.md  episodic.md`

**Step 6: 清理**

```bash
rm -rf /tmp/ralph-workspace
```

**Step 7: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: Dockerfile for containerized deployment"
```

---

## 最终验证

**运行所有测试**

```bash
npm test
```

Expected: 全部 PASS，无跳过。

**完整构建并验证**

```bash
npm run build && node dist/index.js --help
```

Expected: 编译成功，显示 CLI 帮助。

---

## 集成测试（需要 API key）

> 以下测试需要真实的 API key，建议手动执行一次验证。

```bash
mkdir -p /tmp/ralph-integration
docker run --rm \
  -v /tmp/ralph-integration:/workspace \
  ralph init

# 编辑 goal.md 填入测试目标（例如：创建一个 hello.txt 文件）
echo '# Goal\n\n创建 hello.txt 文件，内容为 "Hello, Ralph!"\n\n## Success Criteria\n- [ ] hello.txt 存在\n- [ ] 内容正确' \
  > /tmp/ralph-integration/memory/goal.md

# 运行一次迭代
docker run --rm \
  -v /tmp/ralph-integration:/workspace \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  ralph run --once

# 验证结果
ls /tmp/ralph-integration/
cat /tmp/ralph-integration/memory/episodic.md
```
