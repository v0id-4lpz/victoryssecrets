// vsv — public API for programmatic usage

export type {
  VaultData,
  VaultSettings,
  Service,
  EnvironmentMeta,
  SecretEntry,
  Templates,
  SearchResult,
  EnvEntry,
  GenerateResult,
} from './types/vault';

export * as vault from './vault';
export * as crypto from './crypto';
export { readVaultFile, writeVaultFile, fetchVaultFile, validateVaultPath, isRemoteUrl } from './storage';

export * as serviceOps from './services/service-ops';
export * as environmentOps from './services/environment-ops';
export * as secretOps from './services/secret-ops';
export * as templateOps from './services/template-ops';
export * as settingsOps from './services/settings-ops';
export * as envGenerator from './services/env-generator';
export * as search from './services/search';

export { createEmpty, ensureStructure, CURRENT_VERSION, GLOBAL_ENV } from './models/vault-schema';
export { sanitizeId, labelToId } from './models/validators';

export { VsvClient, createClient } from './agent/client';
export { readSecretsFromFd } from './agent/secret-fd';
