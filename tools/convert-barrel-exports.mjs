#!/usr/bin/env node
/**
 * Converts `export * from '...'` barrel lines to explicit named re-exports
 * (split into value and type exports) for better tree-shaking.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packagesDir = path.join(repoRoot, 'packages')

const PACKAGE_SRC = {
  '@mlightcad/common': 'common/src',
  '@mlightcad/geometry-engine': 'geometry-engine/src',
  '@mlightcad/graphic-interface': 'graphic-interface/src',
  '@mlightcad/data-model': 'data-model/src'
}

/** @typedef {{ values: string[], types: string[] }} ExportGroups */

/**
 * @param {string} filePath
 * @returns {ExportGroups}
 */
function extractExportedNames(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  /** @type {Set<string>} */
  const values = new Set()
  /** @type {Set<string>} */
  const types = new Set()

  for (const match of content.matchAll(
    /^export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:const\s+)?(enum|class|interface|type|function|const)\s+(\w+)/gm
  )) {
    const kind = match[1]
    const name = match[2]
    if (kind === 'interface' || kind === 'type') {
      types.add(name)
    } else {
      values.add(name)
    }
  }

  for (const match of content.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of match[1].split(',')) {
      const trimmed = part.trim()
      if (!trimmed || trimmed === 'default') continue
      const isType = /^type\s+/.test(trimmed)
      const cleaned = trimmed.replace(/^type\s+/, '')
      const asParts = cleaned.split(/\s+as\s+/)
      const exported = asParts[asParts.length - 1].trim()
      if (!exported || !/^\w+$/.test(exported)) continue
      if (isType) types.add(exported)
      else values.add(exported)
    }
  }

  return {
    values: [...values].sort(),
    types: [...types].sort()
  }
}

/**
 * @param {ExportGroups} a
 * @param {ExportGroups} b
 * @returns {ExportGroups}
 */
function mergeExportGroups(a, b) {
  return {
    values: [...new Set([...a.values, ...b.values])].sort(),
    types: [...new Set([...a.types, ...b.types])].sort()
  }
}

/**
 * @param {string} fromDir
 * @param {string} specifier
 */
function resolveModulePath(fromDir, specifier) {
  const normalized = specifier.replace(/\/$/, '')

  if (normalized.startsWith('@mlightcad/')) {
    const rel = PACKAGE_SRC[normalized]
    if (!rel) return null
    return path.join(packagesDir, rel, 'index.ts')
  }

  const candidates = [
    path.join(fromDir, `${normalized}.ts`),
    path.join(fromDir, normalized, 'index.ts')
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/**
 * @param {string} indexPath
 * @returns {ExportGroups}
 */
function collectNamesFromIndex(indexPath) {
  const dir = path.dirname(indexPath)
  const content = fs.readFileSync(indexPath, 'utf8')
  /** @type {ExportGroups} */
  let groups = { values: [], types: [] }

  for (const line of content.split('\n')) {
    const star = line.match(/^export \* from ['"](.+?)['"]\s*;?\s*$/)
    if (star) {
      const resolved = resolveModulePath(dir, star[1])
      if (!resolved) {
        throw new Error(`Cannot resolve '${star[1]}' from ${indexPath}`)
      }
      const child =
        path.basename(resolved) === 'index.ts' && resolved !== indexPath
          ? collectNamesFromIndex(resolved)
          : extractExportedNames(resolved)
      groups = mergeExportGroups(groups, child)
      continue
    }

    const valueLine = line.match(
      /^export\s*\{([^}]+)\}\s*from\s*['"](.+?)['"]\s*;?\s*$/
    )
    const typeLine = line.match(
      /^export\s+type\s*\{([^}]+)\}\s*from\s*['"](.+?)['"]\s*;?\s*$/
    )
    const match = typeLine || valueLine
    if (!match) continue

    const bucket = typeLine ? groups.types : groups.values
    for (const part of match[1].split(',')) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const exported = trimmed.split(/\s+as\s+/).pop().trim()
      if (exported && /^\w+$/.test(exported)) bucket.push(exported)
    }
    if (typeLine) groups.types = [...new Set(groups.types)].sort()
    else groups.values = [...new Set(groups.values)].sort()
  }

  // Names exported as both (shouldn't happen) stay as values only
  const typeOnly = groups.types.filter(n => !groups.values.includes(n))
  const values = groups.values.filter(n => !typeOnly.includes(n))
  return { values, types: typeOnly }
}

/**
 * @param {ExportGroups} groups
 * @param {string} spec
 */
function formatExportLines(groups, spec) {
  const lines = []
  if (groups.values.length > 0) {
    lines.push(`export { ${groups.values.join(', ')} } from '${spec}'`)
  }
  if (groups.types.length > 0) {
    lines.push(`export type { ${groups.types.join(', ')} } from '${spec}'`)
  }
  return lines
}

/**
 * @param {string} indexPath
 */
function convertIndexFile(indexPath) {
  const dir = path.dirname(indexPath)
  const lines = fs.readFileSync(indexPath, 'utf8').split('\n')
  const out = []
  let changed = false

  for (const line of lines) {
    const match = line.match(/^export \* from ['"](.+?)['"]\s*;?\s*$/)
    if (!match) {
      out.push(line)
      continue
    }

    const spec = match[1]
    const resolved = resolveModulePath(dir, spec)
    if (!resolved) {
      throw new Error(`Cannot resolve '${spec}' from ${indexPath}`)
    }

    const groups =
      path.basename(resolved) === 'index.ts'
        ? collectNamesFromIndex(resolved)
        : extractExportedNames(resolved)

    if (groups.values.length === 0 && groups.types.length === 0) {
      throw new Error(`No exports found for '${spec}' from ${indexPath}`)
    }

    out.push(...formatExportLines(groups, spec))
    changed = true
  }

  if (changed) {
    const text = out.join('\n').replace(/\n+$/, '') + '\n'
    fs.writeFileSync(indexPath, text)
    console.log(`updated ${path.relative(repoRoot, indexPath)}`)
  }
}

function findIndexFiles() {
  const files = []
  for (const pkg of fs.readdirSync(packagesDir)) {
    const srcDir = path.join(packagesDir, pkg, 'src')
    if (!fs.existsSync(srcDir)) continue
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name === 'index.ts') files.push(full)
      }
    }
    walk(srcDir)
  }
  return files.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length)
}

for (const indexPath of findIndexFiles()) {
  const content = fs.readFileSync(indexPath, 'utf8')
  if (content.includes('export * from')) {
    convertIndexFile(indexPath)
  }
}
