import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  banner: {
    js: `import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);`,
  },
  outfile: 'api/index.js',
});

console.log('Successfully bundled api/index.js with createRequire banner');
