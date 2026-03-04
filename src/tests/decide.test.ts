// src/tests/decide.test.ts
import { describe, it, expect } from 'vitest';
import { calculatePriority, buildDecidePrompt, parseDecision } from '../states/decide.js';
import type { Candidate, Context } from '../types.js';

const mockContext: Context = {
  goal: '# Goal\n完成项目',
  semantic: '# Semantic Memory',
  procedural: '# Procedural Memory',
  recentEpisodes: '',
  projectState: 'clean',
};

const mockCandidate: Candidate = {
  action: '修复类型错误',
  impact: 4,
  urgency: 3,
  confidence: 0.9,
  reasoning: '类型错误阻碍编译',
};

describe('calculatePriority', () => {
  it('computes impact * urgency * confidence', () => {
    expect(calculatePriority(mockCandidate)).toBeCloseTo(4 * 3 * 0.9);
  });
});

describe('buildDecidePrompt', () => {
  it('contains all context sections', () => {
    const prompt = buildDecidePrompt(mockContext);
    expect(prompt).toContain('完成项目');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('stopReason');
  });
});

describe('parseDecision', () => {
  it('parses valid JSON response', () => {
    const response = JSON.stringify({
      candidates: [mockCandidate],
      selected: mockCandidate,
      stopReason: null,
    });
    const decision = parseDecision(response, 1);
    expect(decision.selected.action).toBe('修复类型错误');
    expect(decision.priority).toBeCloseTo(4 * 3 * 0.9);
    expect(decision.stopReason).toBeNull();
  });

  it('parses stop reason', () => {
    const response = JSON.stringify({
      candidates: [],
      selected: mockCandidate,
      stopReason: '目标已达成',
    });
    const decision = parseDecision(response, 1);
    expect(decision.stopReason).toBe('目标已达成');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseDecision('not json', 1)).toThrow();
  });
});
