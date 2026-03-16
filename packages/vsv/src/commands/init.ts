// init.ts — vsv init -f <path>

import { existsSync } from 'node:fs';
import { Command } from 'commander';
import { promptPassword } from '../cli-utils';
import * as vault from '../vault';
import { MIN_PASSWORD_LENGTH } from '../vault';

export const initCommand = new Command('init')
  .description('Create a new vault')
  .requiredOption('-f, --file <path>', 'Vault file path')
  .action(async (opts: { file: string }) => {
    if (existsSync(opts.file)) {
      process.stderr.write(`Error: file "${opts.file}" already exists\n`);
      process.exit(1);
    }

    if (!process.stdin.isTTY) {
      process.stderr.write('Error: vault creation requires an interactive terminal\n');
      process.exit(1);
    }

    const password = await promptPassword('Password: ');
    if (password.length < MIN_PASSWORD_LENGTH) {
      process.stderr.write(`Error: password must be at least ${MIN_PASSWORD_LENGTH} characters\n`);
      process.exit(1);
    }
    const confirm = await promptPassword('Confirm: ');
    if (password !== confirm) {
      process.stderr.write('Error: passwords do not match\n');
      process.exit(1);
    }

    await vault.create(opts.file, password);
    vault.lock();
    process.stderr.write(`Vault created: ${opts.file}\n`);
  });
