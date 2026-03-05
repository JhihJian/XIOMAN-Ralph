# Ralph 实现设计文档

> 基于 pi-coding-agent SDK 实现的 ReAct + Reflection 自主 Agent，打包为 Docker 容器

## 概述

| 维度 | 选择 |
|------|------|
| **形态** | 独立 TypeScript CLI 工具，打包为 Docker 容器 |
| **大脑** | pi-coding-agent SDK（直接调用 LLM API，支持多模型） |
| **记忆系统** | 四个 Markdown 文件，人类可读 |
| **反思触发** | 每次迭代必反思 |
| **循环控制** | 智能停止（LLM 判断目标已达成/无法达成） |
| **优先级公式** | LLM 评分 + 代码计算 |

## 项目结构

```
ralph/
├── src/
│   ├── index.ts                # CLI 入口，参数解析
│   ├── loop.ts                 # 主循环：SENSE→DECIDE→ACT→REFLECT
│   ├── types.ts                # 类型定义
│   ├── config.ts               # 模型配置（从环境变量读取）
│   ├── states/
│   │   ├── sense.ts            # SENSE 状态处理器
│   │   ├── decide.ts           # DECIDE 状态处理器
│   │   ├── act.ts              # ACT 状态处理器
│   │   └── reflect.ts          # REFLECT 状态处理器
│   ├── memory/
│   │   └── manager.ts          # 四层记忆文件读写
│   ├── pi/
│   │   └── client.ts           # pi-coding-agent SDK 调用封装
│   └── logger.ts               # 日志输出
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

**依赖**：
- `@mariozechner/pi-coding-agent`（包含 pi-agent-core 和 pi-ai）
- `commander`（CLI 参数解析）+ TypeScript 工具链

**CLI 命令（容器化）**：
```bash
# 初始化记忆文件
docker run -v $(pwd):/workspace ralph --init

# 持续运行模式
docker run -v $(pwd):/workspace \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  ralph

# 单次迭代
docker run -v $(pwd):/workspace \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  ralph --once
```

## 容器与 Workspace

```bash
docker run \
  -v $(pwd):/workspace \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e RALPH_PROVIDER=anthropic \        # 可选，默认 anthropic
  -e RALPH_MODEL=claude-sonnet-4-5 \   # 可选，默认 claude-sonnet-4-5
  ralph
```

容器内目录结构：

```
/workspace/              # 挂载自宿主机当前目录
├── memory/
│   ├── goal.md          # 用户编写，Ralph 只读
│   ├── semantic.md      # Ralph 维护
│   ├── procedural.md    # Ralph 维护
│   └── episodic.md      # Ralph 追加
└── <项目代码>            # ACT 阶段可以读写
```

ACT 阶段的所有工具（read/write/edit/bash）以 `/workspace` 为根，不越界到容器外。

## 模型配置

```typescript
// src/config.ts
export const config = {
  provider: process.env.RALPH_PROVIDER ?? 'anthropic',
  model:    process.env.RALPH_MODEL    ?? 'claude-sonnet-4-5',
};
```

支持 pi-ai 的所有提供商：Anthropic、OpenAI、Google、GitHub Copilot 等 20+ 个。API key 通过标准环境变量传入（`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等），pi-coding-agent 的 `AuthStorage` 自动读取。

## pi SDK 调用封装

```typescript
// src/pi/client.ts

import { createAgentSession, SessionManager, createCodingTools } from '@mariozechner/pi-coding-agent';
import { getModel } from '@mariozechner/pi-ai';
import { config } from '../config';

function getConfiguredModel() {
  const model = getModel(config.provider, config.model);
  if (!model) throw new Error(`未知模型: ${config.provider}/${config.model}`);
  return model;
}

async function collectOutput(session: AgentSession): Promise<string> {
  let result = '';
  const unsubscribe = session.subscribe((event) => {
    if (event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta') {
      result += event.assistantMessageEvent.delta;
    }
  });
  // unsubscribe 在调用方 await prompt 后调用
  return result; // 通过闭包持续追加
}

// DECIDE/REFLECT：纯推理，无工具
export async function callLLM(prompt: string): Promise<string> {
  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    model: getConfiguredModel(),
    tools: [],
  });

  let result = '';
  session.subscribe((event) => {
    if (event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta') {
      result += event.assistantMessageEvent.delta;
    }
  });

  await session.prompt(prompt);
  return result;
}

// ACT：完整工具集（read, write, edit, bash）
export async function callAgent(prompt: string): Promise<string> {
  const cwd = '/workspace';
  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    model: getConfiguredModel(),
    tools: createCodingTools(cwd),
  });

  let result = '';
  session.subscribe((event) => {
    if (event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta') {
      result += event.assistantMessageEvent.delta;
    }
  });

  await session.prompt(prompt);
  return result;
}
```

