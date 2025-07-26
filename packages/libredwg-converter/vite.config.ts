import { defineConfig } from 'vite'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index.ts',
      name: 'libredwg-converter',
      fileName: 'libredwg-converter'
    }
  },
  plugins: [peerDepsExternal()]
})
