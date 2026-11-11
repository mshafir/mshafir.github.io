// Bundles the Electron main process (ESM) and preload script (CommonJS, as sandboxed preloads require).
import { build } from 'esbuild'

const shared = { bundle: true, platform: 'node', target: 'node22', external: ['electron'], logLevel: 'warning' }

await Promise.all([
  build({
    ...shared,
    entryPoints: ['electron/main.ts'],
    outfile: 'dist-electron/main.mjs',
    format: 'esm',
    // Bundled CommonJS deps (gray-matter) call require(); give the ESM bundle one.
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  }),
  build({ ...shared, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs', format: 'cjs' }),
])