**各状态调用方式：**

| 状态 | 调用函数 | 工具 |
|------|----------|------|
| SENSE | `callLLM()` | 无（或直接读文件，不经过 LLM） |
| DECIDE | `callLLM()` | 无，纯推理 |
| ACT | `callAgent()` | read, write, edit, bash |
| REFLECT | `callLLM()` | 无，纯推理 |

每次调用都是 Fresh Context（`SessionManager.inMemory()`），不会累积对话历史。

## 核心循环实现

```typescript
// src/loop.ts

interface LoopState {
  iteration: number;
  memory: FourLayerMemory;
}

interface IterationResult {
  type: 'success' | 'stopped' | 'recovered' | 'retry';
  reason?: string;
  error?: Error;
}

async function runLoop(options: LoopOptions): Promise<void> {
  const memory = await loadMemory('/workspace/memory');
  let iteration = 0;

  while (true) {
    iteration++;
    console.log(`\n=== Iteration #${iteration} ===`);

    const result = await runIteration(memory, iteration);

    if (result.type === 'stopped') {
      console.log(`\n停止: ${result.reason}`);
      break;
    }

    if (iteration >= options.maxIterations) {
      console.log(`\n达到最大迭代次数 ${options.maxIterations}`);
      break;
    }
  }
}

async function runIteration(
  memory: FourLayerMemory,
  iteration: number
): Promise<IterationResult> {
  try {
    const context = await sense(memory);
    const decision = await decide(context);

    if (decision.stopReason) {
      return { type: 'stopped', reason: decision.stopReason };
    }

    const result = await act(decision.action);
    await reflect(context, decision, result, memory);

    return { type: 'success' };

  } catch (error) {
    if (isRecoverable(error)) {
      await appendEpisodic(memory, {
        error: error.message,
        learning: '需要处理这个边界情况'
      });
      return { type: 'recovered', error };
    }
    throw error;
  }
}
```

## Dockerfile

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

WORKDIR /workspace
ENTRYPOINT ["node", "/app/dist/index.js"]
```

## 四层记忆系统

```
memory/
├── goal.md          # 意图层：用户定义的目标（只读）
├── semantic.md      # 语义层：长期知识 + 概念
├── procedural.md    # 程序层：成功模式 + Anti-Pattern
└── episodic.md      # 情景层：迭代历史记录（追加）
```

**goal.md（用户编写，框架只读）：**

```markdown
# Goal

构建一个 TypeScript CLI 工具，实现持续运行的自主 Agent。

## Success Criteria
- [ ] 能够读取四层记忆
- [ ] 能够自主决策下一步行动
- [ ] 能够从失败中学习

## Constraints
- 记忆文件必须人类可读
```

**更新策略**：
- `goal.md`：用户手动编辑，Agent 只读
- `semantic.md` / `procedural.md`：REFLECT 阶段更新
- `episodic.md`：每次迭代追加

## 状态机详解

| 状态 | 输入 | 输出 | 职责 |
|------|------|------|------|
| SENSE | 四层记忆文件 | `Context` 对象 | 汇总当前状态 |
| DECIDE | `Context` | `Decision` (含 stopReason) | 生成候选 + 计算优先级 + 判断停止 |
| ACT | `Action` | `Result` | callAgent() 执行 |
| REFLECT | 上述全部 | 更新记忆文件 | 提取 Pattern + 写入 episodic |

### SENSE 阶段

```typescript
interface Context {
  goal: string;
  semantic: string;
  procedural: string;
  recentEpisodes: string;
  projectState: string;
}

async function sense(memory: FourLayerMemory): Promise<Context> {
  const { execSync } = await import('child_process');
  const gitStatus = execSync('git status --short', { cwd: '/workspace' }).toString();
  const recentFiles = execSync('ls -lt | head -10', { cwd: '/workspace' }).toString();

  return {
    goal: memory.goal,
    semantic: memory.semantic,
    procedural: memory.procedural,
    recentEpisodes: getRecentEpisodes(memory.episodic, 10),
    projectState: `Git Status:\n${gitStatus}\n\nRecent Files:\n${recentFiles}`
  };
}
```

### DECIDE 阶段

