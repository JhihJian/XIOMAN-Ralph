// src/loop.ts
import { loadMemory } from './memory/manager.js';
import { sense } from './states/sense.js';
import { decide } from './states/decide.js';
import { act } from './states/act.js';
import { reflect } from './states/reflect.js';
import type { LoopOptions } from './types.js';

export function shouldStop(iteration: number, options: LoopOptions): boolean {
  if (iteration >= options.maxIterations) return true;
  if (options.once && iteration >= 1) return true;
  return false;
}

export async function runLoop(options: LoopOptions): Promise<void> {
  const memory = await loadMemory(options.memoryDir);
  let iteration = 0;

  let interrupted = false;

  const sigintHandler = () => {
    console.log('\n\n收到中断信号，完成当前迭代后退出...');
    interrupted = true;
  };
  process.on('SIGINT', sigintHandler);

  try {
    while (!interrupted) {
      iteration++;
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Iteration #${iteration}`);
      console.log('='.repeat(50));

      try {
        console.log('\n[SENSE] 读取上下文...');
        const context = await sense(memory);

        console.log('\n[DECIDE] 分析决策...');
        const decision = await decide(context, iteration);

        if (decision.stopReason) {
          console.log(`\n循环结束: ${decision.stopReason}`);
          break;
        }

        console.log(`\n决策: ${decision.selected.action}`);
        console.log(`优先级: ${decision.priority.toFixed(2)}`);

        console.log('\n[ACT] 执行行动...');
        const result = await act(decision.selected);
        console.log(`结果: ${result.success ? '成功' : '失败'}`);

        console.log('\n[REFLECT] 提取经验...');
        await reflect(context, decision, result, iteration, options.memoryDir);

        const updatedMemory = await loadMemory(options.memoryDir);
        Object.assign(memory, updatedMemory);

      } catch (error) {
        const err = error as Error;
        console.error(`\n[ERROR] 迭代 #${iteration} 出错: ${err.message}`);
        // 错误已记录，继续下一轮（iteration 在循环开头已递增）
      }

      if (shouldStop(iteration, options)) {
        console.log(`\n达到停止条件（迭代 ${iteration}/${options.maxIterations}）`);
        break;
      }
    }
  } finally {
    process.off('SIGINT', sigintHandler);
  }
}
