// vsv — Victory's Secrets CLI

import { Command } from 'commander';
import { initCommand } from '../commands/init';
import { getCommand } from '../commands/get';
import { setCommand } from '../commands/set';
import { envCommand } from '../commands/env';
import { runCommand } from '../commands/run';
import { listCommand } from '../commands/list';

const program = new Command();

program
  .name('vsv')
  .description("Victory's Secrets — secrets manager CLI")
  .version('0.1.0')
  .enablePositionalOptions();

program.addCommand(initCommand);
program.addCommand(getCommand);
program.addCommand(setCommand);
program.addCommand(listCommand);
program.addCommand(envCommand);
program.addCommand(runCommand);

program.parseAsync().catch((err: Error) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
