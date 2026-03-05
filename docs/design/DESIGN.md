# ReAct + Reflection Agent Loop 框架设计

> 基于 2025-2026 前沿研究的持续运行 Agent 框架。核心是「无界目标下的自主决策循环」。

## 设计原则

**CLI-first**：所有能力通过命令行实现，不依赖外部协议或服务。Agent 是一个能执行 shell 命令的循环，而非需要特定协议的工具调用者。

---

## 2025-2026 前沿研究分析

### 一、核心论文

**元认知自我改进 (2025.06)**

论文「Truly Self-Improving Agents Require Intrinsic Metacognitive Learning」提出：有效的自我改进需要**内禀元认知学习**——Agent 监控和调节自身认知过程的能力。

三层自我改进模型：
- L3：Memory + Self-Reflection（记忆 + 自我反思）
- L4：Autonomous Learning + Generalization（自主学习 + 泛化）
- L5：Personality + Multi-Agent Collaboration（个性化 + 多 Agent 协作）

本框架采用 L3 作为起点，Reflection 阶段不仅是「记录」，而是「元认知评估」。

**长时程任务的自反思编码 Agent (2025.12)**

论文「PARC: An Autonomous Self-Reflective Coding Agent」针对长时程任务设计，核心创新是自反思机制处理任务中断和上下文切换。

与 Ralph 的关键区别：
- Ralph 假设任务可预定义（prd.json）
- PARC 支持动态分解和反思驱动的错误恢复

本框架借鉴其状态持久化和错误恢复机制。

**推理策略记忆库 (2025)**

ReasoningBank 框架的核心机制：从成功和失败中蒸馏可泛化的推理策略，测试时检索相关记忆指导交互。

关键创新点：
- 存储的是「策略」而非「原始记录」
- 支持 Memory-aware Test-Time Scaling (MaTTS)

本框架借鉴其「策略蒸馏」理念，Memory 存储可泛化模式而非原始日志。

**规划 Agent 综述 (2025)**

论文「Understanding the planning of LLM agents」总结三种规划范式：

1. Decomposition-First（先分解后规划）：HuggingGPT, ProgPrompt
2. Plan-and-Execute（先规划后执行）：BabyAGI, Plan-and-Solve
3. ReAct（边思考边行动）：Thought-Action-Observation 循环

2025 最佳实践是**混合模式**：宏观用 Plan-and-Execute 的结构性，微观用 ReAct 处理具体行动。

---

### 二、大型科技公司分析

**Anthropic: Claude Agent 生态**

Claude Agent SDK (2025.09) 的核心架构：

```
Main Agent (Project Manager)
├── 任务分发、流程控制、结果整合
│
├── SubAgent: Explore (探索专家)
├── SubAgent: Plan (规划专家)
├── SubAgent: General (通用执行)
└── Custom SubAgents (用户自定义)
```

每个 SubAgent 有独立上下文，无状态设计，三层记忆系统。

Claude 5 "Fennec" (2026.02) 新增自我生成 Agent 能力：按需生成 Frontend Agent、CSS Agent、API Integration Agent 等专家。

**Google DeepMind: 持续学习**

2026 年预测：AI 将实现持续学习能力——无需重新训练即可吸收新知识。

嵌套学习范式：内层快速适应 + 外层慢速整合，解决「可塑性-稳定性」平衡问题。

关键系统包括：
- Aletheia：完全自主数学研究 Agent
- Gemini 3.0 Deep Think：System 2 深度推理，自我反思

---

### 三、Agent 设计模式演进

吴恩达提出的四大核心模式：

**Reflection（反思）**：自我评估 → 改进。2025 年进阶到 Level 3 元认知反思——认知监控 → 策略调整 → 自我调节。

**Tool Use（工具使用）**：扩展能力。本框架采用 CLI-first，所有工具都是 shell 命令。

**Planning（规划）**：任务分解 → 执行。本框架采用目标驱动，每次迭代动态评估优先级。

**Multi-Agent（多 Agent）**：角色分工协作。本框架暂不涉及，作为 Future Work。

---

### 四、记忆架构前沿

2025 年研究提出四层记忆模型（仿人脑设计）：

