// src/pi/client.ts
import {
  createAgentSession,
  SessionManager,
  createCodingTools,
  AuthStorage,
  ModelRegistry,
} from '@mariozechner/pi-coding-agent';
import { getModel } from '@mariozechner/pi-ai';
import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent';
import { getConfig } from '../config.js';

function getConfiguredModel() {
  const { provider, model } = getConfig();
  // getModel 的参数类型是泛型，用 as any 绕过 strict provider/model 类型检查
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = getModel(provider as any, model as any);
  if (!m) {
    throw new Error(
      `未知模型: ${provider}/${model}。请检查 RALPH_PROVIDER 和 RALPH_MODEL 环境变量。`
    );
  }
  return m;
}

type AgentSession = Awaited<ReturnType<typeof createAgentSession>>['session'];

function collectTextOutput(session: AgentSession): Promise<string> {
  return new Promise((resolve) => {
    let result = '';
    const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
      if (
        event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta'
      ) {
        result += event.assistantMessageEvent.delta;
      }
      if (event.type === 'agent_end') {
        unsubscribe();
        resolve(result);
      }
    });
  });
}

/**
 * 纯推理调用：用于 DECIDE 和 REFLECT 阶段（无工具）
 */
export async function callLLM(prompt: string): Promise<string> {
  const authStorage = AuthStorage.create();
  const modelRegistry = new ModelRegistry(authStorage);

  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    model: getConfiguredModel(),
    tools: [],
    authStorage,
    modelRegistry,
  });

  const outputPromise = collectTextOutput(session);
  await session.prompt(prompt);
  return outputPromise;
}

/**
 * 带工具调用：用于 ACT 阶段（read, write, edit, bash）
 */
export async function callAgent(prompt: string): Promise<string> {
  const { workspaceDir } = getConfig();
  const authStorage = AuthStorage.create();
  const modelRegistry = new ModelRegistry(authStorage);

  const { session } = await createAgentSession({
    cwd: workspaceDir,
    sessionManager: SessionManager.inMemory(),
    model: getConfiguredModel(),
    tools: createCodingTools(workspaceDir),
    authStorage,
    modelRegistry,
  });

  const outputPromise = collectTextOutput(session);
  await session.prompt(prompt);
  return outputPromise;
}
