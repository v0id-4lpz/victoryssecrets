// settings-ops.ts — pure settings operations

import type { VaultData, VaultSettings } from '../types/vault';
import { DEFAULT_SETTINGS } from '../models/vault-schema';

export function getSettings(data: VaultData): VaultSettings {
  return { ...DEFAULT_SETTINGS, ...data.settings };
}

export function setAutolockMinutes(data: VaultData, minutes: number): void {
  if (typeof minutes !== 'number' || minutes < 1 || minutes > 60) {
    throw new Error('Autolock must be between 1 and 60 minutes');
  }
  data.settings.autolockMinutes = minutes;
}

export function setReadOnly(data: VaultData, readOnly: boolean): void {
  data.settings.readOnly = !!readOnly;
}
