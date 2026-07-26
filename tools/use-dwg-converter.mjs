#!/usr/bin/env node
/**
 * Point the example app at the private @mlightcad/dwg-converter package
 * instead of @mlightcad/libredwg-converter.
 *
 * Updates packages/example:
 *   - index.html: LibreDWG → dwg-converter
 *   - package.json: dependency name
 *   - vite.config.ts: package references
 *   - src/main.ts: import, class name and worker file references
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const toolsDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(toolsDir, '..')
const exampleDir = path.join(rootDir, 'packages', 'example')

const FROM_PKG = '@mlightcad/libredwg-converter'
const TO_PKG = '@mlightcad/dwg-converter'

/**
 * @param {string} filePath
 * @param {(content: string) => string} transform
 * @returns {Promise<boolean>} true if the file changed
 */
async function updateFile(filePath, transform) {
  const before = await readFile(filePath, { encoding: 'utf8' })
  const after = transform(before)
  if (after === before) {
    return false
  }
  await writeFile(filePath, after, { encoding: 'utf8' })
  return true
}

const changes = []

const indexHtmlPath = path.join(exampleDir, 'index.html')
if (
  await updateFile(indexHtmlPath, (content) =>
    content.replaceAll('LibreDWG', 'dwg-converter')
  )
) {
  changes.push('index.html: LibreDWG → dwg-converter')
}

const packageJsonPath = path.join(exampleDir, 'package.json')
if (
  await updateFile(packageJsonPath, (content) => {
    const pkg = JSON.parse(content)
    const deps = pkg.dependencies ?? {}
    if (!(FROM_PKG in deps)) {
      return content
    }
    const version = deps[FROM_PKG]
    delete deps[FROM_PKG]
    deps[TO_PKG] = version === undefined ? 'workspace:*' : version
    pkg.dependencies = deps
    return `${JSON.stringify(pkg, null, 2)}\n`
  })
) {
  changes.push(`package.json: ${FROM_PKG} → ${TO_PKG}`)
}

const viteConfigPath = path.join(exampleDir, 'vite.config.ts')
if (
  await updateFile(viteConfigPath, (content) =>
    content.replaceAll(FROM_PKG, TO_PKG)
  )
) {
  changes.push(`vite.config.ts: ${FROM_PKG} → ${TO_PKG}`)
}

const mainTsPath = path.join(exampleDir, 'src', 'main.ts')
if (
  await updateFile(mainTsPath, (content) =>
    content
      .replaceAll(FROM_PKG, TO_PKG)
      .replaceAll('AcDbLibreDwgConverter', 'AcDbDwgConverter')
      .replaceAll('libredwg-parser-worker.js', 'dwg-parser-worker.js')
  )
) {
  changes.push('src/main.ts: AcDbLibreDwgConverter → AcDbDwgConverter')
}

if (changes.length === 0) {
  console.log('Example already uses @mlightcad/dwg-converter. Nothing to do.')
  process.exit(0)
}

console.log('Updated packages/example to use @mlightcad/dwg-converter:')
for (const line of changes) {
  console.log(`  - ${line}`)
}
console.log('')
console.log('Next steps (if needed):')
console.log('  pnpm setup:private')
console.log('  pnpm install')
console.log('  pnpm --filter @mlightcad/dwg-converter build')
