// src/config.ts

export interface Config {
  model: string;
  workspaceDir: string;
  baseUrl: string;
}

export function getConfig(): Config {
  return {
    model: process.env.MODEL ?? 'claude-sonnet-4-5',
    workspaceDir: process.env.RALPH_WORKSPACE ?? '/workspace',
    baseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
  };
}
