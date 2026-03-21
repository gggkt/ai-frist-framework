import type { Command } from 'commander';
import { createEnvUseCase } from '../usecases/env.usecase.js';
import { createCliLogger } from '../core/logger.js';

/**
 * env 命令集合：list / add / remove
 * - list：列出现有环境（基于 .env.<mode> 文件）
 * - add：生成 .env.<mode> 并注入 dev:<mode>/build:<mode>/start:<mode> 脚本
 * - remove：删除 .env.<mode> 并清理对应脚本
 */
export function registerEnvCommand(program: Command): void {
  const envCmd = program
    .command('env')
    .description('Manage scaffold multi-environment files and scripts');

  envCmd
    .command('list')
    .option('--root <dir>', '脚手架根目录（默认：当前工作目录）')
    .action(async (options: any) => {
      const logger = createCliLogger();
      const usecase = createEnvUseCase({ logger });
      await usecase.list({
        rootDir: options.root ?? process.cwd(),
      });
    });

  envCmd
    .command('add')
    .argument('<mode>', '环境模式，例如 dev / stage / prod / qa')
    .option('--root <dir>', '脚手架根目录（默认：当前工作目录）')
    .option('--force', '覆盖已有 .env.<mode> 并更新脚本')
    .option('--dry-run', '仅显示将要执行的操作，不实际写入文件')
    .action(async (mode: string, options: any) => {
      const logger = createCliLogger();
      const usecase = createEnvUseCase({ logger });
      await usecase.add({
        rootDir: options.root ?? process.cwd(),
        mode,
        dryRun: !!options.dryRun,
        force: !!options.force,
      });
    });

  envCmd
    .command('remove')
    .argument('<mode>', '环境模式，例如 dev / stage / prod / qa')
    .option('--root <dir>', '脚手架根目录（默认：当前工作目录）')
    .option('--force', '即使脚本/文件不存在也继续')
    .option('--dry-run', '仅显示将要执行的操作，不实际写入文件')
    .action(async (mode: string, options: any) => {
      const logger = createCliLogger();
      const usecase = createEnvUseCase({ logger });
      await usecase.remove({
        rootDir: options.root ?? process.cwd(),
        mode,
        dryRun: !!options.dryRun,
        force: !!options.force,
      });
    });
}

