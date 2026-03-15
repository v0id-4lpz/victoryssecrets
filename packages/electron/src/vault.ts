// vault.ts — thin IPC proxy (state lives in main process via vsv core)

import type { VaultData, VaultSettings, SecretEntry } from 'vsv/types/vault';
import { ensureStructure } from 'vsv/models/vault-schema';
import * as serviceOps from 'vsv/services/service-ops';
import * as environmentOps from 'vsv/services/environment-ops';
import * as secretOps from 'vsv/services/secret-ops';
import * as templateOps from 'vsv/services/template-ops';
import * as settingsOps from 'vsv/services/settings-ops';

let cachedData: VaultData | null = null;
let cachedPath: string | null = null;

// --- State (local cache, updated after each IPC call) ---

export function getData(): VaultData {
  if (!cachedData) throw new Error('Vault is not open');
  return cachedData;
}

export function isUnlocked(): boolean {
  return cachedData !== null;
}

export function getPath(): string | null {
  return cachedPath;
}

// --- Lifecycle (IPC) ---

export async function create(filePath: string, password: string): Promise<VaultData> {
  const result = await window.electronAPI!.vaultCreate(filePath, password);
  cachedData = ensureStructure(result.data);
  cachedPath = result.path;
  return cachedData;
}

export async function open(filePath: string, password: string): Promise<VaultData> {
  const result = await window.electronAPI!.vaultOpen(filePath, password);
  cachedData = ensureStructure(result.data);
  cachedPath = result.path;
  return cachedData;
}

export function lock(): void {
  cachedData = null;
  cachedPath = null;
  window.electronAPI!.vaultLock();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await window.electronAPI!.vaultChangePassword(currentPassword, newPassword);
}

// --- Generic mutation helper ---

let onMutationError: ((message: string) => void) | null = null;

export function setOnMutationError(cb: (message: string) => void): void {
  onMutationError = cb;
}

export function guardReadOnly(): boolean {
  if (isReadOnly()) { onMutationError?.('Read-only vault'); return true; }
  return false;
}

async function call(method: string, ...args: unknown[]): Promise<void> {
  try {
    const data = await window.electronAPI!.vaultCall(method, args);
    cachedData = ensureStructure(data);
  } catch (e: any) {
    onMutationError?.(e.message);
    throw e;
  }
}

// --- Services ---

export function hasService(id: string): boolean {
  return serviceOps.hasService(getData(), id);
}

export async function addService(id: string, label: string, comment = ''): Promise<void> {
  await call('addService', id, label, comment);
}

export async function deleteService(id: string): Promise<void> {
  await call('deleteService', id);
}

export async function renameService(id: string, newLabel: string): Promise<void> {
  await call('renameService', id, newLabel);
}

export async function renameServiceId(oldId: string, newId: string): Promise<void> {
  await call('renameServiceId', oldId, newId);
}

export async function setServiceComment(id: string, comment: string): Promise<void> {
  await call('setServiceComment', id, comment);
}

// --- Environments ---

export function hasEnvironment(envId: string): boolean {
  return environmentOps.hasEnvironment(getData(), envId);
}

export async function addEnvironment(envId: string, comment = ''): Promise<void> {
  await call('addEnvironment', envId, comment);
}

export async function renameEnvironment(oldId: string, newId: string): Promise<void> {
  await call('renameEnvironment', oldId, newId);
}

export async function deleteEnvironment(envId: string): Promise<void> {
  await call('deleteEnvironment', envId);
}

export async function setEnvironmentComment(envId: string, comment: string): Promise<void> {
  await call('setEnvironmentComment', envId, comment);
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

export async function setSecret(serviceId: string, field: string, opts?: { secret?: boolean; values?: Record<string, string> }): Promise<void> {
  await call('setSecret', serviceId, field, opts);
}

export async function setSecretValue(serviceId: string, field: string, envId: string, value: string): Promise<void> {
  await call('setSecretValue', serviceId, field, envId, value);
}

export async function setSecretFlag(serviceId: string, field: string, secret: boolean): Promise<void> {
  await call('setSecretFlag', serviceId, field, secret);
}

export async function deleteSecret(serviceId: string, field: string): Promise<void> {
  await call('deleteSecret', serviceId, field);
}

export async function deleteSecretValue(serviceId: string, field: string, envId: string): Promise<void> {
  await call('deleteSecretValue', serviceId, field, envId);
}

export async function moveSecret(oldServiceId: string, oldField: string, newServiceId: string, newField: string): Promise<void> {
  await call('moveSecret', oldServiceId, oldField, newServiceId, newField);
}

// --- Templates ---

export async function setTemplateEntry(key: string, value: string): Promise<void> {
  await call('setTemplateEntry', key, value);
}

export async function deleteTemplateEntry(key: string): Promise<void> {
  await call('deleteTemplateEntry', key);
}

export async function clearTemplate(): Promise<void> {
  await call('clearTemplate');
}

export async function replaceTemplate(newTpl: Record<string, string>): Promise<void> {
  await call('replaceTemplate', newTpl);
}

export async function mergeTemplate(incoming: Record<string, string>): Promise<void> {
  await call('mergeTemplate', incoming);
}

export function getTemplate(): Record<string, string> {
  return templateOps.getTemplate(getData());
}

// --- Settings ---

export function getSettings(): VaultSettings {
  return settingsOps.getSettings(getData());
}

export function isReadOnly(): boolean {
  return cachedData?.settings.readOnly === true;
}

export async function setAutolockMinutes(minutes: number): Promise<void> {
  await call('setAutolockMinutes', minutes);
}

export async function setReadOnly(readOnly: boolean): Promise<void> {
  await call('setReadOnly', readOnly);
}
