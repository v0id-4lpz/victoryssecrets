// set.ts — vsv set <service.field> <value> [-e <env>] [-f <vault>]

import { Command } from 'commander';
import { promptPassword, resolveFile, isAgentRunning } from '../cli-utils';
import { createClient } from '../agent/client';
import { isRemoteUrl } from '../storage';
import * as vault from '../vault';

export const setCommand = new Command('set')
  .description('Set a secret value')
  .argument('<ref>', 'Secret reference (service.field)')
  .argument('[value]', 'Value to set (reads from stdin if omitted)')
  .option('-e, --env <env>', 'Environment')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .option('--create', 'Create the service and secret if they do not exist')
  .action(async (ref: string, value: string | undefined, opts: { env?: string; file?: string; create?: boolean }) => {
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

    // Agent mode
    if (isAgentRunning()) {
      const client = createClient({ env: opts.env });
      const data = await client.getData();
      const envId = opts.env ?? (await client.getInfo()).env;
      if (!envId) {
        process.stderr.write('Error: -e <env> is required when agent has no default env\n');
        client.disconnect();
        process.exit(1);
      }

      if (!data.services[serviceId]) {
        if (!opts.create) {
          process.stderr.write(`Error: service "${serviceId}" not found (use --create to auto-create)\n`);
          client.disconnect();
          process.exit(1);
        }
        await client.addService(serviceId, serviceId);
      }
      if (!data.environments[envId]) {
        if (!opts.create) {
          process.stderr.write(`Error: environment "${envId}" not found (use --create to auto-create)\n`);
          client.disconnect();
          process.exit(1);
        }
        // addEnvironment not exposed on client yet — use setSecretValue which auto-creates env values
      }
      if (!data.secrets[serviceId]?.[field]) {
        if (!opts.create) {
          process.stderr.write(`Error: secret "${ref}" not found (use --create to auto-create)\n`);
          client.disconnect();
          process.exit(1);
        }
        await client.setSecret(serviceId, field);
      }
      await client.setSecretValue(serviceId, field, envId, value);
      client.disconnect();
      process.stderr.write(`Set ${ref} for env "${envId}"\n`);
      return;
    }

    // Direct mode
    if (!opts.env) {
      process.stderr.write('Error: -e <env> is required when agent is not running\n');
      process.exit(1);
    }
    const filePath = resolveFile(opts);
    if (isRemoteUrl(filePath)) {
      process.stderr.write('Error: cannot set secrets on a remote vault (read-only)\n');
      process.exit(1);
    }
    const password = await promptPassword();
    await vault.open(filePath, password);

    const data = vault.getData();

    if (!data.services[serviceId]) {
      if (!opts.create) {
        process.stderr.write(`Error: service "${serviceId}" not found (use --create to auto-create)\n`);
        vault.lock();
        process.exit(1);
      }
      await vault.addService(serviceId, serviceId);
    }

    if (!data.environments[opts.env]) {
      if (!opts.create) {
        process.stderr.write(`Error: environment "${opts.env}" not found (use --create to auto-create)\n`);
        vault.lock();
        process.exit(1);
      }
      await vault.addEnvironment(opts.env);
    }

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
