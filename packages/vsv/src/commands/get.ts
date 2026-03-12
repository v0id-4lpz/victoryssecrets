// get.ts — vsv get <service.field> -e <env> [-f <vault>]

import { Command } from 'commander';
import { promptPassword, resolveFile } from '../cli-utils';
import * as vault from '../vault';
import { resolveValue } from '../services/secret-ops';

export const getCommand = new Command('get')
  .description('Get a single secret value')
  .argument('<ref>', 'Secret reference (service.field)')
  .requiredOption('-e, --env <env>', 'Environment')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .action(async (ref: string, opts: { env: string; file?: string }) => {
    const filePath = resolveFile(opts);
    const dotIndex = ref.indexOf('.');
    if (dotIndex === -1) {
      process.stderr.write(`Error: invalid reference "${ref}" (expected service.field)\n`);
      process.exit(1);
    }
    const serviceId = ref.slice(0, dotIndex);
    const field = ref.slice(dotIndex + 1);

    const password = await promptPassword();
    await vault.open(filePath, password);

    const data = vault.getData();
    const entry = data.secrets?.[serviceId]?.[field];
    const value = resolveValue(entry, opts.env);

    if (value === undefined) {
      process.stderr.write(`Error: secret "${ref}" not found for env "${opts.env}"\n`);
      vault.lock();
      process.exit(1);
    }

    process.stdout.write(value);
    vault.lock();
  });
