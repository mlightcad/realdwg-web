/**
 * Rewrite relative import/export specifiers to Node-native ESM form:
 *   ./foo      → ./foo.js          (file)
 *   ./foo      → ./foo/index.js    (directory)
 *   ./foo/     → ./foo/index.js
 *
 * Usage:
 *   node tools/fix-relative-esm-imports.mjs packages/common packages/data-model ...
 *   node tools/fix-relative-esm-imports.mjs --dry-run packages/data-model
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const targets = process.argv.slice(2).filter((a) => a !== '--dry-run')

if (targets.length === 0) {
  console.error(
    'Usage: node tools/fix-relative-esm-imports.mjs [--dry-run] <pkgDir>...'
  )
  process.exit(2)
}

function walkTs(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walkTs(p, acc)
    else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) acc.push(p)
  }
  return acc
}

function resolveSpecifier(fromFile, spec) {
  if (!(spec.startsWith('./') || spec.startsWith('../'))) return null
  if (extname(spec) && !spec.endsWith('/')) {
    // Already has an extension (.js, .json, .css, …) — leave alone
    return null
  }

  const base = join(dirname(fromFile), spec.replace(/\/$/, ''))
  const asFileTs = `${base}.ts`
  const asFileTsx = `${base}.tsx`
  const asIndexTs = join(base, 'index.ts')
  const asIndexTsx = join(base, 'index.tsx')

  if (existsSync(asFileTs) || existsSync(asFileTsx)) {
    return spec.replace(/\/$/, '') + '.js'
  }
  if (existsSync(asIndexTs) || existsSync(asIndexTsx)) {
    const cleaned = spec.replace(/\/$/, '')
    return `${cleaned}/index.js`
  }

  throw new Error(
    `Cannot resolve relative specifier "${spec}" from ${relative(root, fromFile)}`
  )
}

/** Match import/export/dynamic-import string specifiers. */
const SPEC_RE =
  /((?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g

function transform(source, file) {
  let changed = 0
  const out = source.replace(SPEC_RE, (full, prefix, quote, spec) => {
    const next = resolveSpecifier(file, spec)
    if (!next || next === spec) return full
    changed++
    return `${prefix}${quote}${next}${quote}`
  })
  return { out, changed }
}

let filesChanged = 0
let specsChanged = 0

for (const t of targets) {
  const srcDir = join(root, t, 'src')
  if (!existsSync(srcDir)) {
    console.error(`Missing src/: ${t}`)
    process.exit(1)
  }
  const files = walkTs(srcDir)
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const { out, changed } = transform(source, file)
    if (changed === 0) continue
    filesChanged++
    specsChanged += changed
    const rel = relative(root, file)
    console.log(`${dryRun ? 'DRY ' : ''}${rel}: ${changed} specifier(s)`)
    if (!dryRun) writeFileSync(file, out)
  }
}

console.log(
  `\n${dryRun ? 'Dry run — ' : ''}files=${filesChanged} specifiers=${specsChanged}`
)
