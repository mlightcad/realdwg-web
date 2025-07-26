import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  return {
    build: {
      outDir: 'dist',
      lib: {
        entry: 'src/index.ts',
        name: 'data-model',
        fileName: 'data-model'
      }
    },
    plugins: [mode === 'analyze' ? visualizer() : undefined, peerDepsExternal()]
  }
})
