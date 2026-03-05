# 竞品调研：OpenClaw / NanoClaw / nanobot

> 与 React-Agent-Loop PRD 的相似度分析

## 概览对比

| 项目 | Stars | 核心定位 | 代码量 | 语言 |
|------|-------|----------|--------|------|
| **OpenClaw** | 238K+ | 全功能自主 Agent 平台 | ~430K 行 | TypeScript |
| **NanoClaw** | 12.8K | 安全优先的轻量 Agent | ~500 行 | TypeScript |
| **nanobot** | 21K+ | 学术界轻量框架 | ~4K 行 | Python |
| **React-Agent-Loop (PRD)** | - | 持续运行的自主决策框架 | - | - |

---

## 逐项对比

### F1: 双循环机制

| 需求 | OpenClaw | NanoClaw | nanobot | 相似度 |
|------|----------|----------|---------|--------|
| **ReAct 内循环** | ✅ 完整实现 Thought→Action→Observation | ✅ 继承自 Claude Agent SDK | ✅ AgentLoop 核心引擎 | **高** |
| **元认知反思** | ⚠️ 有任务后总结，无 Pattern 提取 | ❌ 无 | ❌ 无 | **低** |
| **Fresh Context** | ❌ 依赖对话历史 + 向量检索 | ⚠️ 每容器独立，但有历史累积 | ⚠️ MEMORY.md 全量注入 | **中** |

**结论**：三者都实现了 ReAct 循环，但**元认知反思是 React-Agent-Loop 的差异化设计**，现有项目均未实现 Pattern 提取和策略蒸馏。

---

### F2: 四层记忆系统

| 记忆层 | OpenClaw | NanoClaw | nanobot | React-Agent-Loop PRD |
|--------|----------|----------|---------|----------------------|
| **意图层** | ❌ 无独立层 | ❌ 无 | ⚠️ SOUL.md 部分覆盖 | `goal.md` |
| **语义层** | ⚠️ Markdown + SQLite 混合 | ⚠️ CLAUDE.md | ⚠️ MEMORY.md | `semantic.md` |
| **程序层** | ❌ 无独立层 | ❌ 无 | ❌ 无 | `procedural.md` |
| **情景层** | ✅ history.md / 每日笔记 | ⚠️ SQLite 状态库 | ✅ memory/YYYY-MM-DD.md | `episodic.md` |

**结论**：
- **nanobot 的双层记忆最接近**：MEMORY.md (长期) + history.md (情景)
- **OpenClaw 的混合方案最成熟**：Markdown 可读 + SQLite 向量索引
- **procedural.md (Anti-Pattern 层) 是 React-Agent-Loop 独创**，现有项目均无

---

### F3: 自主决策

| 需求 | OpenClaw | NanoClaw | nanobot |
|------|----------|----------|---------|
| **优先级公式** | ❌ 无公式，纯 LLM 判断 | ❌ 无 | ❌ 无 |
| **候选生成** | ✅ Skills 市场动态发现 | ⚠️ 基于上下文推导 | ⚠️ ToolRegistry |
| **决策理由输出** | ⚠️ 有日志，无可追溯公式 | ⚠️ 有日志 | ⚠️ 有日志 |

**结论**：**Priority = Impact × Urgency × Confidence 公式是 React-Agent-Loop 的创新点**，现有项目依赖 LLM 黑盒判断，缺乏可解释性。

---

### F4: CLI-first 交互

| 需求 | OpenClaw | NanoClaw | nanobot |
|------|----------|----------|---------|
| **唯一能力是 shell** | ❌ 多能力（浏览器、API、消息等） | ❌ 继承 Claude Agent SDK 多能力 | ❌ ToolRegistry 多能力 |
| **命令输出解析** | ✅ LLM 理解 stdout/stderr | ✅ | ✅ |
| **跨平台** | ✅ Docker 隔离 | ✅ Docker/Apple Container | ⚠️ 依赖宿主 |

**结论**：React-Agent-Loop 的 **CLI-first 是减法设计**，强制单一能力换取：
- 更低的实现复杂度
- 更强的可预测性
- 更容易的安全审计

