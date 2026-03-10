// env-generator.js — .env generation from templates + resolved secrets

import { GLOBAL_ENV } from '../models/vault-schema.js';

export function resolveSecrets(vault, envId) {
  const resolved = {};
  for (const [serviceId, fields] of Object.entries(vault.secrets || {})) {
    resolved[serviceId] = {};
    for (const [field, entry] of Object.entries(fields)) {
      const envVal = entry.values?.[envId];
      const globalVal = entry.values?.[GLOBAL_ENV];
      const value = (envVal !== undefined && envVal !== '') ? envVal : globalVal;
      if (value !== undefined) resolved[serviceId][field] = value;
    }
  }
  return resolved;
}

/**
 * Resolve a single secret reference and return { value, source }.
 * source = envId if env-specific, 'Global' if fallback, null if unresolved.
 */
function resolveWithSource(secrets, serviceId, field, envId) {
  const entry = secrets?.[serviceId]?.[field];
  if (!entry?.values) return { value: undefined, source: null };
  const envVal = entry.values[envId];
  if (envVal !== undefined && envVal !== '') return { value: envVal, source: envId };
  const globalVal = entry.values[GLOBAL_ENV];
  if (globalVal !== undefined) return { value: globalVal, source: 'Global' };
  return { value: undefined, source: null };
}

export function generateEnv(vault, envId) {
  const template = vault.templates?.main;
  if (!template) return { output: '', warnings: [], entries: [] };

  const resolved = resolveSecrets(vault, envId);
  const warnings = [];
  const lines = [];
  const entries = [];

  const magicVars = {
    _ENV_NAME: envId,
  };

  for (const [key, rawValue] of Object.entries(template)) {
    const refMatch = rawValue.match(/^\$\{(.+)\}$/);
    if (refMatch) {
      const ref = refMatch[1];
      if (magicVars[ref] !== undefined) {
        lines.push(`${key}=${magicVars[ref]}`);
        entries.push({ key, value: magicVars[ref], source: 'auto' });
        continue;
      }
      const dotIndex = ref.indexOf('.');
      if (dotIndex === -1) {
        warnings.push(`${key}: invalid reference \${${ref}} (expected \${service.field})`);
        lines.push(`${key}=`);
        entries.push({ key, value: '', source: null });
        continue;
      }
      const serviceId = ref.slice(0, dotIndex);
      const field = ref.slice(dotIndex + 1);
      const { value, source } = resolveWithSource(vault.secrets, serviceId, field, envId);
      if (value === undefined) {
        warnings.push(`${key}: unresolved reference \${${ref}}`);
        lines.push(`${key}=`);
        entries.push({ key, value: '', source: null });
      } else {
        lines.push(`${key}=${value}`);
        entries.push({ key, value, source });
      }
    } else {
      lines.push(`${key}=${rawValue}`);
      entries.push({ key, value: rawValue, source: 'static' });
    }
  }

  return { output: lines.join('\n') + '\n', warnings, entries };
}
