// vault.ts — stateful orchestrator (Node.js pure)

import { webcrypto, timingSafeEqual } from 'node:crypto';
import type { VaultData, VaultSettings, SecretEntry } from './types/vault';
import { encrypt, decrypt, deriveKey, generateSalt, SALT_LENGTH, IV_LENGTH } from './crypto';
import { readVaultFile, writeVaultFile, fetchVaultFile, isRemoteUrl } from './storage';
import { createEmpty, ensureStructure } from './models/vault-schema';
import { isUnsafeName, isReservedEnvName } from './models/validators';
import * as serviceOps from './services/service-ops';
import * as environmentOps from './services/environment-ops';
import * as secretOps from './services/secret-ops';
import * as templateOps from './services/template-ops';
import * as settingsOps from './services/settings-ops';

function assertSafeName(name: string, label: string): void {
  if (isUnsafeName(name)) throw new Error(`Unsafe ${label}: "${name}" is a reserved name`);
}

type CKey = webcrypto.CryptoKey;

let vaultData: VaultData | null = null;
let cryptoKey: CKey | null = null;
let keySalt: Uint8Array | null = null;
let vaultPath: string | null = null;
let remoteMode = false;
let persistQueue: Promise<void> = Promise.resolve();

// --- State ---

export function getData(): VaultData {
  if (!vaultData) throw new Error('Vault is not open');
  return vaultData;
}

export function isUnlocked(): boolean {
  return vaultData !== null;
}

export function getPath(): string | null {
  return vaultPath;
}

export function isRemote(): boolean {
  return remoteMode;
}

export function isReadOnly(): boolean {
  return remoteMode || (vaultData?.settings.readOnly === true);
}

export const MIN_PASSWORD_LENGTH = 12;

export async function create(filePath: string, password: string): Promise<VaultData> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const salt = generateSalt();
  cryptoKey = await deriveKey(password, salt);
  keySalt = salt;
  vaultPath = filePath;
  vaultData = createEmpty();
  await persist();
  return vaultData;
}

export async function open(filePath: string, password: string): Promise<VaultData> {
  const remote = isRemoteUrl(filePath);
  const buffer = remote ? await fetchVaultFile(filePath) : readVaultFile(filePath);
  const result = await decrypt(buffer, password);
  vaultData = ensureStructure(result.data);
  cryptoKey = result.key;
  keySalt = result.salt;
  vaultPath = filePath;
  remoteMode = remote;
  return vaultData;
}

export async function refresh(): Promise<VaultData> {
  if (!vaultPath || !cryptoKey || !keySalt) throw new Error('Vault not open');
  if (!remoteMode) throw new Error('Refresh is only supported for remote vaults');
  const buffer = await fetchVaultFile(vaultPath);
  const raw = new Uint8Array(buffer);
  const salt = raw.slice(0, SALT_LENGTH);
  // If salt changed, the password was changed — we can't decrypt with our key
  if (salt.length !== keySalt.length || !timingSafeEqual(Buffer.from(salt), Buffer.from(keySalt))) {
    throw new Error('Remote vault password has changed — restart agent with new password');
  }
  const iv = raw.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = raw.slice(SALT_LENGTH + IV_LENGTH);
  const decrypted = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
  const decryptedBytes = new Uint8Array(decrypted);
  const json = new TextDecoder().decode(decryptedBytes);
  let data;
  try { data = JSON.parse(json); } catch { throw new Error('Vault data is corrupted (invalid JSON)'); } finally { decryptedBytes.fill(0); }
  vaultData = ensureStructure(data);
  return vaultData;
}

async function _persist(bypassReadOnly = false): Promise<void> {
  // Serialize writes to prevent concurrent file corruption
  const prev = persistQueue;
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const p = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  // Prevent unhandled rejection warnings — errors are already propagated via throw
  p.catch(() => {});
  persistQueue = p;

  try {
    // Wait for previous write — catch its error so we still attempt ours
    // (a failed write should not block subsequent writes from persisting current state)
    await prev.catch(() => {});
    if (!vaultData || !cryptoKey || !vaultPath) throw new Error('Vault not open');
    if (remoteMode) throw new Error('Cannot write to a remote vault (read-only)');
    if (!bypassReadOnly && vaultData.settings.readOnly) throw new Error('Vault is read-only');
    const encrypted = await encrypt(vaultData, cryptoKey, keySalt!);
    writeVaultFile(vaultPath, encrypted);
    resolve();
  } catch (e) {
    reject(e as Error); // signal failure to any write waiting on us
    throw e;
  }
}

export function persist(): Promise<void> {
  return _persist(false);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!vaultData || !cryptoKey || !keySalt || !vaultPath) throw new Error('Vault not open');
  if (remoteMode) throw new Error('Cannot change password on a remote vault');
  if (vaultData.settings.readOnly) throw new Error('Vault is read-only');
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  // Verify current password by decrypting the vault file from disk (1 Argon2id)
  const buffer = readVaultFile(vaultPath);
  try {
    await decrypt(buffer, currentPassword);
  } catch {
    throw new Error('Wrong password');
  }
  const newSalt = generateSalt();
  cryptoKey = await deriveKey(newPassword, newSalt);
  keySalt = newSalt;
  await persist();
}

export function lock(): void {
  if (keySalt) keySalt.fill(0);
  vaultData = null;
  cryptoKey = null;
  keySalt = null;
  vaultPath = null;
  remoteMode = false;
  persistQueue = Promise.resolve();
}

// --- Services ---

export function hasService(id: string): boolean {
  return serviceOps.hasService(getData(), id);
}

export async function addService(id: string, label: string, comment = ''): Promise<void> {
  assertSafeName(id, 'service id');
  serviceOps.addService(getData(), id, label, comment);
  await persist();
}

