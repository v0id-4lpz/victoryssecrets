import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    // Argon2id uses 256MB per derivation — limit parallelism to avoid memory/CPU starvation
    // Each test file gets its own fork to avoid singleton vault state conflicts
    maxConcurrency: 5,
    pool: 'forks',
    isolate: true,
    poolOptions: {
      forks: {
        maxForks: 3,
        isolate: true,
      },
    },
  },
});
