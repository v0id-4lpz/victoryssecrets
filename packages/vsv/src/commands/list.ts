// list.ts — vsv list [services|envs|secrets] [-e <env>] [-f <vault>]

import { Command } from 'commander';
import { promptPassword, resolveFile, isAgentRunning } from '../cli-utils';
import { createClient } from '../agent/client';
import * as vault from '../vault';
import { GLOBAL_ENV } from '../models/vault-schema';
import type { VaultData } from '../types/vault';

function printServices(data: VaultData): void {
  const services = Object.entries(data.services);
  if (services.length === 0) { process.stderr.write('No services\n'); return; }
  for (const [id, svc] of services) {
    const comment = svc.comment ? `  # ${svc.comment}` : '';
    process.stdout.write(`${id}  ${svc.label}${comment}\n`);
  }
}

function printEnvironments(data: VaultData): void {
  const envs = Object.entries(data.environments);
  if (envs.length === 0) { process.stderr.write('No environments\n'); return; }
  for (const [id, meta] of envs) {
    const comment = meta.comment ? `  # ${meta.comment}` : '';
    process.stdout.write(`${id}${comment}\n`);
  }
}

function printSecrets(data: VaultData, envId?: string): void {
  const allSecrets = data.secrets;
  if (Object.keys(allSecrets).length === 0) { process.stderr.write('No secrets\n'); return; }

  for (const [serviceId, fields] of Object.entries(allSecrets)) {
    for (const [field, entry] of Object.entries(fields)) {
      if (envId) {
        const val = entry.values[envId] ?? entry.values[GLOBAL_ENV];
        const display = entry.secret ? '••••••' : (val ?? '(empty)');
        process.stdout.write(`${serviceId}.${field}  ${display}\n`);
      } else {
        const envCount = Object.keys(entry.values).length;
        const flag = entry.secret ? ' [secret]' : '';
        process.stdout.write(`${serviceId}.${field}  ${envCount} env(s)${flag}\n`);
      }
    }
  }
}

function printAll(data: VaultData, envId?: string): void {
  process.stdout.write('Services:\n');
  printServices(data);
  process.stdout.write('\nEnvironments:\n');
  printEnvironments(data);
  process.stdout.write('\nSecrets:\n');
  printSecrets(data, envId);
}

function handleType(data: VaultData, type: string | undefined, envId?: string): void {
  const target = type?.toLowerCase();

  if (!target || target === 'all') {
    printAll(data, envId);
  } else if (target === 'services' || target === 'svc') {
    printServices(data);
  } else if (target === 'envs' || target === 'environments' || target === 'env') {
    printEnvironments(data);
  } else if (target === 'secrets') {
    printSecrets(data, envId);
  } else {
    process.stderr.write(`Unknown type "${target}". Use: services, envs, secrets\n`);
    process.exit(1);
  }
}

export const listCommand = new Command('list')
  .description('List services, environments, or secrets')
  .argument('[type]', 'What to list: services, envs, secrets (default: all)')
  .option('-e, --env <env>', 'Show values for a specific environment (secrets only)')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .option('--json', 'Output as JSON')
  .action(async (type: string | undefined, opts: { env?: string; file?: string; json?: boolean }) => {
    let data: VaultData;
    let openedLocally = false;

    // Agent mode
    if (isAgentRunning()) {
      const client = createClient({ env: opts.env });
      data = await client.getData();
      client.disconnect();
    } else {
      // Direct mode
      const filePath = resolveFile(opts);
      const password = await promptPassword();
      await vault.open(filePath, password);
      openedLocally = true;
      data = vault.getData();
    }

    try {
      if (opts.json) {
        const target = type?.toLowerCase();
        let output: unknown;
        if (!target || target === 'all') output = { services: data.services, environments: data.environments, secrets: data.secrets };
        else if (target === 'services' || target === 'svc') output = data.services;
        else if (target === 'envs' || target === 'environments' || target === 'env') output = data.environments;
        else if (target === 'secrets') output = data.secrets;
        else { process.stderr.write(`Unknown type "${target}". Use: services, envs, secrets\n`); process.exit(1); }
        process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      } else {
        handleType(data, type, opts.env);
      }
    } finally {
      if (openedLocally) vault.lock();
    }
  });