- Working Memory：当前任务上下文（前额叶皮层）
- Episodic Memory：事件和决策日志（海马体）
- Semantic Memory：知识和概念（新皮层）
- Procedural Memory：习得的技能和程序（基底核）

关键洞察：**Memory is not an Agent's auxiliary module. Memory is the Agent's infrastructure.** 没有稳定记忆系统的 Agent 就像一个每次醒来只有模糊印象的人，无法实现真正的「长期协作」。

---

## 本框架设计定位

继承 2022-2024 基础：
- ReAct 的 Thought-Action-Observation 循环
- Reflexion 的反思学习机制
- Ralph 的 Fresh Context 循环

继承 2025-2026 进展：
- 元认知反思（而非简单记录）
- 四层记忆系统
- 持续学习设计目标

原创改进：
- CLI-first（不依赖协议）
- 目标驱动 + 无终止条件
- 优先级决策公式
- 四个独立记忆文件

---

## 问题定义

### Ralph 的边界

Ralph 的输入是可枚举的任务列表，输出是「完成 → 结束」。隐含假设：任务可预先规划、有明确终点、执行路径已知。

### 本框架要解决的问题

输入是 Goal（目标，不含实现路径），输出是持续工作，无终止条件。

核心挑战：
1. **不可预知** — 无法预先列出所有需要做的事
2. **自主决策** — 每次迭代需要判断「现在最该做什么」
3. **持续学习** — 跨迭代积累经验，避免重复犯错

---

## 核心抽象

### 双循环机制

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Loop                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   单次迭代 (Fresh Context)                                      │
│   │                                                             │
│   ├── ReAct 内循环                                              │
│   │   Thought ──▶ Action ──▶ Observation                        │
│   │        │                          │                         │
│   │        └──────────────────────────┘                         │
│   │                (循环直到行动完成)                            │
│   │                                                             │
│   └── 元认知反思 (Metacognitive Reflection)                     │
│       What worked? → Pattern 提取                               │
│       What failed? → Anti-Pattern 记录                          │
│       What surprised? → Open Question                           │
│       What to remember? → 策略蒸馏                              │
│                                                                 │
│   下一次迭代读取四层记忆                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 四层记忆系统

四层对应四个独立文件：

**goal.md（意图层，前额叶）**
定义「做什么」和「不做什么」，决策原则，成功标准。

**episodic.md（情景层，海马体）**
按时间顺序记录事件和决策日志，支持回溯。

**semantic.md（语义层，新皮层）**
存储验证有效的通用模式和不变的系统知识（Facts）。

**procedural.md（程序层，基底核）**
记录已知会失败的坑（Anti-Patterns）和正确做法。

```
四层记忆的更新频率：

goal.md       ──── 很少变（目标变了就是另一个 Agent）
semantic.md   ──── 偶尔变（发现新模式时）
procedural.md ──── 偶尔变（踩坑时）
episodic.md   ──── 每次迭代追加（事件日志）
```

---

## 决策框架

### 优先级公式

```
Priority = Impact × Urgency × Confidence

Impact: 这个行动对目标的贡献度，取值 1-5
Urgency: 不做的后果严重性，取值 1-5
Confidence: 完成的把握度，取值 0.1-1.0
```

为什么用公式而不是纯 LLM 判断？
- 公式可调参，可解释
- 避免 LLM 的随机性
- 可以 A/B 测试不同权重

### 状态机

```
SENSE（感知环境）
│
├── 读取 goal.md（意图）
├── 读取 semantic.md（模式）
├── 读取 procedural.md（避坑指南）
├── 读取 episodic.md（最近发生的事）
└── 执行 CLI 命令感知外部状态
│
↓
DECIDE（决策）
│
├── 对候选行动计算 Priority
├── 选择最高优先级行动
└── 输出决策理由
│
↓
ACT（ReAct 循环）
│
├── Thought: 分析当前情况
├── Action: 执行 CLI 命令
├── Observation: 观察命令输出
└── 循环直到完成或阻塞
│
↓
REFLECT（元认知反思）
│
├── 成功了什么？→ 写入 semantic.md
├── 失败了什么？→ 写入 procedural.md
├── 意外发现？→ 追加到 episodic.md
└── 可泛化的策略？→ 提取后写入 semantic.md
│
↓
回到 SENSE，开始下一次迭代
```

