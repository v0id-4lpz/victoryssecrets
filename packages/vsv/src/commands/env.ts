// env.ts — vsv env [-e <env>] [-f <vault>]

import { Command } from 'commander';
import { promptPassword, resolveFile, isAgentRunning, warn } from '../cli-utils';
import { createClient } from '../agent/client';
import * as vault from '../vault';
import { generateEnv } from '../services/env-generator';

export const envCommand = new Command('env')
  .description('Generate .env output for an environment')
  .option('-e, --env <env>', 'Environment')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .option('--json', 'Output as JSON object')
  .action(async (opts: { env?: string; file?: string; json?: boolean }) => {
    let result: { output: string; warnings: string[]; entries: { key: string; value: string }[] };

    // Agent mode
    if (isAgentRunning()) {
      const client = createClient({ env: opts.env });
      result = await client.env(opts.env);
      client.disconnect();
    } else {
      // Direct mode
      if (!opts.env) {
        process.stderr.write('Error: -e <env> is required when agent is not running\n');
        process.exit(1);
      }
      const filePath = resolveFile(opts);
      const password = await promptPassword();
      await vault.open(filePath, password);
      result = generateEnv(vault.getData(), opts.env);
      vault.lock();
    }

    for (const w of result.warnings) {
      warn(`Warning: ${w}\n`);
    }

    if (opts.json) {
      const obj: Record<string, string> = {};
      for (const { key, value } of result.entries) obj[key] = value;
      process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
    } else {
      process.stdout.write(result.output);
    }
  });
