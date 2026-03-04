// src/memory/manager.ts
import { readFile, writeFile, appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { FourLayerMemory } from '../types.js';

const INITIAL_TEMPLATES: Record<string, string> = {
  'goal.md': `# Goal\n\n> 在此填写你希望 Ralph 完成的目标。\n\n## Success Criteria\n- [ ] 目标1\n- [ ] 目标2\n\n## Constraints\n- 约束条件1\n`,
  'semantic.md': `# Semantic Memory\n\n## Project Context\n（Ralph 会自动维护此文件）\n\n## Key Concepts\n`,
  'procedural.md': `# Procedural Memory\n\n## Patterns（成功经验）\n\n## Anti-Patterns（失败教训）\n`,
  'episodic.md': `# Episodic Memory\n\n`,
};

export async function initMemory(memoryDir: string): Promise<void> {
  await mkdir(memoryDir, { recursive: true });
  for (const [filename, content] of Object.entries(INITIAL_TEMPLATES)) {
    const path = join(memoryDir, filename);
    if (!existsSync(path)) {
      await writeFile(path, content, 'utf-8');
    }
  }
}

export async function loadMemory(memoryDir: string): Promise<FourLayerMemory> {
  const read = (file: string) => readFile(join(memoryDir, file), 'utf-8');
  const [goal, semantic, procedural, episodic] = await Promise.all([
    read('goal.md'),
    read('semantic.md'),
    read('procedural.md'),
    read('episodic.md'),
  ]);
  return { goal, semantic, procedural, episodic };
}

export function getRecentEpisodes(episodic: string, n: number): string {
  const sections = episodic.split('\n---\n').filter(s => s.trim().length > 0);
  return sections.slice(-n).join('\n---\n');
}

export interface EpisodicEntry {
  timestamp: string;
  iteration: number;
  action: string;
  priority: number;
  result: 'success' | 'failed';
  learning: string;
}

export async function appendEpisodic(
  memoryDir: string,
  entry: EpisodicEntry
): Promise<void> {
  const text = `\n## ${entry.timestamp} - Iteration #${entry.iteration}\n**Action**: ${entry.action} (Priority: ${entry.priority.toFixed(2)})\n**Result**: ${entry.result}\n**Learning**: ${entry.learning}\n\n---\n`;
  await appendFile(join(memoryDir, 'episodic.md'), text, 'utf-8');
}

export async function updateMemoryFile(
  memoryDir: string,
  layer: 'semantic' | 'procedural',
  content: string
): Promise<void> {
  await appendFile(join(memoryDir, `${layer}.md`), content, 'utf-8');
}
