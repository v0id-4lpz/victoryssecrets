// run.ts — vsv run [-e <env>] [-f <vault>] -- <command...>

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { promptPassword, resolveFile, isAgentRunning, warn } from '../cli-utils';
import { createClient } from '../agent/client';
import * as vault from '../vault';
import { generateEnv } from '../services/env-generator';

function runChild(secretEnv: Record<string, string>, commandArgs: string[]): void {
  const [cmd, ...args] = commandArgs;
  const child = spawn(cmd!, args, {
    stdio: 'inherit',
    env: { ...process.env, ...secretEnv },
  });

  // Forward signals to child process
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP'];
  const handlers = signals.map((sig) => {
    const handler = () => child.kill(sig);
    process.on(sig, handler);
    return { sig, handler };
  });

  child.on('error', (err) => {
    process.stderr.write(`Error: failed to start "${cmd}": ${err.message}\n`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    for (const { sig, handler } of handlers) process.removeListener(sig, handler);
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 1);
    }
  });
}

export const runCommand = new Command('run')
  .description('Run a command with secrets injected as env vars')
  .option('-e, --env <env>', 'Environment')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .argument('<command...>', 'Command to run')
  .passThroughOptions()
  .action(async (commandArgs: string[], opts: { env?: string; file?: string }) => {
    let entries: { key: string; value: string }[];

    // Agent mode
    if (isAgentRunning()) {
      const client = createClient({ env: opts.env });
      const result = await client.env(opts.env);
      client.disconnect();
      for (const w of result.warnings) {
        warn(`Warning: ${w}\n`);
      }
      entries = result.entries;
    } else {
      // Direct mode
      if (!opts.env) {
        process.stderr.write('Error: -e <env> is required when agent is not running\n');
        process.exit(1);
      }
      const filePath = resolveFile(opts);
      const password = await promptPassword();
      await vault.open(filePath, password);

      const data = vault.getData();
      const result = generateEnv(data, opts.env);

      for (const w of result.warnings) {
        warn(`Warning: ${w}\n`);
      }
      entries = result.entries;
      vault.lock();
    }

    const secretEnv: Record<string, string> = {};
    for (const entry of entries) {
      secretEnv[entry.key] = entry.value;
    }

    runChild(secretEnv, commandArgs);
  });
