import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  optimizeDeps: {
    // Do not prebundle GPL converters: Vite would inline @mlightcad/data-model
    // into the optimized chunk, creating a second HostApplicationServices /
    // workingDatabase singleton. The app then sets workingDatabase on one copy
    // while converter-created entities read the other →
    // "The current working database must be set before using it!".
    exclude: [
      '@mlightcad/dxf-json-converter',
      '@mlightcad/libredwg-converter',
      '@mlightcad/data-model'
    ]
  },
  build: {
    outDir: 'dist'
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: './node_modules/@mlightcad/dxf-json-converter/dist/*-worker.js',
          dest: 'assets'
        },
        {
          src: './node_modules/@mlightcad/libredwg-converter/dist/*-worker.js',
          dest: 'assets'
        }
      ]
    })
  ]
})
