// run.ts — vsv run -e <env> [-f <vault>] -- <command...>

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { promptPassword, resolveFile } from '../cli-utils';
import * as vault from '../vault';
import { generateEnv } from '../services/env-generator';

export const runCommand = new Command('run')
  .description('Run a command with secrets injected as env vars')
  .requiredOption('-e, --env <env>', 'Environment')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .argument('<command...>', 'Command to run')
  .passThroughOptions()
  .action(async (commandArgs: string[], opts: { env: string; file?: string }) => {
    const filePath = resolveFile(opts);
    const password = await promptPassword();
    await vault.open(filePath, password);

    const data = vault.getData();
    const { entries, warnings } = generateEnv(data, opts.env);

    for (const w of warnings) {
      process.stderr.write(`Warning: ${w}\n`);
    }

    // Build env vars from resolved entries
    const secretEnv: Record<string, string> = {};
    for (const entry of entries) {
      secretEnv[entry.key] = entry.value;
    }

    // Clear vault from memory before spawning
    vault.lock();

    const [cmd, ...args] = commandArgs;
    const child = spawn(cmd!, args, {
      stdio: 'inherit',
      env: { ...process.env, ...secretEnv },
    });

    child.on('error', (err) => {
      process.stderr.write(`Error: failed to start "${cmd}": ${err.message}\n`);
      process.exit(1);
    });

    child.on('exit', (code) => {
      process.exit(code ?? 1);
    });
  });
