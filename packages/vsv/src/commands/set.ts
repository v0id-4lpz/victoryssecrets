// set.ts — vsv set <service.field> <value> -e <env> -f <vault>

import { Command } from 'commander';
import { promptPassword, resolveFile } from '../cli-utils';
import * as vault from '../vault';

export const setCommand = new Command('set')
  .description('Set a secret value')
  .argument('<ref>', 'Secret reference (service.field)')
  .argument('[value]', 'Value to set (reads from stdin if omitted)')
  .requiredOption('-e, --env <env>', 'Environment')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .option('--create', 'Create the service and secret if they do not exist')
  .action(async (ref: string, value: string | undefined, opts: { env: string; file?: string; create?: boolean }) => {
    const filePath = resolveFile(opts);
    const dotIndex = ref.indexOf('.');
    if (dotIndex === -1) {
      process.stderr.write(`Error: invalid reference "${ref}" (expected service.field)\n`);
      process.exit(1);
    }
    const serviceId = ref.slice(0, dotIndex);
    const field = ref.slice(dotIndex + 1);

    // Read value from stdin if not provided as argument
    // But only if stdin is a TTY (interactive) — otherwise stdin is used for password
    if (value === undefined) {
      if (!process.stdin.isTTY) {
        process.stderr.write('Error: value argument is required when piping password via stdin\n');
        process.exit(1);
      }
      value = await readStdin();
    }

    const password = await promptPassword();
    await vault.open(filePath, password);

    const data = vault.getData();

    // Check service exists
    if (!data.services[serviceId]) {
      if (!opts.create) {
        process.stderr.write(`Error: service "${serviceId}" not found (use --create to auto-create)\n`);
        vault.lock();
        process.exit(1);
      }
      await vault.addService(serviceId, serviceId);
    }

    // Check environment exists
    if (!data.environments[opts.env]) {
      if (!opts.create) {
        process.stderr.write(`Error: environment "${opts.env}" not found (use --create to auto-create)\n`);
        vault.lock();
        process.exit(1);
      }
      await vault.addEnvironment(opts.env);
    }

    // Create secret entry if it doesn't exist
    if (!data.secrets[serviceId]?.[field]) {
      if (!opts.create) {
        process.stderr.write(`Error: secret "${ref}" not found (use --create to auto-create)\n`);
        vault.lock();
        process.exit(1);
      }
      await vault.setSecret(serviceId, field);
    }

    await vault.setSecretValue(serviceId, field, opts.env, value);
    process.stderr.write(`Set ${ref} for env "${opts.env}"\n`);
    vault.lock();
  });

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trimEnd()));
    process.stdin.on('error', reject);
  });
}
