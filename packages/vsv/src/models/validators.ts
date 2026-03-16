// validators.ts — pure validation and sanitization functions

import { GLOBAL_ENV } from './vault-schema';

/** Names that would access Object.prototype properties via bracket notation */
const UNSAFE_NAMES = new Set([
  '__proto__', 'constructor', '__definegetter__', '__definesetter__',
  '__lookupgetter__', '__lookupsetter__', 'hasownproperty', 'isprototypeof',
  'propertyisenumerable', 'tolocalestring', 'tostring', 'valueof',
]);

/** Reserved internal names that must not be used as environment IDs */
const RESERVED_ENV_NAMES = new Set([GLOBAL_ENV]);

export function isUnsafeName(name: string): boolean {
  return UNSAFE_NAMES.has(name.toLowerCase());
}

export function isReservedEnvName(name: string): boolean {
  return RESERVED_ENV_NAMES.has(name);
}

export function sanitizeId(raw: string): string {
  const id = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!id) throw new Error('Invalid identifier: no valid characters');
  if (isUnsafeName(id)) throw new Error(`Unsafe identifier: "${id}" is a reserved name`);
  return id;
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
  if (isUnsafeName(id)) return `"${id}" is a reserved name`;
  if (Object.hasOwn(existingServices, id)) return `Service "${id}" already exists`;
  return null;
}

export function validateEnvironmentId(id: string, existingEnvironments: string[]): string | null {
  if (!id) return 'Identifier is required';
  if (isUnsafeName(id)) return `"${id}" is a reserved name`;
  if (isReservedEnvName(id)) return `"${id}" is a reserved internal name`;
  if (existingEnvironments.includes(id)) return `Environment "${id}" already exists`;
  return null;
}

export function validateServiceRename(oldId: string, newId: string, existingServices: Record<string, unknown>): string | null {
  if (!newId) return 'Service key is required';
  if (isUnsafeName(newId)) return `"${newId}" is a reserved name`;
  if (newId !== oldId && Object.hasOwn(existingServices, newId)) return `Service "${newId}" already exists`;
  return null;
}

export function validateEnvironmentRename(oldId: string, newId: string, existingEnvironments: string[]): string | null {
  if (!newId) return 'Identifier is required';
  if (isUnsafeName(newId)) return `"${newId}" is a reserved name`;
  if (isReservedEnvName(newId)) return `"${newId}" is a reserved internal name`;
  if (newId !== oldId && existingEnvironments.includes(newId)) return `Environment "${newId}" already exists`;
  return null;
}

export function validateSecretField(serviceId: string, fieldName: string): string | null {
  if (!serviceId) return 'Service is required';
  if (!fieldName) return 'Field name is required';
  return null;
}
