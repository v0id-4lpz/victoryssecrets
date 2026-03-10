// service-ops.ts — pure CRUD operations on services within vault data

import type { VaultData } from '../types/vault';
import { refactorServiceId, removeServiceRefs } from '../models/template-refactor';

export function hasService(data: VaultData, id: string): boolean {
  return !!data.services[id];
}

export function addService(data: VaultData, id: string, label: string, comment = ''): VaultData {
  if (data.services[id]) throw new Error(`Service "${id}" already exists`);
  data.services[id] = { label, comment };
  return data;
}

export function deleteService(data: VaultData, id: string): VaultData {
  delete data.services[id];
  delete data.secrets[id];
  data.templates = removeServiceRefs(data.templates, id);
  return data;
}

export function renameServiceLabel(data: VaultData, id: string, newLabel: string): VaultData {
  if (data.services[id]) {
    data.services[id]!.label = newLabel;
  }
  return data;
}

export function renameServiceId(data: VaultData, oldId: string, newId: string): VaultData {
  if (!data.services[oldId] || oldId === newId) return data;
  if (data.services[newId]) throw new Error(`Service "${newId}" already exists`);
  data.services[newId] = data.services[oldId]!;
  delete data.services[oldId];
  if (data.secrets[oldId]) {
    data.secrets[newId] = data.secrets[oldId]!;
    delete data.secrets[oldId];
  }
  data.templates = refactorServiceId(data.templates, oldId, newId);
  return data;
}

export function setServiceComment(data: VaultData, id: string, comment: string): VaultData {
  if (data.services[id]) {
    data.services[id]!.comment = comment;
  }
  return data;
}
