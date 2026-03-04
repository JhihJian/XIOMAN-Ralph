// src/states/reflect.ts
import { callLLM } from '../pi/client.js';
import { appendEpisodic, updateMemoryFile } from '../memory/manager.js';
import type { ActResult, Context, Decision } from '../types.js';

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
  if (!jsonMatch) {
    throw new Error(`REFLECT 响应无法解析为 JSON: ${response.slice(0, 200)}`);
  }
  return JSON.parse(jsonMatch[0]) as Reflection;
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
    await updateMemoryFile(
      memoryDir,
      'semantic',
      `\n${reflection.patterns.map((p) => `- ${p}`).join('\n')}`
    );
  }

  if (reflection.antiPatterns.length > 0) {
    await updateMemoryFile(
      memoryDir,
      'procedural',
      `\n${reflection.antiPatterns.map((p) => `- ${p}`).join('\n')}`
    );
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