---

## CLI-first 设计

### 核心理念

Agent 的唯一能力是执行 shell 命令。不需要 MCP、不需要 API、不需要特定协议。

一切皆命令：
- 感知外部状态 → 执行 `git status`、`curl`、`ps aux`
- 操作文件 → 执行 `cat`、`echo`、`sed`
- 调用工具 → 执行对应的 CLI 程序

### 与协议方案的对比

**协议方案（MCP 等）的假设**：
- 需要标准化的工具接口
- 工具需要注册和发现
- 调用需要特定格式

**CLI-first 的优势**：
- 无需协议，直接执行
- 利用现有的 Unix 哲学
- 组合能力由 shell 提供（管道、重定向）
- 调试简单，直接看命令输出

**CLI-first 的挑战**：
- 输出解析依赖 LLM 理解
- 跨平台命令差异
- 需要处理命令失败

### 实现

Agent 通过以下方式与外部交互：

```bash
# 感知
git log --oneline -5
docker ps --format "{{.Names}}: {{.Status}}"
curl -s https://api.example.com/health

# 行动
git commit -m "feat: implement X"
docker restart container-name
npm test

# 观察
# 直接读取命令的 stdout/stderr
```

---

## 组件设计

### goal.md

```markdown
# 目标定义

## What
要达成什么目标

## Why
为什么这个目标重要

## Boundaries
做什么，不做什么（防止 scope creep）

## Decision Principles
决策原则，冲突时用于排序

## Success Criteria
如何判断目标达成
```

### semantic.md

```markdown
# 语义记忆

## Patterns
验证有效的通用模式。

[日期] 模式名称
描述：这个模式是什么
适用：什么场景下使用
示例：具体怎么用

## Facts
不会过时的系统知识。

[日期] 事实描述
```

### procedural.md

```markdown
# 程序记忆

## Anti-Patterns
已知会失败的坑。

[日期] 错误场景
错误做法：这样会失败
正确做法：应该这样做
原因：为什么

## Procedures
已验证的执行流程。
```

### episodic.md

```markdown
# 情景记忆

按时间顺序的事件日志。

## [时间戳] 事件标题
发生了什么
做了什么决策
结果如何
学到了什么
```

---

## 与前沿的差距

**已有**：ReAct 循环、元认知反思、四层记忆、Fresh Context、目标驱动、自主决策、CLI-first

**待实现**：SubAgent 架构、多 Agent 协作、持续学习验证

**需验证**：优先级公式是否有效、策略蒸馏是否真能泛化

---

## 设计决策记录

**循环模式**：选择永不自动终止。因为无界问题没有「完成」概念。

**反思级别**：选择元认知反思。参考 2025 元认知论文，比 Output/Process 反思更深层。

**记忆分层**：选择四层独立文件。参考 2025 记忆架构研究，每层有独立的更新频率和用途。

**决策方式**：选择优先级公式。可调参，可解释，避免 LLM 随机性。

**内循环**：选择 ReAct。成熟范式，可验证。

**上下文隔离**：选择 Fresh Context。参考 Ralph，避免污染。

**工具调用**：选择 CLI-first。不依赖协议，利用 Unix 哲学。

---

## Future Work

1. **SubAgent 架构** — 如何在 CLI-first 下实现专家分工
2. **持续学习验证** — 如何量化「越用越聪明」
3. **多 Agent 协作** — 多个 Agent 如何共享四层记忆
4. **反思质量评估** — 如何验证元认知反思的有效性
5. **跨平台 CLI** — 如何处理 Linux/macOS/Windows 命令差异

---

## 参考文献

**2025-2026 论文**
- Truly Self-Improving Agents Require Intrinsic Metacognitive Learning (2025.06)
- PARC: Self-Reflective Coding Agent for Long-Horizon Tasks (2025.12)
- ReasoningBank Framework (2025)
- Understanding the planning of LLM agents: A survey (2024-2025)

**大型科技公司**
- Claude Agent SDK Documentation (2025.09)
- Google DeepMind Agent Research (2025-2026)

**框架参考**
- Ralph Pattern (2024)
- ReAct: Synergizing Reasoning and Acting (2022)
- Reflexion: Language Agents with Verbal Reinforcement Learning (2023)
