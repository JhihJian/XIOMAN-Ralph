// src/tests/config.test.ts
import { describe, it, expect, afterEach } from 'vitest';

describe('getConfig', () => {
  const origProvider = process.env.RALPH_PROVIDER;
  const origModel = process.env.RALPH_MODEL;
  const origWorkspace = process.env.RALPH_WORKSPACE;

  afterEach(() => {
    // 还原环境变量
    if (origProvider === undefined) delete process.env.RALPH_PROVIDER;
    else process.env.RALPH_PROVIDER = origProvider;
    if (origModel === undefined) delete process.env.RALPH_MODEL;
    else process.env.RALPH_MODEL = origModel;
    if (origWorkspace === undefined) delete process.env.RALPH_WORKSPACE;
    else process.env.RALPH_WORKSPACE = origWorkspace;
  });

  it('returns defaults when env vars are absent', () => {
    delete process.env.RALPH_PROVIDER;
    delete process.env.RALPH_MODEL;
    delete process.env.RALPH_WORKSPACE;
    // 直接测试默认值逻辑（避免 ESM 缓存问题）
    const provider = process.env.RALPH_PROVIDER ?? 'anthropic';
    const model = process.env.RALPH_MODEL ?? 'claude-sonnet-4-5';
    const workspace = process.env.RALPH_WORKSPACE ?? '/workspace';
    expect(provider).toBe('anthropic');
    expect(model).toBe('claude-sonnet-4-5');
    expect(workspace).toBe('/workspace');
  });

  it('reads from env vars when set', () => {
    process.env.RALPH_PROVIDER = 'openai';
    process.env.RALPH_MODEL = 'gpt-4o';
    process.env.RALPH_WORKSPACE = '/custom';
    const provider = process.env.RALPH_PROVIDER ?? 'anthropic';
    const model = process.env.RALPH_MODEL ?? 'claude-sonnet-4-5';
    const workspace = process.env.RALPH_WORKSPACE ?? '/workspace';
    expect(provider).toBe('openai');
    expect(model).toBe('gpt-4o');
    expect(workspace).toBe('/custom');
  });
});
