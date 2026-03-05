// src/pi/client.ts
import { spawn } from 'child_process';
import { getConfig } from '../config.js';

interface ClaudeResult {
  output: string;
  exitCode: number;
}

async function runClaude(prompt: string, tools: boolean): Promise<string> {
  const { model, workspaceDir, baseUrl } = getConfig();

  const args = tools
    ? ['--print', '--allowedTools', 'Read,Write,Edit,Bash(*)', '-p', prompt]
    : ['--print', '--no-tools', '-p', prompt];

  const env = {
    ...process.env,
    ANTHROPIC_BASE_URL: baseUrl,
    MODEL: model,
  };

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      cwd: workspaceDir,
      env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI failed (${code}): ${stderr || stdout}`));
      } else {
        resolve(stdout);
      }
    });

    child.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

export async function callLLM(prompt: string): Promise<string> {
  return runClaude(prompt, false);
}

export async function callAgent(prompt: string): Promise<string> {
  return runClaude(prompt, true);
}
