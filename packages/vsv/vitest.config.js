import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    // Argon2id uses 256MB per derivation — limit parallelism to avoid memory/CPU starvation
    maxConcurrency: 5,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 3,
      },
    },
  },
});
