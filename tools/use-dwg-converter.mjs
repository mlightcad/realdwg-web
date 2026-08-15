#!/usr/bin/env node
/**
 * Point the example app at the private @mlight-cad/dwg-converter package
 * instead of @mlightcad/libredwg-converter.
 *
 * Updates packages/example:
 *   - index.html: LibreDWG → dwg-converter
 *   - package.json: dependency name
 *   - vite.config.ts: package references + dwg-codepage-*.bin static copy
 *   - src/main.ts: import, class name and worker file references
 *
 * If packages/dwg-converter/package.json exists:
 *   - set @mlightcad/data-model version to link:../data-model
 *     (dwg-converter is outside the pnpm workspace / public lockfile)
 */
import { access, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const toolsDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(toolsDir, '..')
const exampleDir = path.join(rootDir, 'packages', 'example')

const FROM_PKG = '@mlightcad/libredwg-converter'
const LEGACY_TO_PKG = '@mlightcad/dwg-converter'
const TO_PKG = '@mlight-cad/dwg-converter'
const DATA_MODEL_PKG = '@mlightcad/data-model'

const WORKER_SRC_SNIPPET = `${TO_PKG}/dist/*-worker.js`
const CODEPAGE_SRC = `./node_modules/${TO_PKG}/dist/dwg-codepage-*.bin`

/**
 * @param {string} content
 * @returns {string}
 */
function replaceConverterPkg(content) {
  return content
    .replaceAll(FROM_PKG, TO_PKG)
    .replaceAll(LEGACY_TO_PKG, TO_PKG)
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

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

/**
 * Insert dwg-codepage-*.bin viteStaticCopy target after the dwg-converter
 * worker target. Uses line splitting so CRLF/LF both work.
 *
 * @param {string} content
 * @returns {{ content: string, added: boolean }}
 */
function ensureCodepageCopyTarget(content) {
  if (content.includes('dwg-codepage-*.bin')) {
    return { content, added: false }
  }

  const nl = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)
  const workerLineIdx = lines.findIndex(
    (line) =>
      line.includes(WORKER_SRC_SNIPPET) ||
      line.includes(`${LEGACY_TO_PKG}/dist/*-worker.js`)
  )
  if (workerLineIdx === -1) {
    return { content, added: false }
  }

  let closeIdx = -1
  for (let i = workerLineIdx; i < lines.length; i++) {
    if (/^[ \t]*\}$/.test(lines[i])) {
      closeIdx = i
      break
    }
  }
  if (closeIdx === -1) {
    return { content, added: false }
  }

  const indent = lines[closeIdx].match(/^[ \t]*/)[0]
  const propIndent = `${indent}  `
  lines[closeIdx] = `${indent}},`
  lines.splice(
    closeIdx + 1,
    0,
    `${indent}{`,
    `${propIndent}src: '${CODEPAGE_SRC}',`,
    `${propIndent}dest: 'assets'`,
    `${indent}}`
  )

  return { content: lines.join(nl), added: true }
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
{
  const before = await readFile(packageJsonPath, { encoding: 'utf8' })
  const pkg = JSON.parse(before)
  const deps = pkg.dependencies ?? {}
  const fromKey = [FROM_PKG, LEGACY_TO_PKG].find((key) => key in deps)
  if (fromKey && fromKey !== TO_PKG) {
    delete deps[fromKey]
    deps[TO_PKG] = 'link:../dwg-converter'
    pkg.dependencies = deps
    const after = `${JSON.stringify(pkg, null, 2)}\n`
    if (after !== before) {
      await writeFile(packageJsonPath, after, { encoding: 'utf8' })
      changes.push(`package.json: ${fromKey} → ${TO_PKG} (link:../dwg-converter)`)
    }
  }
}

const viteConfigPath = path.join(exampleDir, 'vite.config.ts')
{
  const before = await readFile(viteConfigPath, { encoding: 'utf8' })
  let next = replaceConverterPkg(before)
  const renamed = next !== before
  const ensured = ensureCodepageCopyTarget(next)
  next = ensured.content

  if (next !== before) {
    await writeFile(viteConfigPath, next, { encoding: 'utf8' })
  }
  if (renamed) {
    changes.push(`vite.config.ts: converter package → ${TO_PKG}`)
  }
  if (ensured.added) {
    changes.push('vite.config.ts: add dwg-codepage-*.bin static copy target')
  } else if (!next.includes('dwg-codepage-*.bin')) {
    console.warn(
      'Warning: could not insert dwg-codepage-*.bin copy target into vite.config.ts'
    )
  }
}

const mainTsPath = path.join(exampleDir, 'src', 'main.ts')
if (
  await updateFile(mainTsPath, (content) =>
    replaceConverterPkg(content)
      .replaceAll('AcDbLibreDwgConverter', 'AcDbDwgConverter')
      .replaceAll('libredwg-parser-worker.js', 'dwg-parser-worker.js')
  )
) {
  changes.push('src/main.ts: AcDbLibreDwgConverter → AcDbDwgConverter')
}

const dwgConverterPkgPath = path.join(
  rootDir,
  'packages',
  'dwg-converter',
  'package.json'
)
if (await fileExists(dwgConverterPkgPath)) {
  if (
    await updateFile(dwgConverterPkgPath, (content) => {
      const pkg = JSON.parse(content)
      let changed = false
      for (const section of [
        'dependencies',
        'devDependencies',
        'peerDependencies'
      ]) {
        const deps = pkg[section]
        if (
          deps?.[DATA_MODEL_PKG] != null &&
          deps[DATA_MODEL_PKG] !== 'link:../data-model'
        ) {
          deps[DATA_MODEL_PKG] = 'link:../data-model'
          changed = true
        }
      }
      if (!changed) {
        return content
      }
      return `${JSON.stringify(pkg, null, 2)}\n`
    })
  ) {
    changes.push(
      `packages/dwg-converter/package.json: ${DATA_MODEL_PKG} → link:../data-model`
    )
  }
}

if (changes.length === 0) {
  console.log(`Example already uses ${TO_PKG}. Nothing to do.`)
  process.exit(0)
}

console.log(`Updated to use ${TO_PKG}:`)
for (const line of changes) {
  console.log(`  - ${line}`)
}
console.log('')
console.log('Next steps (if needed):')
console.log('  pnpm setup:private')
console.log('  pnpm install')
console.log(`  pnpm --filter ${TO_PKG} build`)
