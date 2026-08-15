#!/usr/bin/env node
/**
 * Clone private maintainer packages into the workspace (Scheme A).
 *
 * Public CI never runs this. Override the repo URL with DWG_CONVERTER_REPO_URL
 * if needed.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const toolsDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(toolsDir, '..')
const targetDir = path.join(rootDir, 'packages', 'dwg-converter')
const defaultRepoUrl = 'https://github.com/mlight-cad/dwg-converter.git'
const repoUrl = process.env.DWG_CONVERTER_REPO_URL || defaultRepoUrl

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function printNextSteps(prefix) {
  console.log(prefix)
  console.log('  pnpm use:dwg-converter')
  console.log('  pnpm install')
  console.log('  pnpm --dir packages/dwg-converter install')
  console.log('  pnpm --dir packages/dwg-converter build')
  console.log('')
  console.log(
    'Note: packages/dwg-converter is excluded from pnpm-workspace.yaml,'
  )
  console.log(
    'so it will not be added to the public pnpm-lock.yaml.'
  )
}

if (existsSync(targetDir)) {
  console.log(`Already present: ${path.relative(rootDir, targetDir)}`)
  printNextSteps('Next steps:')
  process.exit(0)
}

console.log(`Cloning ${repoUrl} -> packages/dwg-converter`)
run('git', ['clone', repoUrl, path.join('packages', 'dwg-converter')])

printNextSteps('Clone complete. Next steps:')
