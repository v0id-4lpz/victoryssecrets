import { describe, it, expect } from 'vitest';
import * as vsv from '../src/index';

describe('public API exports', () => {
  it('exports vault module', () => {
    expect(vsv.vault).toBeDefined();
    expect(typeof vsv.vault.create).toBe('function');
    expect(typeof vsv.vault.open).toBe('function');
    expect(typeof vsv.vault.lock).toBe('function');
    expect(typeof vsv.vault.get).toBe('function');
    expect(typeof vsv.vault.getData).toBe('function');
    expect(typeof vsv.vault.isUnlocked).toBe('function');
  });

  it('exports crypto module', () => {
    expect(vsv.crypto).toBeDefined();
    expect(typeof vsv.crypto.encrypt).toBe('function');
    expect(typeof vsv.crypto.decrypt).toBe('function');
    expect(typeof vsv.crypto.deriveKey).toBe('function');
    expect(typeof vsv.crypto.generateSalt).toBe('function');
  });

  it('exports storage functions', () => {
    expect(typeof vsv.readVaultFile).toBe('function');
    expect(typeof vsv.writeVaultFile).toBe('function');
    expect(typeof vsv.fetchVaultFile).toBe('function');
    expect(typeof vsv.validateVaultPath).toBe('function');
    expect(typeof vsv.isRemoteUrl).toBe('function');
  });

  it('exports service ops modules', () => {
    expect(vsv.serviceOps).toBeDefined();
    expect(vsv.environmentOps).toBeDefined();
    expect(vsv.secretOps).toBeDefined();
    expect(vsv.templateOps).toBeDefined();
    expect(vsv.settingsOps).toBeDefined();
    expect(vsv.envGenerator).toBeDefined();
    expect(vsv.search).toBeDefined();
  });

  it('exports model utilities', () => {
    expect(typeof vsv.createEmpty).toBe('function');
    expect(typeof vsv.ensureStructure).toBe('function');
    expect(typeof vsv.sanitizeId).toBe('function');
    expect(typeof vsv.labelToId).toBe('function');
    expect(typeof vsv.CURRENT_VERSION).toBe('number');
    expect(typeof vsv.GLOBAL_ENV).toBe('string');
  });

  it('exports agent client', () => {
    expect(vsv.VsvClient).toBeDefined();
    expect(typeof vsv.createClient).toBe('function');
  });

  it('createEmpty returns valid vault structure', () => {
    const data = vsv.createEmpty();
    expect(data.version).toBe(vsv.CURRENT_VERSION);
    expect(data.services).toEqual({});
    expect(data.environments).toEqual({});
    expect(data.secrets).toEqual({});
    expect(data.templates).toEqual({ main: {} });
  });
});
