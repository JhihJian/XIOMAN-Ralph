# React-Agent-Loop 测试方案

> 基于 PRD.md 的分层测试策略

## 测试分层

```
┌─────────────────────────────────────────────────────┐
│                 E2E 集成测试                         │  ← 完整循环验证
├─────────────────────────────────────────────────────┤
│              功能模块测试                            │  ← F1-F5 独立验证
├─────────────────────────────────────────────────────┤
│              单元测试                               │  ← 核心组件验证
└─────────────────────────────────────────────────────┘
```

---

## 一、单元测试

### 1.1 优先级公式 (F3.1)

**测试目标**：验证 `Priority = Impact × Urgency × Confidence` 计算正确性

| 测试用例 | 输入 | 预期输出 | 验证点 |
|----------|------|----------|--------|
| UT-001 | I=5, U=5, C=1.0 | P=25 | 最大值 |
| UT-002 | I=1, U=1, C=0.1 | P=0.1 | 最小值 |
| UT-003 | I=3, U=4, C=0.8 | P=9.6 | 中间值 |
| UT-004 | I=-1, U=5, C=1.0 | Error | 边界校验：拒绝非法输入 |
| UT-005 | I=5, U=5, C=1.5 | Error | 边界校验：Confidence 超限 |

**自动化策略**：纯函数，100% 覆盖

### 1.2 状态机转换 (F5)

**测试目标**：验证 SENSE → DECIDE → ACT → REFLECT 状态转换

| 测试用例 | 场景 | 预期行为 |
|----------|------|----------|
| UT-010 | 正常流转 | SENSE → DECIDE → ACT → REFLECT → SENSE |
| UT-011 | ACT 阶段命令失败 | 捕获异常，记录日志，继续 REFLECT |
| UT-012 | REFLECT 阶段失败 | 降级为简单日志，继续下一轮 SENSE |
| UT-013 | 外部中断信号 | 优雅退出，保存当前状态 |

### 1.3 记忆文件读写 (F2)

**测试目标**：验证四层记忆的独立读写

| 测试用例 | 操作 | 验证点 |
|----------|------|--------|
| UT-020 | 写入 semantic.md | 文件存在，内容可解析，格式正确 |
| UT-021 | 追加 episodic.md | 不覆盖历史，时间戳正确 |
| UT-022 | 并发写入保护 | 多线程写入不丢数据 |
| UT-023 | 空记忆文件初始化 | 自动创建模板结构 |

---

## 二、功能模块测试

### 2.1 ReAct 内循环 (F1.1)

**测试目标**：验证 Thought → Action → Observation 循环

**Mock 环境**：
```bash
# 准备可控的 CLI 命令
echo "test output" > /tmp/test_cmd.sh
chmod +x /tmp/test_cmd.sh
```

| 测试用例 | 场景 | 验证点 |
|----------|------|--------|
| FT-001 | 单步命令成功 | Thought → Action → Observation 完成 |
| FT-002 | 命令失败重试 | 观察错误，生成新 Thought |
| FT-003 | 循环终止条件 | 任务完成后退出内循环 |
| FT-004 | 阻塞检测 | N 次重试后仍失败，标记阻塞并退出 |

**验证方法**：
```python
# 伪代码
def test_react_loop():
    agent = Agent(goal="计算 1+1")
    trace = agent.run_single_iteration()

    assert trace.has_thought()
    assert trace.has_action()
    assert trace.has_observation()
    assert trace.is_complete_or_blocked()
```

### 2.2 元认知反思 (F1.2)

**测试目标**：验证反思阶段能正确提取 Pattern

**测试场景**：构造一个有明确成功/失败模式的迭代

| 测试用例 | 输入迭代 | 预期输出 |
|----------|----------|----------|
| FT-010 | 成功：用 `git status` 发现未提交文件 | semantic.md 新增 Pattern |
| FT-011 | 失败：用 `rm -rf /` 被拒绝 | procedural.md 新增 Anti-Pattern |
| FT-012 | 意外：发现隐藏的 `.env` 文件 | episodic.md 追加事件 |
| FT-013 | 可泛化：多次用同一策略成功 | 策略蒸馏写入 semantic.md |

