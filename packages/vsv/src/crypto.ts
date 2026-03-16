// crypto.ts — Argon2id key derivation + AES-256-GCM encrypt/decrypt (Node.js pure)

import { webcrypto } from 'node:crypto';
import { argon2id } from 'hash-wasm';
import type { VaultData } from './types/vault';

type CKey = webcrypto.CryptoKey;

interface DecryptResult {
  data: VaultData;
  key: CKey;
  salt: Uint8Array;
}

const subtle = webcrypto.subtle;
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12;

export async function deriveKey(password: string, salt: Uint8Array): Promise<CKey> {
  const hash = await argon2id({
    password,
    salt,
    parallelism: 4,
    iterations: 8,
    memorySize: 262144, // 256 MB
    hashLength: 32,
    outputType: 'binary',
  });
  try {
    return await subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  } finally {
    hash.fill(0);
  }
}

export async function encrypt(data: unknown, key: CKey, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = encoder.encode(JSON.stringify(data));
  try {
    const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    const result = new Uint8Array(SALT_LENGTH + IV_LENGTH + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, SALT_LENGTH);
    result.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);
    return result;
  } finally {
    plaintext.fill(0);
  }
}

export async function decrypt(buffer: ArrayBuffer, password: string): Promise<DecryptResult> {
  const raw = new Uint8Array(buffer);
  const salt = raw.slice(0, SALT_LENGTH);
  const iv = raw.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = raw.slice(SALT_LENGTH + IV_LENGTH);
  const key = await deriveKey(password, salt);
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  const decryptedBytes = new Uint8Array(decrypted);
  const decoder = new TextDecoder();
  const json = decoder.decode(decryptedBytes);
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Vault data is corrupted (invalid JSON)');
  } finally {
    decryptedBytes.fill(0);
  }
  return { data, key, salt };
}

export function generateSalt(): Uint8Array {
  return webcrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}
