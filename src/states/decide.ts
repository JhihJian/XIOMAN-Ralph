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

export function parseDecision(response: string, _iteration: number): Decision {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`DECIDE 响应无法解析为 JSON: ${response.slice(0, 200)}`);
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    candidates: Candidate[];
    selected: Candidate;
    stopReason: string | null;
  };
  return {
    candidates: parsed.candidates,
    selected: parsed.selected,
    priority: calculatePriority(parsed.selected),
    stopReason: parsed.stopReason ?? null,
  };
}

export async function decide(context: Context, iteration: number): Promise<Decision> {
  const prompt = buildDecidePrompt(context);
  const response = await callLLM(prompt);
  return parseDecision(response, iteration);
}
