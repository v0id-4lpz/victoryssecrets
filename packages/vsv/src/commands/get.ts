// get.ts — vsv get <service.field> [-e <env>] [-f <vault>]

import { Command } from 'commander';
import { promptPassword, resolveFile, isAgentRunning } from '../cli-utils';
import { createClient } from '../agent/client';
import * as vault from '../vault';
import { resolveValue } from '../services/secret-ops';

export const getCommand = new Command('get')
  .description('Get a single secret value')
  .argument('<ref>', 'Secret reference (service.field)')
  .option('-e, --env <env>', 'Environment')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .action(async (ref: string, opts: { env?: string; file?: string }) => {
    const dotIndex = ref.indexOf('.');
    if (dotIndex === -1) {
      process.stderr.write(`Error: invalid reference "${ref}" (expected service.field)\n`);
      process.exit(1);
    }

    // Agent mode
    if (isAgentRunning()) {
      const client = createClient({ env: opts.env });
      const value = await client.get(ref, opts.env);
      client.disconnect();
      if (value === null) {
        process.stderr.write(`Error: secret "${ref}" not found\n`);
        process.exit(1);
      }
      process.stdout.write(value + (process.stdout.isTTY ? '\n' : ''));
      return;
    }

    // Direct mode
    if (!opts.env) {
      process.stderr.write('Error: -e <env> is required when agent is not running\n');
      process.exit(1);
    }
    const filePath = resolveFile(opts);
    const password = await promptPassword();
    await vault.open(filePath, password);

    try {
      const serviceId = ref.slice(0, dotIndex);
      const field = ref.slice(dotIndex + 1);
      const data = vault.getData();
      const entry = data.secrets?.[serviceId]?.[field];
      const value = resolveValue(entry, opts.env);

      if (value === undefined) {
        process.stderr.write(`Error: secret "${ref}" not found for env "${opts.env}"\n`);
        process.exit(1);
      }

      process.stdout.write(value + (process.stdout.isTTY ? '\n' : ''));
    } finally {
      vault.lock();
    }
  });
