import { defineConfig } from 'vite'

export default defineConfig(() => {
  return {
    build: {
      emptyOutDir: false,
      outDir: 'dist',
      lib: {
        entry: 'src/AcDbLibreDwgParserWorker.ts',
        fileName: 'libredwg-parser-worker',
        formats: ['es']
      },
      rollupOptions: {
        // Bundle everything into this output (no shared chunks)
        external: [],
        output: {
          inlineDynamicImports: true
        }
      }
    }
  }
})