**验证方法**：
```python
def test_reflection():
    # 准备：清空记忆文件
    reset_memory_files()

    # 执行：运行一次迭代
    agent.run_iteration()

    # 验证：检查记忆文件更新
    assert semantic.has_new_pattern() or \
           procedural.has_new_anti_pattern() or \
           episodic.has_new_event()
```

### 2.3 自主决策 (F3)

**测试目标**：验证 Agent 能从 Goal 推导行动并排序

| 测试用例 | Goal | 验证点 |
|----------|------|--------|
| FT-020 | "优化代码库" | 生成候选行动：lint、test、refactor... |
| FT-021 | "监控系统" | 生成候选行动：check_disk、check_logs... |
| FT-022 | 混合候选 | 按 Priority 排序，输出最高优先级 |
| FT-023 | 决策理由 | 输出包含 Impact/Urgency/Confidence 值 |

**关键验证**：决策理由必须可追溯
```markdown
## 决策示例

**选中行动**: 运行测试
**优先级**: 9.6 (I=3, U=4, C=0.8)
**理由**: 代码有变更，需验证功能完整性
**被淘汰行动**:
  - 重构代码 (P=4.5) — 风险高，无紧迫性
  - 写文档 (P=2.0) — 非当前重点
```

### 2.4 CLI-first 交互 (F4)

**测试目标**：验证 Agent 能通过 shell 命令与外部交互

| 测试用例 | 命令 | 预期行为 |
|----------|------|----------|
| FT-030 | `git status` | 解析输出，识别文件状态 |
| FT-031 | `curl -s http://api/health` | 解析 JSON，判断健康状态 |
| FT-032 | `npm test 2>&1` | 捕获 stdout + stderr |
| FT-033 | `exit 1` 命令 | 识别失败，进入错误处理 |
| FT-034 | 跨平台：`ls` vs `dir` | 根据平台选择正确命令 |

### 2.5 Fresh Context (F1.3)

**测试目标**：验证每次迭代从记忆文件重建上下文

| 测试用例 | 场景 | 验证点 |
|----------|------|--------|
| FT-040 | 首次迭代 | 无历史记忆，仅用 goal.md |
| FT-041 | 第 N 次迭代 | 读取四层记忆，不依赖历史对话 |
| FT-042 | 修改 semantic.md | 下次迭代使用更新后的知识 |

**验证方法**：
```python
def test_fresh_context():
    agent = Agent(goal="测试目标")

    # 第一次迭代
    agent.run_iteration()
    context_1 = agent.get_context_hash()

    # 第二次迭代（Fresh Context）
    agent.run_iteration()
    context_2 = agent.get_context_hash()

    # 上下文应该来自记忆文件，而非历史对话
    assert context_1 != context_2  # 不同的上下文对象
    assert agent.context_source == "memory_files"
```

---

## 三、E2E 集成测试

### 3.1 完整循环验证

**测试场景**：给定真实 Goal，运行完整循环

| 测试用例 | Goal | 预期行为 | 验收标准 |
|----------|------|----------|----------|
| ET-001 | 在空目录创建 README.md | 多次迭代后文件存在 | 文件内容非空 |
| ET-002 | 修复项目中的 lint 错误 | 迭代后 `npm run lint` 通过 | lint 退出码 0 |
| ET-003 | 监控并响应文件变化 | 修改文件后 Agent 采取行动 | episodic.md 记录响应 |

### 3.2 持续学习验证（成功标准）

**测试目标**：验证「越用越聪明」

**实验设计**：
```
运行 100 次迭代，统计：
1. 错误率变化（期望下降）
2. procedural.md 中 Anti-Pattern 数量（期望增加）
3. 重复错误次数（期望下降）
```

