# OpenClaw Agent 架构学习笔记

> **来源**: `~/openclaw/src/agents/` 源码研究
> **日期**: 2026-03-04
> **状态**: 未来增强候选（MVP 后）

---

## 概述

本文档记录从开源项目 openclaw 的 agent 实现中学到的设计模式，可作为 Ralph 项目 MVP 后的增强方向参考。

---

## 1. Agent 生命周期管理

**参考文件**: `agent-scope.ts`

### OpenClaw 实现

```typescript
// 每个 agent 有独立配置解析
resolveAgentConfig(cfg, agentId)

// 独立 workspace 隔离
resolveAgentWorkspaceDir(cfg, agentId) → $stateDir/workspace-{id}

// Agent 持久化目录
resolveAgentDir(cfg, agentId) → $stateDir/agents/{id}/agent
```

### Ralph 可借鉴

```typescript
// 未来：支持多 Ralph 实例隔离
function resolveRalphWorkspace(config: Config, instanceId: string): string {
  const baseDir = config.workspaceDir;
  return path.join(baseDir, `instance-${instanceId}`);
}

// 未来：每个实例独立的 agentDir
function resolveRalphAgentDir(config: Config, instanceId: string): string {
  return path.join(config.memoryDir, 'agents', instanceId);
}
```

### 适用场景

- 多目标并行执行（同时处理不同项目）
- 长期记忆隔离（不同项目不共享 episodic memory）

---

## 2. 运行循环保护机制

**参考文件**: `pi-embedded-runner/run.ts`

### OpenClaw 实现

```typescript
// 关键常量 - 防止无限循环
const BASE_RUN_RETRY_ITERATIONS = 24;
const MAX_RUN_LOOP_ITERATIONS = 160;

// 主循环模式
while (true) {
  if (runLoopIterations >= MAX_RUN_LOOP_ITERATIONS) {
    log.error(`Exceeded retry limit after ${runLoopIterations} attempts`);
    return { error: { kind: 'retry_limit', message: '...' } };
  }

  // ... 执行 agent 调用 ...

  // 明确的 stopReason 处理
  if (lastAssistant?.stopReason === 'error') {
    // 处理错误，可能重试
  }
}
```

### Ralph 可借鉴

当前 `loop.ts` 的 `shouldStop()` 较简单，建议增强：

```typescript
// 建议添加到 loop.ts
const MAX_RETRY_ITERATIONS = 50;
const CONSECUTIVE_ERROR_LIMIT = 5;

interface LoopState {
  iteration: number;
  consecutiveErrors: number;
  lastError?: { kind: string; message: string };
}

function shouldStop(state: LoopState, options: LoopOptions): boolean {
  if (state.iteration > options.maxIterations) return true;
  if (options.once && state.iteration > 1) return true;
  if (state.consecutiveErrors >= CONSECUTIVE_ERROR_LIMIT) return true;
  return false;
}
```

### 适用场景

- 防止 API 错误导致的死循环
- 更优雅的错误恢复机制

---

## 3. 混合搜索 Memory 系统

**参考文件**: `memory-search.ts`, `tools/memory-tool.ts`

### OpenClaw 实现

```typescript
// 向量 + 文本混合搜索配置
const hybrid = {
  enabled: true,
  vectorWeight: 0.7,
  textWeight: 0.3,
  mmr: {
    enabled: false,
    lambda: 0.7  // 0=最大化多样性, 1=最大化相关性
  },
  temporalDecay: {
    enabled: false,
    halfLifeDays: 30  // 30天后权重减半
  }
};

// 查询参数
const query = {
  maxResults: 6,
  minScore: 0.35  // 过滤低质量匹配
};
```

### Ralph 可借鉴

当前 Ralph 使用纯文本匹配，未来可增强：

```typescript
// 建议添加到 memory/manager.ts
interface MemorySearchOptions {
  maxResults: number;
  minScore: number;      // 0-1，过滤低质量
  temporalDecay: {
    enabled: boolean;
    halfLifeDays: number;  // 旧记忆权重衰减
  };
}

function searchMemory(
  query: string,
  memory: FourLayerMemory,
  options: MemorySearchOptions
): SearchResult[] {
  // 1. 文本匹配（当前实现）
  // 2. 计算相关度分数
  // 3. 应用时间衰减权重
  // 4. 过滤 minScore 以下的结果
}
```

### 适用场景

- Episodic memory 搜索时优先返回近期记录
- 语义相似度优于关键词匹配的场景

---

## 4. 多 Auth Profile 轮询

**参考文件**: `auth-profiles/`

### OpenClaw 实现

