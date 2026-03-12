// generator.ts — secret generator (crypto.getRandomValues)

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

export interface PasswordOptions {
  lowercase?: boolean;
  uppercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
}

export function generatePassword(length = 24, options: PasswordOptions = {}): string {
  const {
    lowercase = true,
    uppercase = true,
    digits = true,
    symbols = true,
  } = options;

  let charset = '';
  if (lowercase) charset += LOWERCASE;
  if (uppercase) charset += UPPERCASE;
  if (digits) charset += DIGITS;
  if (symbols) charset += SYMBOLS;

  if (!charset) charset = LOWERCASE + UPPERCASE + DIGITS;

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (v) => charset[v % charset.length]).join('');
}

export function generateBase64(bytes = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

export function generateHex(bytes = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateUUID(): string {
  return crypto.randomUUID();
}
