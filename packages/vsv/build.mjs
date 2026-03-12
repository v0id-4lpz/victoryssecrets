import { build } from 'esbuild';

const sharedOptions = {
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  packages: 'external',
};

// Build the CLI entry point
await build({
  ...sharedOptions,
  entryPoints: ['src/bin/vsv.ts'],
  outfile: 'dist/bin/vsv.js',
  banner: { js: '#!/usr/bin/env node' },
});

// Build the library entry point
await build({
  ...sharedOptions,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
});
