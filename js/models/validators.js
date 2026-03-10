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
  if (!id) return 'La cle du service est requise';
  if (existingServices[id]) return `Le service "${id}" existe deja`;
  return null;
}

export function validateEnvironmentId(id, existingEnvironments) {
  if (!id) return "L'identifiant est requis";
  if (existingEnvironments.includes(id)) return `L'environnement "${id}" existe deja`;
  return null;
}

export function validateServiceRename(oldId, newId, existingServices) {
  if (!newId) return 'La cle du service est requise';
  if (newId !== oldId && existingServices[newId]) return `Le service "${newId}" existe deja`;
  return null;
}

export function validateEnvironmentRename(oldId, newId, existingEnvironments) {
  if (!newId) return "L'identifiant est requis";
  if (newId !== oldId && existingEnvironments.includes(newId)) return `L'environnement "${newId}" existe deja`;
  return null;
}

export function validateSecretField(serviceId, fieldName) {
  if (!serviceId) return 'Le service est requis';
  if (!fieldName) return 'Le nom du champ est requis';
  return null;
}
