import { describe, it, expect } from 'vitest';
import { getSettings, setAutolockMinutes, setReadOnly } from '../../src/services/settings-ops';
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

  it('default readOnly is false', () => {
    const data = createEmpty();
    expect(getSettings(data).readOnly).toBe(false);
  });

  it('setReadOnly enables read-only', () => {
    const data = createEmpty();
    setReadOnly(data, true);
    expect(data.settings.readOnly).toBe(true);
  });

  it('setReadOnly disables read-only', () => {
    const data = createEmpty();
    setReadOnly(data, true);
    setReadOnly(data, false);
    expect(data.settings.readOnly).toBe(false);
  });
});
