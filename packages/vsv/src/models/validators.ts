// validators.ts — pure validation and sanitization functions

export function sanitizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

export function labelToId(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function validateServiceId(id: string, existingServices: Record<string, unknown>): string | null {
  if (!id) return 'Service key is required';
  if (existingServices[id]) return `Service "${id}" already exists`;
  return null;
}

export function validateEnvironmentId(id: string, existingEnvironments: string[]): string | null {
  if (!id) return 'Identifier is required';
  if (existingEnvironments.includes(id)) return `Environment "${id}" already exists`;
  return null;
}

export function validateServiceRename(oldId: string, newId: string, existingServices: Record<string, unknown>): string | null {
  if (!newId) return 'Service key is required';
  if (newId !== oldId && existingServices[newId]) return `Service "${newId}" already exists`;
  return null;
}

export function validateEnvironmentRename(oldId: string, newId: string, existingEnvironments: string[]): string | null {
  if (!newId) return 'Identifier is required';
  if (newId !== oldId && existingEnvironments.includes(newId)) return `Environment "${newId}" already exists`;
  return null;
}

export function validateSecretField(serviceId: string, fieldName: string): string | null {
  if (!serviceId) return 'Service is required';
  if (!fieldName) return 'Field name is required';
  return null;
}
