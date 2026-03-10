// validators.js — pure validation and sanitization functions

export function sanitizeId(raw) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

export function labelToId(label) {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function validateServiceId(id, existingServices) {
  if (!id) return 'Service key is required';
  if (existingServices[id]) return `Service "${id}" already exists`;
  return null;
}

export function validateEnvironmentId(id, existingEnvironments) {
  if (!id) return 'Identifier is required';
  if (existingEnvironments.includes(id)) return `Environment "${id}" already exists`;
  return null;
}

export function validateServiceRename(oldId, newId, existingServices) {
  if (!newId) return 'Service key is required';
  if (newId !== oldId && existingServices[newId]) return `Service "${newId}" already exists`;
  return null;
}

export function validateEnvironmentRename(oldId, newId, existingEnvironments) {
  if (!newId) return 'Identifier is required';
  if (newId !== oldId && existingEnvironments.includes(newId)) return `Environment "${newId}" already exists`;
  return null;
}

export function validateSecretField(serviceId, fieldName) {
  if (!serviceId) return 'Service is required';
  if (!fieldName) return 'Field name is required';
  return null;
}
