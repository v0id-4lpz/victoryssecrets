// settings-ops.js — pure settings operations

import { DEFAULT_SETTINGS } from '../models/vault-schema.js';

export function getSettings(data) {
  return { ...DEFAULT_SETTINGS, ...data.settings };
}

export function setAutolockMinutes(data, minutes) {
  if (typeof minutes !== 'number' || minutes < 1 || minutes > 60) {
    throw new Error('Autolock must be between 1 and 60 minutes');
  }
  data.settings.autolockMinutes = minutes;
}
