import { build } from 'esbuild';

await build({
  entryPoints: ['src/app.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: 'build/app.js',
  external: ['electron'],
});
