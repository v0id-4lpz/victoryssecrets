// env.ts — vsv env -e <env> [-f <vault>]

import { Command } from 'commander';
import { promptPassword, resolveFile } from '../cli-utils';
import * as vault from '../vault';
import { generateEnv } from '../services/env-generator';

export const envCommand = new Command('env')
  .description('Generate .env output for an environment')
  .requiredOption('-e, --env <env>', 'Environment')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .action(async (opts: { env: string; file?: string }) => {
    const filePath = resolveFile(opts);
    const password = await promptPassword();
    await vault.open(filePath, password);

    const data = vault.getData();
    const { output, warnings } = generateEnv(data, opts.env);

    for (const w of warnings) {
      process.stderr.write(`Warning: ${w}\n`);
    }

    process.stdout.write(output);
    vault.lock();
  });
