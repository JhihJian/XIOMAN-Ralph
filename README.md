# Ralph

一个基于 **ReAct + Reflection** 架构的自主 Agent，打包为 Docker 容器运行。

Ralph 持续执行 **SENSE → DECIDE → ACT → REFLECT** 循环，通过四层记忆系统积累经验，自主完成你在 `goal.md` 中描述的目标。

---

## 工作原理

```
┌─────────────────────────────────────────────┐
│                  主循环                      │
│                                             │
│  SENSE ──► DECIDE ──► ACT ──► REFLECT       │
│    │          │         │        │          │
│  读取       LLM推理   执行工具   更新记忆      │
│  记忆       选择行动  读写文件   写入经验      │
└─────────────────────────────────────────────┘
```

| 阶段 | 职责 |
|------|------|
| **SENSE** | 读取四层记忆 + 扫描项目状态（git status、最近文件） |
| **DECIDE** | LLM 生成候选行动，按 `影响力 × 紧迫性 × 置信度` 排序，判断是否停止 |
| **ACT** | LLM Agent 执行行动（读文件、写文件、运行命令） |
| **REFLECT** | LLM 提取 Pattern / Anti-Pattern，追加迭代记录 |

### 四层记忆

```
workspace/memory/
├── goal.md        # 你的目标（只读，手动编写）
├── semantic.md    # Ralph 积累的领域知识
├── procedural.md  # 成功模式 + Anti-Pattern
└── episodic.md    # 每次迭代的行动记录
```

---

## Prerequisites

- Install Claude CLI: `npm install -g @anthropic-ai/claude-code`

---

## 快速开始

### 1. 构建镜像

```bash
git clone https://github.com/JhihJian/XIOMAN-Ralph.git
cd XIOMAN-Ralph
docker build -t ralph .
```

### 2. 初始化记忆文件

在你的项目目录下执行：

```bash
docker run --rm -v $(pwd):/workspace ralph init
```

生成 `memory/` 目录和四个模板文件。

### 3. 编写目标

编辑 `memory/goal.md`，描述你希望 Ralph 完成的任务：

```markdown
# Goal

为这个 Python 项目补全单元测试，覆盖率达到 80%。

## Success Criteria
- [ ] 所有模块都有测试文件
- [ ] pytest 覆盖率报告 >= 80%
- [ ] 没有 Flake8 警告

## Constraints
- 只使用 pytest，不引入其他测试框架
```

### 4. 启动 Ralph

```bash
docker run --rm -it \
  -v $(pwd):/workspace \
  -e ANTHROPIC_AUTH_TOKEN=sk-ant-... \
  ralph
```

Ralph 将持续运行，直到判断目标已达成或无法达成。

---

## 命令参考

```bash
# 持续运行（默认）
docker run --rm -it -v $(pwd):/workspace -e ANTHROPIC_AUTH_TOKEN=... ralph

# 只执行一次迭代（调试用）
docker run --rm -it -v $(pwd):/workspace -e ANTHROPIC_AUTH_TOKEN=... ralph run --once

# 限制最大迭代次数
docker run --rm -it -v $(pwd):/workspace -e ANTHROPIC_AUTH_TOKEN=... ralph run --max-iterations 20

# 初始化记忆文件
docker run --rm -v $(pwd):/workspace ralph init
```

---

## 配置

通过环境变量配置，不传则使用默认值：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `ANTHROPIC_AUTH_TOKEN` | (required) | Anthropic API 认证令牌 |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | API 端点 |
| `MODEL` | `claude-sonnet-4-5` | 模型名称 |
| `RALPH_WORKSPACE` | `/workspace` | 工作目录 |

---

## 本地开发

```bash
# 安装依赖
npm install

# 编译
npm run build

# 运行测试
npm test

# 开发模式（不编译直接运行）
ANTHROPIC_AUTH_TOKEN=sk-ant-... npm run dev -- init
```

### 项目结构

```
src/
├── index.ts              # CLI 入口
├── loop.ts               # 主循环
├── types.ts              # 类型定义
├── config.ts             # 环境变量配置
├── memory/
│   └── manager.ts        # 四层记忆读写
├── pi/
│   └── client.ts         # Claude CLI 子进程封装
└── states/
    ├── sense.ts           # SENSE 阶段
    ├── decide.ts          # DECIDE 阶段
    ├── act.ts             # ACT 阶段
    └── reflect.ts         # REFLECT 阶段
```

---

## 注意事项

- **ACT 阶段可以执行任意 bash 命令**，请确认 `goal.md` 内容可信
- 容器以非 root 用户运行，挂载目录需要有写权限
- 默认最多执行 100 次迭代，防止无限循环
- 按 `Ctrl+C` 可优雅退出，已完成的迭代记录会保留在 `episodic.md`

---

## License

MIT