| 指标 | 初始值 | 期望值 | 验证方法 |
|------|--------|--------|----------|
| 错误率 | - | 100 次后下降 20% | 统计失败迭代占比 |
| Anti-Pattern 数量 | 0 | > 5 | 读取 procedural.md |
| 重复错误 | - | < 3 次 | 同类错误出现次数 |

### 3.3 优先级公式 A/B 测试

**测试目标**：验证公式优于纯 LLM 判断

**实验设计**：
```
A 组：使用 Priority 公式决策
B 组：纯 LLM 自由决策

每组运行 50 次迭代，比较：
1. 任务完成率
2. 决策一致性（相同场景相同决策的比例）
3. 无效行动比例
```

| 指标 | A 组（公式） | B 组（LLM） | 期望结果 |
|------|-------------|-------------|----------|
| 完成率 | ? | ? | A > B |
| 一致性 | ? | ? | A > B |
| 无效行动 | ? | ? | A < B |

---

## 四、非功能测试

### 4.1 可解释性测试 (N1)

| 测试用例 | 验证点 |
|----------|--------|
| NFT-001 | 每个决策有 Priority 分解 |
| NFT-002 | 每次反思可追溯到触发事件 |
| NFT-003 | 记忆文件人类可读（非 JSON 噪音） |

### 4.2 可调参测试 (N2)

| 测试用例 | 验证点 |
|----------|--------|
| NFT-010 | 修改 Priority 权重后决策变化 |
| NFT-011 | 调整反思深度影响 Pattern 质量 |
| NFT-012 | 配置记忆保留策略（如只保留 7 天） |

### 4.3 容错测试 (N3)

| 测试用例 | 故障注入 | 预期行为 |
|----------|----------|----------|
| NFT-020 | 命令执行超时 | 超时后终止，记录日志，继续循环 |
| NFT-021 | 记忆文件损坏 | 从备份恢复或重建空文件 |
| NFT-022 | 磁盘满 | 降级为内存模式，告警 |
| NFT-023 | LLM API 限流 | 指数退避重试 |

---

## 五、测试自动化

### 5.1 测试金字塔

```
         /\
        /  \  E2E (10%) — 真实环境，慢，昂贵
       /────\
      /      \  功能模块 (30%) — Mock 外部依赖
     /────────\
    /          \  单元 (60%) — 快，独立
   /────────────\
```

### 5.2 CI 集成

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/unit/ -v

  functional-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/functional/ -v --timeout=300

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/e2e/ -v --timeout=3600
    needs: [unit-tests, functional-tests]
```

### 5.3 测试数据管理

```
tests/
├── fixtures/
│   ├── memory/           # 预置记忆文件
│   │   ├── goal.md
│   │   └── semantic.md
│   └── workspace/        # 预置工作目录
│       └── sample-project/
├── mocks/
│   └── llm_mock.py       # LLM 响应模拟
└── conftest.py           # pytest 配置
```

---

## 六、验收清单

### 里程碑 M1 验收

- [ ] UT-001 ~ UT-005 全部通过
- [ ] UT-020 ~ UT-023 全部通过
- [ ] FT-001 ~ FT-004 全部通过

### 里程碑 M2 验收

- [ ] UT-010 ~ UT-013 全部通过
- [ ] FT-020 ~ FT-023 全部通过
- [ ] 决策理由输出格式正确

### 里程碑 M3 验收

- [ ] FT-010 ~ FT-013 全部通过
- [ ] FT-040 ~ FT-042 全部通过
- [ ] 记忆文件更新正确

### 里程碑 M4 验收

- [ ] ET-001 ~ ET-003 全部通过
- [ ] NFT-001 ~ NFT-023 全部通过
- [ ] 持续学习指标达标
- [ ] A/B 测试公式优于 LLM

---

## 附录：测试工具

| 工具 | 用途 |
|------|------|
| pytest | 单元测试/功能测试框架 |
| pytest-timeout | 超时控制 |
| pytest-cov | 覆盖率统计 |
| responses | HTTP Mock |
| freezegun | 时间 Mock |
| docker | E2E 环境隔离 |
