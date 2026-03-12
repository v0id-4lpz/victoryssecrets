// list.ts — vsv list [-f <vault>] [services|envs|secrets]

import { Command } from 'commander';
import { promptPassword, resolveFile } from '../cli-utils';
import * as vault from '../vault';
import { GLOBAL_ENV } from '../models/vault-schema';

function listServices(): void {
  const data = vault.getData();
  const services = Object.entries(data.services);
  if (services.length === 0) { process.stderr.write('No services\n'); return; }
  for (const [id, svc] of services) {
    const comment = svc.comment ? `  # ${svc.comment}` : '';
    process.stdout.write(`${id}  ${svc.label}${comment}\n`);
  }
}

function listEnvironments(): void {
  const data = vault.getData();
  const envs = Object.entries(data.environments);
  if (envs.length === 0) { process.stderr.write('No environments\n'); return; }
  for (const [id, meta] of envs) {
    const comment = meta.comment ? `  # ${meta.comment}` : '';
    process.stdout.write(`${id}${comment}\n`);
  }
}

function listSecrets(envId?: string): void {
  const data = vault.getData();
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

export const listCommand = new Command('list')
  .description('List services, environments, or secrets')
  .argument('[type]', 'What to list: services, envs, secrets (default: all)')
  .option('-e, --env <env>', 'Show values for a specific environment (secrets only)')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .action(async (type: string | undefined, opts: { env?: string; file?: string }) => {
    const filePath = resolveFile(opts);
    const password = await promptPassword();
    await vault.open(filePath, password);

    const target = type?.toLowerCase();

    if (!target || target === 'all') {
      process.stdout.write('Services:\n');
      listServices();
      process.stdout.write('\nEnvironments:\n');
      listEnvironments();
      process.stdout.write('\nSecrets:\n');
      listSecrets(opts.env);
    } else if (target === 'services' || target === 'svc') {
      listServices();
    } else if (target === 'envs' || target === 'environments' || target === 'env') {
      listEnvironments();
    } else if (target === 'secrets') {
      listSecrets(opts.env);
    } else {
      process.stderr.write(`Unknown type "${target}". Use: services, envs, secrets\n`);
      vault.lock();
      process.exit(1);
    }

    vault.lock();
  });