```typescript
interface Candidate {
  action: string;
  impact: number;      // 1-5
  urgency: number;     // 1-5
  confidence: number;  // 0.1-1.0
  reasoning: string;
}

interface Decision {
  candidates: Candidate[];
  selected: Candidate;
  priority: number;    // impact * urgency * confidence
  stopReason: string | null;
}

async function decide(context: Context): Promise<Decision> {
  const prompt = buildDecidePrompt(context);
  const response = await callLLM(prompt);
  const parsed = JSON.parse(response);

  return {
    candidates: parsed.candidates,
    selected: parsed.selected,
    priority: calculatePriority(parsed.selected),
    stopReason: parsed.stopReason || null
  };
}

function calculatePriority(c: Candidate): number {
  return c.impact * c.urgency * c.confidence;
}
```

**Prompt 模板（DECIDE 阶段）：**

```
你是 Ralph 的决策引擎。

## 当前上下文
${context}

## 任务
1. 生成 1-3 个候选行动
2. 为每个候选计算 Priority = Impact × Urgency × Confidence
3. 选择 Priority 最高的行动
4. 如果目标已达成或无法达成，输出 stopReason

## 输出格式（JSON）
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
  "selected": { ... },
  "stopReason": null | "目标已达成" | "目标无法达成: 原因"
}
```

### ACT 阶段

```typescript
interface ActResult {
  success: boolean;
  output: string;
  filesChanged: string[];
}

async function act(action: Candidate): Promise<ActResult> {
  const prompt = buildActPrompt(action);
  const response = await callAgent(prompt);

  return {
    success: !response.includes('ERROR'),
    output: response,
    filesChanged: extractFilesChanged(response)
  };
}
```

### REFLECT 阶段

```typescript
async function reflect(
  context: Context,
  decision: Decision,
  result: ActResult,
  memory: FourLayerMemory
): Promise<void> {
  const prompt = buildReflectPrompt(context, decision, result);
  const response = await callLLM(prompt);
  const reflection = JSON.parse(response);

  if (reflection.patterns.length > 0) {
    await appendToMemory(memory, 'semantic', reflection.patterns);
  }

  if (reflection.antiPatterns.length > 0) {
    await appendToMemory(memory, 'procedural', reflection.antiPatterns);
  }

  await appendToMemory(memory, 'episodic', {
    timestamp: new Date().toISOString(),
    iteration: decision.iteration,
    action: decision.selected.action,
    priority: decision.priority,
    result: result.success ? 'success' : 'failed',
    learning: reflection.learning
  });
}
```

## 错误处理

| 错误类型 | 示例 | 处理方式 |
|----------|------|----------|
| **可恢复** | bash 命令失败、文件不存在 | 记录到 episodic，继续下一轮迭代 |
| **需重试** | API 超时、网络错误 | 等待后重试，最多 3 次 |
| **致命** | goal.md 不存在、内存溢出 | 输出错误信息，退出程序 |

**边界情况**：
- **迭代次数上限**：默认 100 次，防止意外无限循环
- **信号处理**：捕获 `SIGINT`，优雅退出并保存状态

## MVP 范围与实现优先级

### Phase 1 - 最小可用版本（MVP）

```
目标：跑通一个完整的 SENSE → DECIDE → ACT → REFLECT 循环

✅ 必须有：
  - CLI 入口 + 基本参数解析
  - 四层记忆文件读写
  - 简单的主循环（无错误恢复）
  - DECIDE 阶段的停止判断
  - pi-coding-agent SDK 调用（callLLM + callAgent）
  - Dockerfile

❌ 暂不做：
  - 错误重试机制
  - 文件锁
  - 复杂的日志系统
```

### Phase 2 - 稳定性

```
- 错误处理与重试
- 迭代次数上限
- 信号处理（Ctrl+C 优雅退出）
```

### Phase 3 - 增强

```
- verbose 日志模式
- 记忆文件压缩（episodic 太大时摘要）
- 用户中断后恢复（从上次状态继续）
```

### 文件实现顺序

```
1. types.ts          # 类型定义
2. config.ts         # 模型配置
3. memory/manager.ts # 记忆读写
4. pi/client.ts      # pi SDK 调用
5. states/sense.ts   # SENSE 状态
6. states/decide.ts  # DECIDE 状态
7. states/act.ts     # ACT 状态
8. states/reflect.ts # REFLECT 状态
9. loop.ts           # 主循环
10. index.ts         # CLI 入口
11. Dockerfile       # 容器打包
```

## 架构概览

| 模块 | 职责 | 实现 |
|------|------|------|
| **CLI** | 入口、参数解析 | commander |
| **Loop** | 主循环控制 | 自建 |
| **States** | 四个状态处理器 | 自建 |
| **Memory** | 四层记忆管理 | 自建（文件读写） |
| **Pi Client** | LLM 调用封装 | pi-coding-agent SDK |
| **Logger** | 终端输出 | console |
| **Container** | 独立部署 | Docker |
