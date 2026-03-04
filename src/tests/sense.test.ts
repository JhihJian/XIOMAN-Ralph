// src/tests/sense.test.ts
import { describe, it, expect } from 'vitest';
import { buildContext } from '../states/sense.js';
import type { FourLayerMemory } from '../types.js';

const mockMemory: FourLayerMemory = {
  goal: '# Goal\n完成任务',
  semantic: '# Semantic Memory\n项目类型: TypeScript',
  procedural: '# Procedural Memory\n先写测试',
  episodic: '# Episodic Memory\n\n## 2026-03-04 - Iteration #1\n**Action**: 初始化项目\n---',
};

describe('buildContext', () => {
  it('includes all four memory layers', () => {
    const context = buildContext(mockMemory, 'git status: clean\nfiles: 3');
    expect(context.goal).toContain('完成任务');
    expect(context.semantic).toContain('TypeScript');
    expect(context.procedural).toContain('先写测试');
    expect(context.recentEpisodes).toContain('初始化项目');
  });

  it('includes project state', () => {
    const context = buildContext(mockMemory, 'git status: 2 modified files');
    expect(context.projectState).toContain('2 modified files');
  });

  it('limits recent episodes to last 10', () => {
    const manyEpisodes = Array.from({ length: 15 }, (_, i) =>
      `## ts - Iteration #${i + 1}\n**Action**: 动作${i + 1}\n---`
    ).join('\n');
    const memory = { ...mockMemory, episodic: `# Episodic Memory\n\n${manyEpisodes}` };
    const context = buildContext(memory, '');
    expect(context.recentEpisodes).not.toContain('动作1\n');
    expect(context.recentEpisodes).toContain('动作15');
  });
});
