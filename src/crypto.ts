// crypto.ts — Argon2id key derivation + AES-256-GCM encrypt/decrypt

import type { DecryptResult } from './types/vault';

const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const rawKey = await window.electronAPI!.argon2id(password, salt);
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(rawKey),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(data: unknown, key: CryptoKey, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );
  const result = new Uint8Array(SALT_LENGTH + IV_LENGTH + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, SALT_LENGTH);
  result.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);
  return result;
}

export async function decrypt(buffer: ArrayBuffer, password: string): Promise<DecryptResult> {
  const raw = new Uint8Array(buffer);
  const salt = raw.slice(0, SALT_LENGTH);
  const iv = raw.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = raw.slice(SALT_LENGTH + IV_LENGTH);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  const decoder = new TextDecoder();
  const json = decoder.decode(decrypted);
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Vault data is corrupted (invalid JSON)');
  }
  return { data, key, salt };
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}