```typescript
// 多 API key 轮询
const profileCandidates = resolveAuthProfileOrder(cfg, agentId);

while (profileIndex < profileCandidates.length) {
  const candidate = profileCandidates[profileIndex];

  // 跳过冷却中的 profile
  if (isProfileInCooldown(authStore, candidate)) {
    profileIndex += 1;
    continue;
  }

  try {
    // 使用当前 profile
    const result = await callWithProfile(candidate);
    await markAuthProfileGood(authStore, candidate);
    return result;
  } catch (error) {
    // 标记失败，进入冷却
    await markAuthProfileFailure(authStore, candidate);
    profileIndex += 1;
  }
}
```

### Ralph 可借鉴

```typescript
// 建议添加到 config.ts
interface AuthProfile {
  id: string;
  provider: string;
  apiKey: string;
  lastUsed?: Date;
  lastError?: Date;
  cooldownUntil?: Date;
}

interface AuthConfig {
  profiles: AuthProfile[];
  cooldownMinutes: number;  // 失败后冷却时间
}

// 使用时轮询
async function callWithFailover<T>(
  fn: (profile: AuthProfile) => Promise<T>,
  config: AuthConfig
): Promise<T> {
  for (const profile of config.profiles) {
    if (profile.cooldownUntil && profile.cooldownUntil > new Date()) {
      continue;  // 冷却中
    }
    try {
      const result = await fn(profile);
      profile.lastUsed = new Date();
      return result;
    } catch (error) {
      profile.lastError = new Date();
      profile.cooldownUntil = new Date(Date.now() + config.cooldownMinutes * 60000);
    }
  }
  throw new Error('All auth profiles exhausted');
}
```

### 适用场景

- 单一 API key 限额不足时自动切换
- 提高服务可用性

---

## 5. 运行时上下文注入

**参考文件**: `pi-embedded-runner/system-prompt.ts`

### OpenClaw 实现

```typescript
function buildEmbeddedSystemPrompt(params: {
  workspaceDir: string;
  runtimeInfo: {
    host: string;
    os: string;
    arch: string;
    node: string;
    model: string;
    provider?: string;
    capabilities?: string[];
  };
  tools: AgentTool[];
  sandboxInfo?: EmbeddedSandboxInfo;
  contextFiles?: EmbeddedContextFile[];
  // ...
}): string
```

### Ralph 可借鉴

建议在 DECIDE/REFLECT prompt 中注入更多上下文：

```typescript
// 建议增强 states/decide.ts
interface RuntimeContext {
  timestamp: string;
  iteration: number;
  model: string;
  provider: string;
  tokensUsed: { input: number; output: number };
  previousActions: string[];  // 最近 N 次行动摘要
}

function buildDecidePrompt(context: Context, runtime: RuntimeContext): string {
  return `
## 运行时信息
- 当前时间: ${runtime.timestamp}
- 迭代次数: ${runtime.iteration}
- 使用模型: ${runtime.provider}/${runtime.model}
- 已用 Token: ${runtime.tokensUsed.input} in / ${runtime.tokensUsed.output} out

## 最近行动
${runtime.previousActions.map(a => `- ${a}`).join('\n')}

## 当前目标
${context.goal}
...
`;
}
```

### 适用场景

- Agent 需要感知时间流逝
- 避免 REPEAT 相同行动
- Token 使用感知有助于决策是否需要 compact

---

## 6. 丰富的错误类型

**参考文件**: `pi-embedded-runner/types.ts`

### OpenClaw 实现

```typescript
type EmbeddedPiRunMeta = {
  durationMs: number;
  error?: {
    kind:
      | "context_overflow"    // 上下文溢出
      | "compaction_failure"  // 压缩失败
      | "role_ordering"       // 消息角色顺序错误
      | "image_size"          // 图片尺寸超限
      | "retry_limit";        // 重试次数耗尽
    message: string;
  };
  stopReason?: string;
};
```

### Ralph 可借鉴

```typescript
// 建议添加到 types.ts
export interface RunError {
  kind:
    | 'context_overflow'   // 需要压缩 memory
    | 'api_rate_limit'     // API 限流
    | 'api_auth_error'     // 认证失败
    | 'api_timeout'        // 请求超时
    | 'tool_execution'     // 工具执行失败
    | 'json_parse'         // LLM 输出解析失败
    | 'user_abort'         // 用户中断
    | 'retry_limit';       // 重试耗尽
  message: string;
  recoverable: boolean;    // 是否可恢复
  suggestedAction?: string; // 建议的恢复行动
}
```

### 适用场景

- 更精细的错误处理策略
- 自动恢复 vs 需要人工介入

---

## 7. 子 Agent 生成（Spawn）

**参考文件**: `acp-spawn.ts`

### OpenClaw 实现

```typescript
type SpawnAcpParams = {
  task: string;
  label?: string;
  agentId?: string;
  cwd?: string;
  mode?: 'run' | 'session';  // oneshot vs 持久
  thread?: boolean;          // 绑定到线程
};

type SpawnAcpResult = {
  status: 'accepted' | 'forbidden' | 'error';
  childSessionKey?: string;
  runId?: string;
};
```

