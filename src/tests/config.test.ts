// src/tests/config.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { getConfig } from '../config.js';

describe('getConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env vars to their original state
    process.env.RALPH_PROVIDER = originalEnv.RALPH_PROVIDER;
    process.env.RALPH_MODEL = originalEnv.RALPH_MODEL;
    process.env.RALPH_WORKSPACE = originalEnv.RALPH_WORKSPACE;
    // Remove keys that were not originally set
    if (!originalEnv.RALPH_PROVIDER) delete process.env.RALPH_PROVIDER;
    if (!originalEnv.RALPH_MODEL) delete process.env.RALPH_MODEL;
    if (!originalEnv.RALPH_WORKSPACE) delete process.env.RALPH_WORKSPACE;
  });

  it('returns defaults when env vars are not set', () => {
    delete process.env.RALPH_PROVIDER;
    delete process.env.RALPH_MODEL;
    delete process.env.RALPH_WORKSPACE;
    const config = getConfig();
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4-5');
    expect(config.workspaceDir).toBe('/workspace');
  });

  it('uses RALPH_PROVIDER when set', () => {
    process.env.RALPH_PROVIDER = 'openai';
    const config = getConfig();
    expect(config.provider).toBe('openai');
  });

  it('uses RALPH_MODEL when set', () => {
    process.env.RALPH_MODEL = 'gpt-4o';
    const config = getConfig();
    expect(config.model).toBe('gpt-4o');
  });

  it('uses RALPH_WORKSPACE when set', () => {
    process.env.RALPH_WORKSPACE = '/custom/path';
    const config = getConfig();
    expect(config.workspaceDir).toBe('/custom/path');
  });
});
