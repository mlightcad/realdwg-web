import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const libEntry = path.join(__dirname, '../lib/index.js')

describe('data-model lib/ ESM (Node-native)', () => {
  it('emits lib/index.js', () => {
    expect(fs.existsSync(libEntry)).toBe(true)
  })

  it('loads under native Node ESM without a custom loader', () => {
    // Jest's CJS runtime cannot import the published ESM graph directly.
    // Spawn Node so we exercise the real package entry consumers use.
    const script = `
      import { pathToFileURL } from 'node:url'
      const dm = await import(pathToFileURL(${JSON.stringify(libEntry)}).href)
      if (typeof dm.AcDbDatabase !== 'function') {
        throw new Error('AcDbDatabase missing')
      }
      if (typeof dm.acdbHostApplicationServices !== 'function') {
        throw new Error('acdbHostApplicationServices missing')
      }
      const db = new dm.AcDbDatabase()
      if (!db.tables?.layerTable) {
        throw new Error('layerTable missing')
      }
    `
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      stdio: 'pipe',
      env: process.env
    })
  })
})
