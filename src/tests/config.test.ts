// src/tests/config.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { getConfig } from '../config.js';

describe('getConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env vars
    const envKeys = ['MODEL', 'RALPH_WORKSPACE', 'ANTHROPIC_BASE_URL'];
    envKeys.forEach(key => {
      if (originalEnv[key]) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    });
  });

  it('returns defaults when env vars are not set', () => {
    delete process.env.MODEL;
    delete process.env.RALPH_WORKSPACE;
    delete process.env.ANTHROPIC_BASE_URL;
    const config = getConfig();
    expect(config.model).toBe('claude-sonnet-4-5');
    expect(config.workspaceDir).toBe('/workspace');
    expect(config.baseUrl).toBe('https://api.anthropic.com');
  });

  it('uses MODEL when set', () => {
    process.env.MODEL = 'claude-opus-4-6';
    const config = getConfig();
    expect(config.model).toBe('claude-opus-4-6');
  });

  it('uses RALPH_WORKSPACE when set', () => {
    process.env.RALPH_WORKSPACE = '/custom/path';
    const config = getConfig();
    expect(config.workspaceDir).toBe('/custom/path');
  });

  it('uses ANTHROPIC_BASE_URL when set', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://custom.api.com';
    const config = getConfig();
    expect(config.baseUrl).toBe('https://custom.api.com');
  });
});
