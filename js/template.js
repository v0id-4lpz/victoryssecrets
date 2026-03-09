// template.js — .env generation from templates + resolved secrets

export function resolveSecrets(vault, projectId, envId) {
  const resolved = {}; // { serviceId: { field: value } }

  // 1. Global level
  const globalSecrets = vault.secrets?.global || {};
  for (const [serviceId, fields] of Object.entries(globalSecrets)) {
    resolved[serviceId] = resolved[serviceId] || {};
    for (const [field, entry] of Object.entries(fields)) {
      resolved[serviceId][field] = entry.value;
    }
  }

  // 2. Project level
  const projectSecrets = vault.secrets?.projects?.[projectId]?._project || {};
  for (const [serviceId, fields] of Object.entries(projectSecrets)) {
    resolved[serviceId] = resolved[serviceId] || {};
    for (const [field, entry] of Object.entries(fields)) {
      resolved[serviceId][field] = entry.value;
    }
  }

  // 3. Environment level (wins)
  const envSecrets = vault.secrets?.projects?.[projectId]?.[envId] || {};
  for (const [serviceId, fields] of Object.entries(envSecrets)) {
    resolved[serviceId] = resolved[serviceId] || {};
    for (const [field, entry] of Object.entries(fields)) {
      resolved[serviceId][field] = entry.value;
    }
  }

  return resolved;
}

export function generateEnv(vault, projectId, envId) {
  const template = vault.templates?.[projectId]?.[envId];
  if (!template) return { output: '', warnings: [] };

  const resolved = resolveSecrets(vault, projectId, envId);
  const warnings = [];
  const lines = [];

  const magicVars = {
    _ENV_NAME: envId,
    _PROJECT_NAME: projectId,
  };

  for (const [key, rawValue] of Object.entries(template)) {
    const refMatch = rawValue.match(/^\$\{(.+)\}$/);
    if (refMatch) {
      const ref = refMatch[1];
      // Magic variable
      if (magicVars[ref] !== undefined) {
        lines.push(`${key}=${magicVars[ref]}`);
        continue;
      }
      // Service.field reference
      const dotIndex = ref.indexOf('.');
      if (dotIndex === -1) {
        warnings.push(`${key}: invalid reference \${${ref}} (expected \${service.field})`);
        lines.push(`${key}=`);
        continue;
      }
      const serviceId = ref.slice(0, dotIndex);
      const field = ref.slice(dotIndex + 1);
      const value = resolved[serviceId]?.[field];
      if (value === undefined) {
        warnings.push(`${key}: unresolved reference \${${ref}}`);
        lines.push(`${key}=`);
      } else {
        lines.push(`${key}=${value}`);
      }
    } else {
      // Hard-coded value
      lines.push(`${key}=${rawValue}`);
    }
  }

  return { output: lines.join('\n') + '\n', warnings };
}