现有项目都是**加法设计**，能力越多越难预测行为。

---

### F5: 状态机驱动

| 状态 | OpenClaw | NanoClaw | nanobot |
|------|----------|----------|---------|
| **SENSE** | ✅ 记忆读取 + 外部感知 | ✅ | ✅ |
| **DECIDE** | ⚠️ 内嵌在思考中，无显式阶段 | ⚠️ | ⚠️ |
| **ACT** | ✅ ReAct 执行 | ✅ | ✅ |
| **REFLECT** | ⚠️ 有总结，无 Pattern 提取 | ❌ | ❌ |

**结论**：三者都是隐式状态机，**React-Agent-Loop 的显式状态机设计更利于调试和监控**。

---

## 架构相似度总结

```
相似度评分（满分 10 分）：

OpenClaw:  ████████░░  8/10  —  功能超集，但缺乏元认知反思
NanoClaw:  ██████░░░░  6/10  —  安全架构新颖，但功能简化
nanobot:   ████████░░  8/10  —  记忆系统最接近，代码可读性高
```

---

## React-Agent-Loop 的差异化定位

| 维度 | 现有项目 | React-Agent-Loop PRD | 差异化价值 |
|------|----------|----------------------|------------|
| **目标输入** | 任务/消息驱动 | Goal（目标）驱动 | 处理不可预知问题 |
| **记忆层级** | 1-2 层 | 4 层（含 Anti-Pattern） | 避免重复踩坑 |
| **决策机制** | LLM 黑盒 | 可解释公式 | 可调参、可追溯 |
| **能力边界** | 加法（越多越好） | 减法（CLI-first） | 可预测、可审计 |
| **反思机制** | 无/弱 | 元认知 Pattern 提取 | 越用越聪明 |
| **运行模式** | 事件触发 | 持续循环 | 无需人工干预 |

---

## 可借鉴的设计

### 从 OpenClaw 借鉴
1. **Markdown + SQLite 混合记忆** — 兼顾可读性和检索效率
2. **泳道队列系统** — 强制串行执行，避免并发冲突
3. **语义快照** — 基于可访问性树替代截图，降低 Token 成本

### 从 NanoClaw 借鉴
1. **容器隔离** — 每个 Agent 独立容器，安全边界清晰
2. **极简代码** — 500 行核心代码，8 分钟可读完
3. **显式挂载** — 用户必须显式声明 Agent 可访问的目录

### 从 nanobot 借鉴
1. **文件驱动架构** — AGENTS.md / SOUL.md / USER.md 分层清晰
2. **MEMORY.md 全量注入** — 简单有效的长期记忆方案
3. **版本控制友好** — 所有状态都是 Markdown 文件

---

## 建议的融合架构

```
React-Agent-Loop v2 设计建议：

┌─────────────────────────────────────────────────────┐
│                   Goal (goal.md)                    │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐    │
│  │              SENSE 阶段                      │    │
│  │  读取四层记忆 (借鉴 nanobot 文件驱动)        │    │
│  │  + SQLite 向量索引 (借鉴 OpenClaw)           │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │              DECIDE 阶段                     │    │
│  │  Priority 公式 + 可追溯日志                  │    │
│  │  (React-Agent-Loop 原创)                    │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │              ACT 阶段                        │    │
│  │  ReAct 循环 + CLI-only (减法设计)           │    │
│  │  容器隔离 (借鉴 NanoClaw)                   │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │              REFLECT 阶段                    │    │
│  │  Pattern 提取 + Anti-Pattern 记录           │    │
│  │  (React-Agent-Loop 原创)                    │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## 参考资料

- [OpenClaw 官网](https://openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [NanoClaw GitHub](https://github.com/qwibitai/nanoclaw)
- [nanobot GitHub](https://github.com/HKUDS/nanobot)
- [OpenClaw 配置指南](https://m.163.com/dy/article/KMS4B38F05566M9N.html)
- [NanoClaw 安全架构分析](https://www.datacamp.com/tutorial/nanobot-tutorial)
