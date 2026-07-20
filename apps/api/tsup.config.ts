import { defineConfig } from 'tsup'

/**
 * Bundle the server for production. Workspace packages (@bingoo.ai/*) ship as raw
 * TypeScript source, so they must be inlined; third-party deps stay external and
 * are resolved from node_modules at runtime.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@bingoo\//],
})
