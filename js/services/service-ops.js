// service-ops.js — pure CRUD operations on services within vault data

import { refactorServiceId, removeServiceRefs } from '../models/template-refactor.js';

export function hasService(data, id) {
  return !!data.services[id];
}

export function addService(data, id, label, comment = '') {
  if (data.services[id]) throw new Error(`Service "${id}" already exists`);
  data.services[id] = { label, comment };
  return data;
}

export function deleteService(data, id) {
  delete data.services[id];
  delete data.secrets[id];
  data.templates = removeServiceRefs(data.templates, id);
  return data;
}

export function renameServiceLabel(data, id, newLabel) {
  if (data.services[id]) {
    data.services[id].label = newLabel;
  }
  return data;
}

export function renameServiceId(data, oldId, newId) {
  if (!data.services[oldId] || oldId === newId) return data;
  if (data.services[newId]) throw new Error(`Service "${newId}" already exists`);
  data.services[newId] = data.services[oldId];
  delete data.services[oldId];
  if (data.secrets[oldId]) {
    data.secrets[newId] = data.secrets[oldId];
    delete data.secrets[oldId];
  }
  data.templates = refactorServiceId(data.templates, oldId, newId);
  return data;
}

export function setServiceComment(data, id, comment) {
  if (data.services[id]) {
    data.services[id].comment = comment;
  }
  return data;
}
