// src/tests/reflect.test.ts
import { describe, it, expect } from 'vitest';
import { buildReflectPrompt, parseReflection } from '../states/reflect.js';
import type { Context, Decision, ActResult, Candidate } from '../types.js';

const mockContext: Context = {
  goal: '# Goal\n完成项目',
  semantic: '',
  procedural: '',
  recentEpisodes: '',
  projectState: '',
};

const mockCandidate: Candidate = {
  action: '修复类型错误',
  impact: 4,
  urgency: 3,
  confidence: 0.9,
  reasoning: '阻碍编译',
};

const mockDecision: Decision = {
  candidates: [mockCandidate],
  selected: mockCandidate,
  priority: 10.8,
  stopReason: null,
};

const mockResult: ActResult = {
  success: true,
  output: '类型错误已修复，tsc 编译成功',
};

describe('buildReflectPrompt', () => {
  it('contains action and result', () => {
    const prompt = buildReflectPrompt(mockContext, mockDecision, mockResult);
    expect(prompt).toContain('修复类型错误');
    expect(prompt).toContain('tsc 编译成功');
    expect(prompt).toContain('JSON');
  });
});

describe('parseReflection', () => {
  it('parses valid reflection response', () => {
    const response = JSON.stringify({
      patterns: ['编译前先运行 tsc 检查'],
      antiPatterns: [],
      learning: '类型错误应尽早修复',
    });
    const reflection = parseReflection(response);
    expect(reflection.patterns).toHaveLength(1);
    expect(reflection.patterns[0]).toContain('tsc');
    expect(reflection.learning).toContain('类型错误');
  });

  it('handles empty patterns', () => {
    const response = JSON.stringify({
      patterns: [],
      antiPatterns: [],
      learning: '无特殊发现',
    });
    const reflection = parseReflection(response);
    expect(reflection.patterns).toHaveLength(0);
  });
});
