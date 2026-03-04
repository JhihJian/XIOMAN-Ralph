// src/index.ts
import { Command } from 'commander';
import { runLoop } from './loop.js';
import { initMemory } from './memory/manager.js';
import { getConfig } from './config.js';

const program = new Command();

program
  .name('ralph')
  .description('ReAct + Reflection 自主 Agent')
  .version('0.1.0');

program
  .command('run', { isDefault: true })
  .description('启动 Agent 循环')
  .option('--once', '只执行一次迭代', false)
  .option('--max-iterations <n>', '最大迭代次数', '100')
  .action(async (options: Record<string, string | boolean>) => {
    const config = getConfig();
    const memoryDir = `${config.workspaceDir}/memory`;

    console.log('Ralph 启动');
    console.log(`模型: ${config.provider}/${config.model}`);
    console.log(`Workspace: ${config.workspaceDir}`);
    console.log(`记忆目录: ${memoryDir}`);

    await runLoop({
      maxIterations: parseInt(options.maxIterations as string, 10),
      once: options.once as boolean,
      memoryDir,
      workspaceDir: config.workspaceDir,
    });
  });

program
  .command('init')
  .description('初始化记忆文件（在 workspace/memory/ 下创建模板）')
  .action(async () => {
    const config = getConfig();
    const memoryDir = `${config.workspaceDir}/memory`;
    await initMemory(memoryDir);
    console.log(`✓ 记忆文件已初始化: ${memoryDir}`);
    console.log('  请编辑 memory/goal.md 填写你的目标，然后运行 ralph 启动 Agent。');
  });

program.parse();
