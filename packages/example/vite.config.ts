import { existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const libredwgWasmSrc =
  './node_modules/@mlightcad/libredwg-converter/dist/libredwg-web.wasm'

export default defineConfig({
  optimizeDeps: {
    // Do not prebundle GPL converters: Vite would inline @mlightcad/data-model
    // into the optimized chunk, creating a second HostApplicationServices /
    // workingDatabase singleton. The app then sets workingDatabase on one copy
    // while converter-created entities read the other →
    // "The current working database must be set before using it!".
    exclude: ['@mlightcad/libredwg-converter', '@mlightcad/data-model']
  },
  build: {
    outDir: 'dist'
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: './node_modules/@mlightcad/libredwg-converter/dist/*-worker.js',
          dest: 'assets'
        },
        ...(existsSync(libredwgWasmSrc)
          ? [
              {
                // Sibling of libredwg-parser-worker.js (not inlined; see cad-viewer#494).
                src: libredwgWasmSrc,
                dest: 'assets'
              }
            ]
          : [])
      ]
    })
  ]
})
