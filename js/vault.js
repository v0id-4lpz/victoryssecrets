// vault.js — vault data model and CRUD operations

import { encrypt, decrypt } from './crypto.js';
import { saveFile, hasFile } from './storage.js';

function createEmpty() {
  return {
    version: 1,
    services: {},
    projects: {},
    secrets: {
      global: {},
      projects: {},
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
  for (const projId of Object.keys(vaultData.secrets.projects || {})) {
    const proj = vaultData.secrets.projects[projId];
    cleanLevel(proj._project);
    for (const envId of Object.keys(proj)) {
      if (envId !== '_project') cleanLevel(proj[envId]);
    }
  }
  // Clean up template references
  for (const projId of Object.keys(vaultData.templates || {})) {
    for (const envId of Object.keys(vaultData.templates[projId] || {})) {
      const tpl = vaultData.templates[projId][envId];
      for (const [key, val] of Object.entries(tpl)) {
        const m = val.match(/^\$\{(.+?)\.(.+)\}$/);
        if (m && m[1] === id) delete tpl[key];
      }
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

// --- Projects ---

export async function addProject(id, label) {
  vaultData.projects[id] = { label, environments: [] };
  vaultData.secrets.projects[id] = { _project: {} };
  vaultData.templates[id] = {};
  await persist();
}

export async function deleteProject(id) {
  delete vaultData.projects[id];
  delete vaultData.secrets.projects[id];
  delete vaultData.templates[id];
  await persist();
}

export async function renameProject(id, newLabel) {
  if (vaultData.projects[id]) {
    vaultData.projects[id].label = newLabel;
    await persist();
  }
}

// --- Environments ---

export async function addEnvironment(projectId, envId) {
  if (!vaultData.projects[projectId]) return;
  if (!vaultData.projects[projectId].environments.includes(envId)) {
    vaultData.projects[projectId].environments.push(envId);
  }
  if (!vaultData.secrets.projects[projectId]) {
    vaultData.secrets.projects[projectId] = { _project: {} };
  }
  vaultData.secrets.projects[projectId][envId] = {};
  if (!vaultData.templates[projectId]) vaultData.templates[projectId] = {};
  vaultData.templates[projectId][envId] = {};
  await persist();
}

export async function deleteEnvironment(projectId, envId) {
  if (!vaultData.projects[projectId]) return;
  const envs = vaultData.projects[projectId].environments;
  const idx = envs.indexOf(envId);
  if (idx !== -1) envs.splice(idx, 1);
  delete vaultData.secrets.projects?.[projectId]?.[envId];
  delete vaultData.templates?.[projectId]?.[envId];
  await persist();
}

// --- Secrets ---

export async function setSecret(level, serviceId, fieldName, value, isSecret = true) {
  // level: { scope: 'global' } | { scope: 'project', projectId } | { scope: 'env', projectId, envId }
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
  } else if (level.scope === 'project') {
    if (!vaultData.secrets.projects[level.projectId]) {
      vaultData.secrets.projects[level.projectId] = { _project: {} };
    }
    return vaultData.secrets.projects[level.projectId]._project;
  } else if (level.scope === 'env') {
    if (!vaultData.secrets.projects[level.projectId]) {
      vaultData.secrets.projects[level.projectId] = { _project: {} };
    }
    if (!vaultData.secrets.projects[level.projectId][level.envId]) {
      vaultData.secrets.projects[level.projectId][level.envId] = {};
    }
    return vaultData.secrets.projects[level.projectId][level.envId];
  }
  return {};
}

// --- Templates ---

export async function setTemplateEntry(projectId, envId, key, value) {
  if (!vaultData.templates[projectId]) vaultData.templates[projectId] = {};
  if (!vaultData.templates[projectId][envId]) vaultData.templates[projectId][envId] = {};
  vaultData.templates[projectId][envId][key] = value;
  await persist();
}

export async function deleteTemplateEntry(projectId, envId, key) {
  delete vaultData.templates?.[projectId]?.[envId]?.[key];
  await persist();
}

export function getTemplate(projectId, envId) {
  return vaultData.templates?.[projectId]?.[envId] || {};
}
