#!/usr/bin/env node
/**
 * aiko-boot CLI
 *
 * 顶层入口：注册子命令（create / add app / add api / add feature / list）。
 */
import { Command } from 'commander';
import { registerCreateCommand } from './commands/init.js';
import { registerAddAppCommand } from './commands/add-app.js';
import { registerAddApiCommand } from './commands/add-api.js';
import { registerAddFeatureCommand } from './commands/add-feature.js';
import { registerListCommand } from './commands/list.js';

export function runCli(argv = process.argv): void {
  const program = new Command();

  program
    .name('aiko-boot')
    .description(
      'Create and extend aiko-boot scaffold projects (monorepo: api, admin, mobile, core)',
    )
    .version('0.2.0');

  // 注册子命令
  registerCreateCommand(program);
  registerAddAppCommand(program);
  registerAddApiCommand(program);
  registerAddFeatureCommand(program);
  registerListCommand(program);

  program.parse(argv);
}

runCli();

