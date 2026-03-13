// vsv — Victory's Secrets CLI

import { Command } from 'commander';
import { setQuiet } from '../cli-utils';
import { initCommand } from '../commands/init';
import { getCommand } from '../commands/get';
import { setCommand } from '../commands/set';
import { envCommand } from '../commands/env';
import { runCommand } from '../commands/run';
import { listCommand } from '../commands/list';
import { checkCommand } from '../commands/check';
import { agentCommand } from '../commands/agent';

const program = new Command();

program
  .name('vsv')
  .description("Victory's Secrets — secrets manager CLI")
  .version('0.1.0')
  .enablePositionalOptions()
  .option('-q, --quiet', 'Suppress warnings and info messages');

program.hook('preAction', () => {
  const opts = program.opts();
  if (opts.quiet) setQuiet(true);
});

program.addCommand(initCommand);
program.addCommand(getCommand);
program.addCommand(setCommand);
program.addCommand(listCommand);
program.addCommand(envCommand);
program.addCommand(runCommand);
program.addCommand(checkCommand);
program.addCommand(agentCommand);

program.parseAsync().catch((err: Error) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
