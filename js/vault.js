// vault.js — vault data model and CRUD operations (1 vault = 1 project)

import { encrypt, decrypt } from './crypto.js';
import { saveFile, hasFile } from './storage.js';

function createEmpty() {
  return {
    version: 2,
    services: {},
    environments: [],
    secrets: {
      global: {},
      envs: {},
    },
    templates: {},
  };
}

let vaultData = null;
let masterPassword = null;

export function getData() {
  return vaultData;
}

export function isUnlocked() {
  return vaultData !== null;
}

export async function create(password) {
  masterPassword = password;
  vaultData = createEmpty();
  await persist();
  return vaultData;
}

export async function open(buffer, password) {
  vaultData = await decrypt(buffer, password);
  masterPassword = password;
  return vaultData;
}

export async function persist() {
  if (!vaultData || !masterPassword) throw new Error('Vault not open');
  if (!hasFile()) throw new Error('No file handle');
  const encrypted = await encrypt(vaultData, masterPassword);
  await saveFile(encrypted);
}

export function lock() {
  vaultData = null;
  masterPassword = null;
}

// --- Services ---

export async function addService(id, label) {
  vaultData.services[id] = { label };
  await persist();
}

export async function deleteService(id) {
  delete vaultData.services[id];
  // Clean up secrets referencing this service
  const cleanLevel = (obj) => { if (obj?.[id]) delete obj[id]; };
  cleanLevel(vaultData.secrets.global);
  for (const envId of Object.keys(vaultData.secrets.envs || {})) {
    cleanLevel(vaultData.secrets.envs[envId]);
  }
  // Clean up template references
  for (const envId of Object.keys(vaultData.templates || {})) {
    const tpl = vaultData.templates[envId];
    for (const [key, val] of Object.entries(tpl)) {
      const m = val.match(/^\$\{(.+?)\.(.+)\}$/);
      if (m && m[1] === id) delete tpl[key];
    }
  }
  await persist();
}

export async function renameService(id, newLabel) {
  if (vaultData.services[id]) {
    vaultData.services[id].label = newLabel;
    await persist();
  }
}

// --- Environments ---

export async function addEnvironment(envId) {
  if (!vaultData.environments.includes(envId)) {
    vaultData.environments.push(envId);
  }
  if (!vaultData.secrets.envs[envId]) {
    vaultData.secrets.envs[envId] = {};
  }
  if (!vaultData.templates[envId]) {
    vaultData.templates[envId] = {};
  }
  await persist();
}

export async function deleteEnvironment(envId) {
  const idx = vaultData.environments.indexOf(envId);
  if (idx !== -1) vaultData.environments.splice(idx, 1);
  delete vaultData.secrets.envs[envId];
  delete vaultData.templates[envId];
  await persist();
}

// --- Secrets ---

export async function setSecret(level, serviceId, fieldName, value, isSecret = true) {
  // level: { scope: 'global' } | { scope: 'env', envId }
  const target = getSecretsAtLevel(level);
  if (!target[serviceId]) target[serviceId] = {};
  target[serviceId][fieldName] = { value, secret: isSecret };
  await persist();
}

export async function deleteSecret(level, serviceId, fieldName) {
  const target = getSecretsAtLevel(level);
  if (target[serviceId]) {
    delete target[serviceId][fieldName];
    if (Object.keys(target[serviceId]).length === 0) delete target[serviceId];
  }
  await persist();
}

export function getSecretsAtLevel(level) {
  if (level.scope === 'global') {
    return vaultData.secrets.global;
  } else if (level.scope === 'env') {
    if (!vaultData.secrets.envs[level.envId]) {
      vaultData.secrets.envs[level.envId] = {};
    }
    return vaultData.secrets.envs[level.envId];
  }
  return {};
}

// --- Templates ---

export async function setTemplateEntry(envId, key, value) {
  if (!vaultData.templates[envId]) vaultData.templates[envId] = {};
  vaultData.templates[envId][key] = value;
  await persist();
}

export async function deleteTemplateEntry(envId, key) {
  delete vaultData.templates?.[envId]?.[key];
  await persist();
}

export function getTemplate(envId) {
  return vaultData.templates?.[envId] || {};
}
