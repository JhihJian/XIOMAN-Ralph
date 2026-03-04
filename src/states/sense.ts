// src/states/sense.ts
import { execSync } from 'child_process';
import { getRecentEpisodes } from '../memory/manager.js';
import type { FourLayerMemory, Context } from '../types.js';
import { getConfig } from '../config.js';

export function buildContext(memory: FourLayerMemory, projectState: string): Context {
  return {
    goal: memory.goal,
    semantic: memory.semantic,
    procedural: memory.procedural,
    recentEpisodes: getRecentEpisodes(memory.episodic, 10),
    projectState,
  };
}

export async function sense(memory: FourLayerMemory): Promise<Context> {
  const { workspaceDir } = getConfig();

  let projectState = '';
  try {
    const gitStatus = execSync('git status --short', {
      cwd: workspaceDir,
      encoding: 'utf-8',
      timeout: 5000,
    });
    const recentFiles = execSync('ls -lt | head -10', {
      cwd: workspaceDir,
      encoding: 'utf-8',
      timeout: 5000,
    });
    projectState = `Git Status:\n${gitStatus}\nRecent Files:\n${recentFiles}`;
  } catch {
    projectState = '（无法获取项目状态）';
  }

  return buildContext(memory, projectState);
}
