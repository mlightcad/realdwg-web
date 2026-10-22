import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

for (const name of [
  'common',
  'geometry-engine',
  'graphic-interface',
  'data-model',
]) {
  const entry = join(root, 'packages', name, 'lib', 'index.js')
  const mod = await import(pathToFileURL(entry).href)
  const keys = Object.keys(mod)
  console.log(name, 'ok', keys.length, 'exports')
}

const dm = await import(
  pathToFileURL(join(root, 'packages/data-model/lib/index.js')).href
)
const db = new dm.AcDbDatabase()
console.log('AcDbDatabase ok', !!db.tables?.layerTable)
