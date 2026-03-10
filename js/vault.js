// vault.js — stateful orchestrator (state + crypto/storage + delegates to pure services)

import { encrypt, decrypt, deriveKey, generateSalt } from './crypto.js';
import { saveFile, hasFile } from './storage.js';
import { createEmpty, ensureStructure } from './models/vault-schema.js';
import * as serviceOps from './services/service-ops.js';
import * as environmentOps from './services/environment-ops.js';
import * as secretOps from './services/secret-ops.js';
import * as templateOps from './services/template-ops.js';
import * as settingsOps from './services/settings-ops.js';

let vaultData = null;
let cryptoKey = null;  // non-extractable CryptoKey — password never stored
let keySalt = null;
let persistLock = null; // mutex for persist()

// --- State ---

export function getData() {
  return vaultData;
}

export function isUnlocked() {
  return vaultData !== null;
}

export async function create(password) {
  const salt = generateSalt();
  cryptoKey = await deriveKey(password, salt);
  keySalt = salt;
  // password is not stored — only the non-extractable CryptoKey remains
  vaultData = createEmpty();
  await persist();
  return vaultData;
}

export async function open(buffer, password) {
  const result = await decrypt(buffer, password);
  // password is not stored — only the non-extractable CryptoKey remains
  vaultData = ensureStructure(result.data);
  cryptoKey = result.key;
  keySalt = result.salt;
  return vaultData;
}

export async function persist() {
  // Mutex: wait for any in-flight persist to finish before starting
  while (persistLock) await persistLock;
  if (!vaultData || !cryptoKey) throw new Error('Vault not open');
  if (!hasFile()) throw new Error('No file handle');
  let resolve;
  persistLock = new Promise(r => { resolve = r; });
  try {
    const encrypted = await encrypt(vaultData, cryptoKey, keySalt);
    await saveFile(encrypted);
  } finally {
    persistLock = null;
    resolve();
  }
}

export async function changePassword(currentPassword, newPassword) {
  // Verify current password by re-deriving and comparing
  const testKey = await deriveKey(currentPassword, keySalt);
  // Test decryption with current key to validate password
  // (deriveKey succeeds for any password — we need to verify it matches)
  // Simplest: try to encrypt+decrypt a test payload with the test key
  try {
    const testData = new TextEncoder().encode('test');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, testKey, testData);
    // Now try decrypting with our stored key — if passwords differ, this will fail
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, enc);
  } catch {
    throw new Error('Wrong password');
  }
  // Derive new key with fresh salt
  const newSalt = generateSalt();
  cryptoKey = await deriveKey(newPassword, newSalt);
  keySalt = newSalt;
  await persist();
}

export function lock() {
  vaultData = null;
  cryptoKey = null;
  keySalt = null;
}

// --- Services ---

export function hasService(id) {
  return serviceOps.hasService(vaultData, id);
}

export async function addService(id, label, comment = '') {
  serviceOps.addService(vaultData, id, label, comment);
  await persist();
}

export async function deleteService(id) {
  serviceOps.deleteService(vaultData, id);
  await persist();
}

export async function renameService(id, newLabel) {
  serviceOps.renameServiceLabel(vaultData, id, newLabel);
  await persist();
}

export async function renameServiceId(oldId, newId) {
  serviceOps.renameServiceId(vaultData, oldId, newId);
  await persist();
}

export async function setServiceComment(id, comment) {
  serviceOps.setServiceComment(vaultData, id, comment);
  await persist();
}

// --- Environments ---

export function hasEnvironment(envId) {
  return environmentOps.hasEnvironment(vaultData, envId);
}

export async function addEnvironment(envId, comment = '') {
  environmentOps.addEnvironment(vaultData, envId, comment);
  await persist();
}

export async function renameEnvironment(oldId, newId) {
  environmentOps.renameEnvironment(vaultData, oldId, newId);
  await persist();
}

export async function deleteEnvironment(envId) {
  environmentOps.deleteEnvironment(vaultData, envId);
  await persist();
}

export async function setEnvironmentComment(envId, comment) {
  environmentOps.setEnvironmentComment(vaultData, envId, comment);
  await persist();
}

export function getEnvironmentComment(envId) {
  return environmentOps.getEnvironmentComment(vaultData, envId);
}

// --- Secrets ---

export function getAllSecrets() {
  return secretOps.getAllSecrets(vaultData);
}

export function getSecret(serviceId, field) {
  return secretOps.getSecret(vaultData, serviceId, field);
}

export async function setSecret(serviceId, field, opts) {
  secretOps.setSecret(vaultData, serviceId, field, opts);
  await persist();
}

export async function setSecretValue(serviceId, field, envId, value) {
  secretOps.setSecretValue(vaultData, serviceId, field, envId, value);
  await persist();
}

export async function setSecretFlag(serviceId, field, secret) {
  secretOps.setSecretFlag(vaultData, serviceId, field, secret);
  await persist();
}

export async function deleteSecret(serviceId, field) {
  secretOps.deleteSecret(vaultData, serviceId, field);
  await persist();
}

export async function deleteSecretValue(serviceId, field, envId) {
  secretOps.deleteSecretValue(vaultData, serviceId, field, envId);
  await persist();
}

export async function moveSecret(oldServiceId, oldField, newServiceId, newField) {
  secretOps.moveSecret(vaultData, oldServiceId, oldField, newServiceId, newField);
  await persist();
}

// --- Templates ---

export async function setTemplateEntry(key, value) {
  templateOps.setTemplateEntry(vaultData, key, value);
  await persist();
}

export async function deleteTemplateEntry(key) {
  templateOps.deleteTemplateEntry(vaultData, key);
  await persist();
}

export async function clearTemplate() {
  templateOps.clearTemplate(vaultData);
  await persist();
}

export async function replaceTemplate(newTpl) {
  templateOps.replaceTemplate(vaultData, newTpl);
  await persist();
}

export async function mergeTemplate(incoming) {
  templateOps.mergeTemplate(vaultData, incoming);
  await persist();
}

export function getTemplate() {
  return templateOps.getTemplate(vaultData);
}

// --- Settings ---

export function getSettings() {
  return settingsOps.getSettings(vaultData);
}

export async function setAutolockMinutes(minutes) {
  settingsOps.setAutolockMinutes(vaultData, minutes);
  await persist();
}
