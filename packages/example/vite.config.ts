import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

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
        {
          // Sibling of libredwg-parser-worker.js (not inlined; see cad-viewer#494).
          // Required: missing wasm must fail the copy, not be skipped silently.
          src: './node_modules/@mlightcad/libredwg-converter/dist/libredwg-web.wasm',
          dest: 'assets'
        }
      ]
    })
  ]
})
