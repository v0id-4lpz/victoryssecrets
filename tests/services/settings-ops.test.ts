import { describe, it, expect } from 'vitest';
import { getSettings, setAutolockMinutes } from '../../src/services/settings-ops';
import { createEmpty, DEFAULT_SETTINGS } from '../../src/models/vault-schema';

describe('settings-ops', () => {
  it('getSettings returns defaults for fresh vault', () => {
    const data = createEmpty();
    const settings = getSettings(data);
    expect(settings.autolockMinutes).toBe(DEFAULT_SETTINGS.autolockMinutes);
  });

  it('getSettings returns stored value', () => {
    const data = createEmpty();
    data.settings.autolockMinutes = 30;
    expect(getSettings(data).autolockMinutes).toBe(30);
  });

  it('setAutolockMinutes updates value', () => {
    const data = createEmpty();
    setAutolockMinutes(data, 30);
    expect(data.settings.autolockMinutes).toBe(30);
  });

  it('setAutolockMinutes rejects < 1', () => {
    const data = createEmpty();
    expect(() => setAutolockMinutes(data, 0)).toThrow();
  });

  it('setAutolockMinutes rejects > 60', () => {
    const data = createEmpty();
    expect(() => setAutolockMinutes(data, 120)).toThrow();
  });

  it('setAutolockMinutes rejects non-number', () => {
    const data = createEmpty();
    expect(() => setAutolockMinutes(data, 'abc' as any)).toThrow();
  });
});
