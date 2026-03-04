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