### Ralph 可借鉴

未来可支持子任务委派：

```typescript
// 未来扩展：Ralph 生成子 Ralph
interface SpawnChildParams {
  task: string;
  inheritMemory: boolean;   // 是否继承父 memory
  isolated: boolean;        // 是否隔离 context
  timeout?: number;         // 超时时间
}

interface SpawnChildResult {
  status: 'accepted' | 'forbidden' | 'error';
  childId?: string;
  promise?: Promise<ActResult>;
}

// 在 ACT 阶段使用
async function act(action: Candidate): Promise<ActResult> {
  if (action.requiresSpawn) {
    const child = await spawnChild({
      task: action.spawnTask,
      inheritMemory: false,
      isolated: true
    });
    return await child.promise;
  }
  // ... 正常执行
}
```

### 适用场景

- 复杂任务分解（如：独立研究 + 代码实现）
- 并行执行多个独立子任务

---

## 8. 回调/事件驱动模式

**参考文件**: `pi-embedded-subscribe.ts`, `pi-embedded-subscribe.handlers.ts`

### OpenClaw 实现

```typescript
// 事件订阅模式
function subscribeEmbeddedPiSession(params: {
  onBlockReply?: (chunk: BlockReplyChunk) => void;
  onToolResult?: (result: ToolResult) => void;
  onReasoningStream?: (thinking: ReasoningChunk) => void;
  onAgentEvent?: (event: AgentEvent) => void;
}) {
  // 事件路由器
  const handler = (evt: EmbeddedPiSubscribeEvent) => {
    switch (evt.type) {
      case 'message_start': handleMessageStart(ctx, evt); break;
      case 'message_update': handleMessageUpdate(ctx, evt); break;
      case 'message_end': handleMessageEnd(ctx, evt); break;
      case 'tool_execution_start': handleToolExecutionStart(ctx, evt); break;
      case 'tool_execution_end': handleToolExecutionEnd(ctx, evt); break;
      case 'agent_start': handleAgentStart(ctx); break;
      case 'agent_end': handleAgentEnd(ctx); break;
      // ... 更多事件类型
    }
  };

  return {
    assistantTexts: string[],
    toolMetas: ToolMeta[],
    unsubscribe: () => void,
    isCompacting: () => boolean,
    // ... 更多状态查询方法
  };
}
```

### 适用性分析

| 场景 | Ralph MVP | OpenClaw | 结论 |
|------|-----------|----------|------|
| 运行模式 | 同步 CLI 循环 | 异步实时消息流 | 不需要 |
| 输出目标 | 终端 stdout | WebSocket + 多通道 | 过度设计 |
| 状态复杂度 | 简单迭代计数器 | 复杂状态机 | 过度 |
| 扩展性需求 | 低 | 高（插件/hook系统） | 不需要 |

### Ralph 当前设计更简洁

```typescript
// Ralph 的同步循环 - MVP 足够用
while (!shouldStop(iteration, options)) {
  const context = await sense(memory);      // SENSE
  const decision = await decide(context);   // DECIDE
  if (decision.stopReason) break;
  const result = await act(decision);       // ACT
  await reflect(context, decision, result); // REFLECT
  memory = await loadMemory(options.memoryDir);
}
```

### 未来可能适用的场景

如果需要以下能力，可考虑引入事件驱动：

1. **实时进度反馈** - 类似 `onBlockReply` 的流式输出
2. **Hook 系统** - 允许用户注入自定义逻辑
   ```typescript
   type RalphHook = 'before_decide' | 'after_act' | 'on_error' | 'on_compaction';
   function registerHook(hook: RalphHook, handler: HookHandler): void;
   ```
3. **多输出通道** - 同时输出到终端、文件、WebSocket

---

## 实施优先级建议

| 优先级 | 功能 | 复杂度 | 价值 | 备注 |
|--------|------|--------|------|------|
| P1 | 运行循环保护机制 | 低 | 高 | 防止死循环 |
| P1 | 丰富的错误类型 | 低 | 高 | 更好的错误处理 |
| P2 | 运行时上下文注入 | 低 | 中 | 改进决策质量 |
| P2 | 多 Auth Profile 轮询 | 中 | 中 | 提高可用性 |
| P3 | 混合搜索 Memory | 高 | 中 | 搜索质量提升 |
| P3 | 子 Agent 生成 | 高 | 未知 | 需要实际场景验证 |
| P4 | 回调/事件驱动模式 | 高 | 低 | 仅在需要实时流式或多通道时考虑 |

---

## 相关文件

- Ralph 实现计划: `docs/plans/2026-03-04-ralph-plan.md`
- Ralph 类型定义: `src/types.ts` (待创建)
- Ralph 循环逻辑: `src/loop.ts` (待创建)
