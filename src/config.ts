// src/config.ts

export interface Config {
  provider: string;
  model: string;
  workspaceDir: string;
}

export function getConfig(): Config {
  return {
    provider: process.env.RALPH_PROVIDER ?? 'anthropic',
    model: process.env.RALPH_MODEL ?? 'claude-sonnet-4-5',
    workspaceDir: process.env.RALPH_WORKSPACE ?? '/workspace',
  };
}
