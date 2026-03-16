// check.ts — vsv check [-e <env>] [-f <vault>]

import { Command } from 'commander';
import { promptPassword, resolveFile, isAgentRunning, warn } from '../cli-utils';
import { createClient } from '../agent/client';
import * as vault from '../vault';
import { GLOBAL_ENV } from '../models/vault-schema';
import type { VaultData } from '../types/vault';

function checkEnv(data: VaultData, envId: string): { missing: string[]; empty: string[] } {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const [serviceId, fields] of Object.entries(data.secrets)) {
    for (const [field, entry] of Object.entries(fields)) {
      const ref = `${serviceId}.${field}`;
      const envVal = entry.values[envId];
      const globalVal = entry.values[GLOBAL_ENV];

      if (envVal === undefined && globalVal === undefined) {
        missing.push(ref);
      } else if (envVal === '' && globalVal === undefined) {
        empty.push(ref);
      } else if (envVal === undefined && globalVal === '') {
        empty.push(ref);
      }
    }
  }

  return { missing, empty };
}

export const checkCommand = new Command('check')
  .description('Validate that all secrets have values for an environment')
  .option('-e, --env <env>', 'Environment to check')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .option('--json', 'Output as JSON')
  .action(async (opts: { env?: string; file?: string; json?: boolean }) => {
    let data: VaultData;
    let envId: string;
    let openedLocally = false;

    // Agent mode
    if (isAgentRunning()) {
      const client = createClient({ env: opts.env });
      data = await client.getData();
      if (!opts.env) {
        const info = await client.getInfo();
        if (!info.env) {
          process.stderr.write('Error: -e <env> is required\n');
          client.disconnect();
          process.exit(1);
        }
        envId = info.env;
      } else {
        envId = opts.env;
      }
      client.disconnect();
    } else {
      // Direct mode
      if (!opts.env) {
        process.stderr.write('Error: -e <env> is required when agent is not running\n');
        process.exit(1);
      }
      envId = opts.env;
      const filePath = resolveFile(opts);
      const password = await promptPassword();
      await vault.open(filePath, password);
      openedLocally = true;
      data = vault.getData();
    }

    try {
      if (!Object.hasOwn(data.environments, envId)) {
        process.stderr.write(`Error: environment "${envId}" not found\n`);
        process.exit(1);
      }

      const { missing, empty } = checkEnv(data, envId);
      const ok = missing.length === 0 && empty.length === 0;

      if (opts.json) {
        process.stdout.write(JSON.stringify({ env: envId, ok, missing, empty }, null, 2) + '\n');
      } else {
        if (ok) {
          process.stderr.write(`All secrets have values for env "${envId}"\n`);
        } else {
          if (missing.length > 0) {
            process.stderr.write(`Missing values for env "${envId}":\n`);
            for (const ref of missing) process.stderr.write(`  ${ref}\n`);
          }
          if (empty.length > 0) {
            warn(`Empty values for env "${envId}":\n`);
            for (const ref of empty) warn(`  ${ref}\n`);
          }
        }
      }

      process.exit(ok ? 0 : 1);
    } finally {
      if (openedLocally) vault.lock();
    }
  });
