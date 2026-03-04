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
