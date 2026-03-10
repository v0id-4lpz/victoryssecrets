// crypto.js — Argon2id key derivation + AES-256-GCM encrypt/decrypt

const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Derive a non-extractable AES-256-GCM CryptoKey from password + salt.
 */
export async function deriveKey(password, salt) {
  const rawKey = await window.electronAPI.argon2id(password, salt);
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(rawKey),
    { name: 'AES-GCM' },
    false, // non-extractable — key material stays in protected memory
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt vault data with a CryptoKey.
 * Format: salt (16) + iv (12) + ciphertext
 */
export async function encrypt(data, key, salt) {
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

/**
 * Decrypt vault data with password.
 * Returns { data, key, salt } so the caller can cache the CryptoKey.
 */
export async function decrypt(buffer, password) {
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
  return {
    data: JSON.parse(decoder.decode(decrypted)),
    key,
    salt,
  };
}

/**
 * Generate a fresh random salt.
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}
