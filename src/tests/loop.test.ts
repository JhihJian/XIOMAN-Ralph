// src/tests/loop.test.ts
import { describe, it, expect } from 'vitest';
import { shouldStop } from '../loop.js';
import type { LoopOptions } from '../types.js';

const baseOptions: LoopOptions = {
  maxIterations: 100,
  once: false,
  memoryDir: '',
  workspaceDir: '',
};

describe('shouldStop', () => {
  it('returns true when maxIterations reached', () => {
    expect(shouldStop(100, { ...baseOptions, maxIterations: 100 })).toBe(true);
  });

  it('returns false when under maxIterations', () => {
    expect(shouldStop(50, { ...baseOptions, maxIterations: 100 })).toBe(false);
  });

  it('returns true when once mode and iteration >= 1', () => {
    expect(shouldStop(1, { ...baseOptions, once: true })).toBe(true);
  });

  it('returns false when once mode and iteration is 0', () => {
    expect(shouldStop(0, { ...baseOptions, once: true })).toBe(false);
  });
});
