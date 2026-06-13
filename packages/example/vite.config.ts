import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
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