export async function deleteService(id: string): Promise<void> {
  serviceOps.deleteService(getData(), id);
  await persist();
}

export async function renameService(id: string, newLabel: string): Promise<void> {
  serviceOps.renameServiceLabel(getData(), id, newLabel);
  await persist();
}

export async function renameServiceId(oldId: string, newId: string): Promise<void> {
  assertSafeName(newId, 'service id');
  serviceOps.renameServiceId(getData(), oldId, newId);
  await persist();
}

export async function setServiceComment(id: string, comment: string): Promise<void> {
  serviceOps.setServiceComment(getData(), id, comment);
  await persist();
}

// --- Environments ---

export function hasEnvironment(envId: string): boolean {
  return environmentOps.hasEnvironment(getData(), envId);
}

export async function addEnvironment(envId: string, comment = ''): Promise<void> {
  assertSafeName(envId, 'environment id');
  if (isReservedEnvName(envId)) throw new Error(`"${envId}" is a reserved internal name`);
  environmentOps.addEnvironment(getData(), envId, comment);
  await persist();
}

export async function renameEnvironment(oldId: string, newId: string): Promise<void> {
  assertSafeName(newId, 'environment id');
  if (isReservedEnvName(newId)) throw new Error(`"${newId}" is a reserved internal name`);
  environmentOps.renameEnvironment(getData(), oldId, newId);
  await persist();
}

export async function deleteEnvironment(envId: string): Promise<void> {
  environmentOps.deleteEnvironment(getData(), envId);
  await persist();
}

export async function setEnvironmentComment(envId: string, comment: string): Promise<void> {
  environmentOps.setEnvironmentComment(getData(), envId, comment);
  await persist();
}

export function getEnvironmentComment(envId: string): string {
  return environmentOps.getEnvironmentComment(getData(), envId);
}

// --- Secrets ---

export function getAllSecrets(): Record<string, Record<string, SecretEntry>> {
  return secretOps.getAllSecrets(getData());
}

export function getSecret(serviceId: string, field: string): SecretEntry | null {
  return secretOps.getSecret(getData(), serviceId, field);
}

export function get(ref: string, envId: string): string | null {
  const dotIndex = ref.indexOf('.');
  if (dotIndex === -1) throw new Error(`Invalid reference "${ref}" (expected service.field)`);
  const entry = getSecret(ref.slice(0, dotIndex), ref.slice(dotIndex + 1));
  return secretOps.resolveValue(entry, envId) ?? null;
}

export async function setSecret(serviceId: string, field: string, opts?: { secret?: boolean; values?: Record<string, string> }): Promise<void> {
  assertSafeName(serviceId, 'service id');
  assertSafeName(field, 'field name');
  if (opts?.values) {
    for (const envId of Object.keys(opts.values)) {
      assertSafeName(envId, 'environment id');
    }
  }
  secretOps.setSecret(getData(), serviceId, field, opts);
  await persist();
}

export async function setSecretValue(serviceId: string, field: string, envId: string, value: string): Promise<void> {
  assertSafeName(envId, 'environment id');
  secretOps.setSecretValue(getData(), serviceId, field, envId, value);
  await persist();
}

export async function setSecretFlag(serviceId: string, field: string, secret: boolean): Promise<void> {
  secretOps.setSecretFlag(getData(), serviceId, field, secret);
  await persist();
}

export async function deleteSecret(serviceId: string, field: string): Promise<void> {
  secretOps.deleteSecret(getData(), serviceId, field);
  await persist();
}

export async function deleteSecretValue(serviceId: string, field: string, envId: string): Promise<void> {
  secretOps.deleteSecretValue(getData(), serviceId, field, envId);
  await persist();
}

export async function moveSecret(oldServiceId: string, oldField: string, newServiceId: string, newField: string): Promise<void> {
  assertSafeName(newServiceId, 'service id');
  assertSafeName(newField, 'field name');
  secretOps.moveSecret(getData(), oldServiceId, oldField, newServiceId, newField);
  await persist();
}

// --- Templates ---

export async function setTemplateEntry(key: string, value: string): Promise<void> {
  templateOps.setTemplateEntry(getData(), key, value);
  await persist();
}

export async function deleteTemplateEntry(key: string): Promise<void> {
  templateOps.deleteTemplateEntry(getData(), key);
  await persist();
}

export async function clearTemplate(): Promise<void> {
  templateOps.clearTemplate(getData());
  await persist();
}

export async function replaceTemplate(newTpl: Record<string, string>): Promise<void> {
  templateOps.replaceTemplate(getData(), newTpl);
  await persist();
}

export async function mergeTemplate(incoming: Record<string, string>): Promise<void> {
  templateOps.mergeTemplate(getData(), incoming);
  await persist();
}

export function getTemplate(): Record<string, string> {
  return templateOps.getTemplate(getData());
}

// --- Settings ---

export function getSettings(): VaultSettings {
  return settingsOps.getSettings(getData());
}

export async function setAutolockMinutes(minutes: number): Promise<void> {
  settingsOps.setAutolockMinutes(getData(), minutes);
  await persist();
}

export async function setReadOnly(readOnly: boolean): Promise<void> {
  const data = getData();
  if (!cryptoKey || !vaultPath) throw new Error('Vault not open');
  if (remoteMode) throw new Error('Cannot write to a remote vault');

  // Temporarily clear readOnly so persist() doesn't reject
  const prev = data.settings.readOnly;
  data.settings.readOnly = false;
  try {
    // Set target value and persist in one go — persist serializes vaultData at encrypt time
    settingsOps.setReadOnly(data, readOnly);
    await _persist(true);
  } catch (e) {
    data.settings.readOnly = prev;
    throw e;
  }
}
