// vault.ts — stateful orchestrator (state + crypto/storage + delegates to pure services)

import type { VaultData, VaultSettings, SecretEntry } from './types/vault';
import { encrypt, decrypt, deriveKey, generateSalt } from './crypto';
import { saveFile, hasFile } from './storage';
import { createEmpty, ensureStructure } from './models/vault-schema';
import * as serviceOps from './services/service-ops';
import * as environmentOps from './services/environment-ops';
import * as secretOps from './services/secret-ops';
import * as templateOps from './services/template-ops';
import * as settingsOps from './services/settings-ops';

let vaultData: VaultData | null = null;
let cryptoKey: CryptoKey | null = null;
let keySalt: Uint8Array | null = null;
let persistLock: Promise<void> | null = null;

// --- State ---

export function getData(): VaultData {
  return vaultData!;
}

export function isUnlocked(): boolean {
  return vaultData !== null;
}

export async function create(password: string): Promise<VaultData> {
  const salt = generateSalt();
  cryptoKey = await deriveKey(password, salt);
  keySalt = salt;
  vaultData = createEmpty();
  await persist();
  return vaultData;
}

export async function open(buffer: ArrayBuffer, password: string): Promise<VaultData> {
  const result = await decrypt(buffer, password);
  vaultData = ensureStructure(result.data);
  cryptoKey = result.key;
  keySalt = result.salt;
  return vaultData;
}

export async function persist(): Promise<void> {
  while (persistLock) await persistLock;
  if (!vaultData || !cryptoKey) throw new Error('Vault not open');
  if (!hasFile()) throw new Error('No file handle');
  let resolve!: () => void;
  persistLock = new Promise(r => { resolve = r; });
  try {
    const encrypted = await encrypt(vaultData, cryptoKey, keySalt!);
    await saveFile(encrypted);
  } finally {
    persistLock = null;
    resolve();
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const testKey = await deriveKey(currentPassword, keySalt!);
  try {
    const testData = new TextEncoder().encode('test');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, testKey, testData);
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey!, enc);
  } catch {
    throw new Error('Wrong password');
  }
  const newSalt = generateSalt();
  cryptoKey = await deriveKey(newPassword, newSalt);
  keySalt = newSalt;
  await persist();
}

export function lock(): void {
  vaultData = null;
  cryptoKey = null;
  keySalt = null;
}

// --- Services ---

export function hasService(id: string): boolean {
  return serviceOps.hasService(vaultData!, id);
}

export async function addService(id: string, label: string, comment = ''): Promise<void> {
  serviceOps.addService(vaultData!, id, label, comment);
  await persist();
}

export async function deleteService(id: string): Promise<void> {
  serviceOps.deleteService(vaultData!, id);
  await persist();
}

export async function renameService(id: string, newLabel: string): Promise<void> {
  serviceOps.renameServiceLabel(vaultData!, id, newLabel);
  await persist();
}

export async function renameServiceId(oldId: string, newId: string): Promise<void> {
  serviceOps.renameServiceId(vaultData!, oldId, newId);
  await persist();
}

export async function setServiceComment(id: string, comment: string): Promise<void> {
  serviceOps.setServiceComment(vaultData!, id, comment);
  await persist();
}

// --- Environments ---

export function hasEnvironment(envId: string): boolean {
  return environmentOps.hasEnvironment(vaultData!, envId);
}

export async function addEnvironment(envId: string, comment = ''): Promise<void> {
  environmentOps.addEnvironment(vaultData!, envId, comment);
  await persist();
}

export async function renameEnvironment(oldId: string, newId: string): Promise<void> {
  environmentOps.renameEnvironment(vaultData!, oldId, newId);
  await persist();
}

export async function deleteEnvironment(envId: string): Promise<void> {
  environmentOps.deleteEnvironment(vaultData!, envId);
  await persist();
}

export async function setEnvironmentComment(envId: string, comment: string): Promise<void> {
  environmentOps.setEnvironmentComment(vaultData!, envId, comment);
  await persist();
}

export function getEnvironmentComment(envId: string): string {
  return environmentOps.getEnvironmentComment(vaultData!, envId);
}

// --- Secrets ---

export function getAllSecrets(): Record<string, Record<string, SecretEntry>> {
  return secretOps.getAllSecrets(vaultData!);
}

export function getSecret(serviceId: string, field: string): SecretEntry | null {
  return secretOps.getSecret(vaultData!, serviceId, field);
}

export async function setSecret(serviceId: string, field: string, opts?: { secret?: boolean; values?: Record<string, string> }): Promise<void> {
  secretOps.setSecret(vaultData!, serviceId, field, opts);
  await persist();
}

export async function setSecretValue(serviceId: string, field: string, envId: string, value: string): Promise<void> {
  secretOps.setSecretValue(vaultData!, serviceId, field, envId, value);
  await persist();
}

export async function setSecretFlag(serviceId: string, field: string, secret: boolean): Promise<void> {
  secretOps.setSecretFlag(vaultData!, serviceId, field, secret);
  await persist();
}

export async function deleteSecret(serviceId: string, field: string): Promise<void> {
  secretOps.deleteSecret(vaultData!, serviceId, field);
  await persist();
}

export async function deleteSecretValue(serviceId: string, field: string, envId: string): Promise<void> {
  secretOps.deleteSecretValue(vaultData!, serviceId, field, envId);
  await persist();
}

export async function moveSecret(oldServiceId: string, oldField: string, newServiceId: string, newField: string): Promise<void> {
  secretOps.moveSecret(vaultData!, oldServiceId, oldField, newServiceId, newField);
  await persist();
}

// --- Templates ---

export async function setTemplateEntry(key: string, value: string): Promise<void> {
  templateOps.setTemplateEntry(vaultData!, key, value);
  await persist();
}

export async function deleteTemplateEntry(key: string): Promise<void> {
  templateOps.deleteTemplateEntry(vaultData!, key);
  await persist();
}

export async function clearTemplate(): Promise<void> {
  templateOps.clearTemplate(vaultData!);
  await persist();
}

export async function replaceTemplate(newTpl: Record<string, string>): Promise<void> {
  templateOps.replaceTemplate(vaultData!, newTpl);
  await persist();
}

export async function mergeTemplate(incoming: Record<string, string>): Promise<void> {
  templateOps.mergeTemplate(vaultData!, incoming);
  await persist();
}

export function getTemplate(): Record<string, string> {
  return templateOps.getTemplate(vaultData!);
}

// --- Settings ---

export function getSettings(): VaultSettings {
  return settingsOps.getSettings(vaultData!);
}

export async function setAutolockMinutes(minutes: number): Promise<void> {
  settingsOps.setAutolockMinutes(vaultData!, minutes);
  await persist();
}
