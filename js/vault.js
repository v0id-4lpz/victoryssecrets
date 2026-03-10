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

export async function changePassword(currentPassword, newPassword) {
  if (currentPassword !== masterPassword) throw new Error('Wrong password');
  masterPassword = newPassword;
  await persist();
}

export function lock() {
  vaultData = null;
  masterPassword = null;
}

// --- Services ---

export async function addService(id, label, comment = '') {
  vaultData.services[id] = { label, comment };
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

export async function renameServiceId(oldId, newId) {
  if (!vaultData.services[oldId] || oldId === newId) return;
  if (vaultData.services[newId]) return; // conflict
  // Move service entry
  vaultData.services[newId] = vaultData.services[oldId];
  delete vaultData.services[oldId];
  // Move secrets at all levels
  const moveSecrets = (obj) => {
    if (obj?.[oldId]) { obj[newId] = obj[oldId]; delete obj[oldId]; }
  };
  moveSecrets(vaultData.secrets.global);
  for (const envId of Object.keys(vaultData.secrets.envs || {})) {
    moveSecrets(vaultData.secrets.envs[envId]);
  }
  // Refactor templates: ${oldId.*} → ${newId.*}
  for (const envId of Object.keys(vaultData.templates || {})) {
    const tpl = vaultData.templates[envId];
    for (const [key, val] of Object.entries(tpl)) {
      if (typeof val === 'string') {
        tpl[key] = val.replace(
          new RegExp(`\\$\\{${oldId}\\.`, 'g'),
          `\${${newId}.`
        );
      }
    }
  }
  await persist();
}

export async function setServiceComment(id, comment) {
  if (vaultData.services[id]) {
    vaultData.services[id].comment = comment;
    await persist();
  }
}

// --- Environments ---

export async function addEnvironment(envId, comment = '') {
  if (!vaultData.environments.includes(envId)) {
    vaultData.environments.push(envId);
  }
  if (!vaultData.environmentMeta) vaultData.environmentMeta = {};
  if (!vaultData.environmentMeta[envId]) vaultData.environmentMeta[envId] = {};
  vaultData.environmentMeta[envId].comment = comment;
  if (!vaultData.secrets.envs[envId]) {
    vaultData.secrets.envs[envId] = {};
  }
  if (!vaultData.templates[envId]) {
    vaultData.templates[envId] = {};
  }
  await persist();
}

export async function renameEnvironment(oldId, newId) {
  const idx = vaultData.environments.indexOf(oldId);
  if (idx === -1 || vaultData.environments.includes(newId)) return;
  vaultData.environments[idx] = newId;
  if (vaultData.secrets.envs[oldId]) {
    vaultData.secrets.envs[newId] = vaultData.secrets.envs[oldId];
    delete vaultData.secrets.envs[oldId];
  }
  if (vaultData.templates[oldId]) {
    vaultData.templates[newId] = vaultData.templates[oldId];
    delete vaultData.templates[oldId];
  }
  if (vaultData.environmentMeta?.[oldId]) {
    if (!vaultData.environmentMeta) vaultData.environmentMeta = {};
    vaultData.environmentMeta[newId] = vaultData.environmentMeta[oldId];
    delete vaultData.environmentMeta[oldId];
  }
  await persist();
}

export async function deleteEnvironment(envId) {
  const idx = vaultData.environments.indexOf(envId);
  if (idx !== -1) vaultData.environments.splice(idx, 1);
  delete vaultData.secrets.envs[envId];
  delete vaultData.templates[envId];
  delete vaultData.environmentMeta?.[envId];
  await persist();
}

export async function setEnvironmentComment(envId, comment) {
  if (!vaultData.environmentMeta) vaultData.environmentMeta = {};
  if (!vaultData.environmentMeta[envId]) vaultData.environmentMeta[envId] = {};
  vaultData.environmentMeta[envId].comment = comment;
  await persist();
}

export function getEnvironmentComment(envId) {
  return vaultData.environmentMeta?.[envId]?.comment || '';
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

/**
 * Refactors all template references matching `${serviceId.oldField}` to `${serviceId.newField}`.
 * Also handles service id renames: `${oldServiceId.*}` → `${newServiceId.*}`.
 */
function refactorTemplates(pattern, replacement) {
  for (const envId of Object.keys(vaultData.templates || {})) {
    const tpl = vaultData.templates[envId];
    for (const [key, val] of Object.entries(tpl)) {
      if (typeof val === 'string' && val.includes(pattern)) {
        tpl[key] = val.replace(pattern, replacement);
      }
    }
  }
}

export async function moveSecret(level, oldServiceId, oldField, newServiceId, newField) {
  const target = getSecretsAtLevel(level);
  if (!target[oldServiceId]?.[oldField]) return;
  const entry = target[oldServiceId][oldField];
  delete target[oldServiceId][oldField];
  if (Object.keys(target[oldServiceId]).length === 0) delete target[oldServiceId];
  if (!target[newServiceId]) target[newServiceId] = {};
  target[newServiceId][newField] = entry;
  refactorTemplates(`\${${oldServiceId}.${oldField}}`, `\${${newServiceId}.${newField}}`);
  await persist();
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

export async function clearTemplate(envId) {
  if (vaultData.templates?.[envId]) {
    vaultData.templates[envId] = {};
    await persist();
  }
}

export function getTemplate(envId) {
  return vaultData.templates?.[envId] || {};
}
