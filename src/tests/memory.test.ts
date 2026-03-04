// src/tests/memory.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadMemory, appendEpisodic, updateMemoryFile, initMemory } from '../memory/manager.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ralph-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true });
});

describe('initMemory', () => {
  it('creates four memory files', async () => {
    await initMemory(tmpDir);
    const { readFileSync } = await import('fs');
    expect(readFileSync(join(tmpDir, 'goal.md'), 'utf-8')).toContain('# Goal');
    expect(readFileSync(join(tmpDir, 'semantic.md'), 'utf-8')).toContain('# Semantic Memory');
    expect(readFileSync(join(tmpDir, 'procedural.md'), 'utf-8')).toContain('# Procedural Memory');
    expect(readFileSync(join(tmpDir, 'episodic.md'), 'utf-8')).toContain('# Episodic Memory');
  });
});

describe('loadMemory', () => {
  it('reads all four files', async () => {
    await initMemory(tmpDir);
    const memory = await loadMemory(tmpDir);
    expect(memory.goal).toContain('# Goal');
    expect(memory.semantic).toContain('# Semantic Memory');
    expect(memory.procedural).toContain('# Procedural Memory');
    expect(memory.episodic).toContain('# Episodic Memory');
  });

  it('throws if goal.md is missing', async () => {
    await expect(loadMemory(tmpDir)).rejects.toThrow();
  });
});

describe('appendEpisodic', () => {
  it('appends entry to episodic.md', async () => {
    await initMemory(tmpDir);
    await appendEpisodic(tmpDir, {
      timestamp: '2026-03-04T10:00:00Z',
      iteration: 1,
      action: '修复类型错误',
      priority: 0.85,
      result: 'success',
      learning: '类型定义应集中管理',
    });
    const { readFileSync } = await import('fs');
    const content = readFileSync(join(tmpDir, 'episodic.md'), 'utf-8');
    expect(content).toContain('修复类型错误');
    expect(content).toContain('success');
  });
});

describe('updateMemoryFile', () => {
  it('appends content to semantic.md', async () => {
    await initMemory(tmpDir);
    await updateMemoryFile(tmpDir, 'semantic', '\n## New Pattern\n- Use strict types');
    const { readFileSync } = await import('fs');
    const content = readFileSync(join(tmpDir, 'semantic.md'), 'utf-8');
    expect(content).toContain('New Pattern');
  });
});
