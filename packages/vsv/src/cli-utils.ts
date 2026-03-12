// cli-utils.ts — CLI helpers (password prompt, etc.)

import { createInterface } from 'node:readline';

export function resolveFile(opts: { file?: string }): string {
  const filePath = opts.file || process.env['VSV_FILE'];
  if (!filePath) {
    process.stderr.write('Error: vault file required (-f <path> or VSV_FILE env var)\n');
    process.exit(1);
  }
  return filePath;
}

export async function promptPassword(prompt = 'Password: '): Promise<string> {
  // VSV_PASSWORD env var takes priority (CI/CD, scripts)
  const envPassword = process.env['VSV_PASSWORD'];
  if (envPassword) return envPassword;

  // If stdin is not a TTY (piped), read from stdin directly
  if (!process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => resolve(data.trim()));
      process.stdin.on('error', reject);
    });
  }

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });

    // Disable echo for password input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode?.(true);
    }

    process.stderr.write(prompt);

    let password = '';

    process.stdin.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      for (const char of str) {
        if (char === '\n' || char === '\r') {
          process.stderr.write('\n');
          if (process.stdin.isTTY) {
            process.stdin.setRawMode?.(false);
          }
          rl.close();
          resolve(password);
          return;
        } else if (char === '\u007f' || char === '\b') {
          // Backspace
          password = password.slice(0, -1);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.stderr.write('\n');
          process.exit(1);
        } else {
          password += char;
        }
      }
    });
  });
}
