/**
 * Track A smoke: build a minimal LINE+CIRCLE drawing, dxfOut, assert
 * $HANDSEED / unique handles, optionally run ODA File Converter → ACAD2010 DWG.
 *
 * Usage:
 *   node tools/smoke-dxfout-handseed.mjs
 *   node tools/smoke-dxfout-handseed.mjs --oda "D:\\ODAFileConverter 26.4.0\\ODAFileConverter.exe"
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const require = createRequire(import.meta.url)

// Prefer built CJS bundle (no workspace TS loader required).
const dm = require(join(root, 'packages/data-model/dist/data-model.cjs'))
const { AcDbDatabase, AcDbLine, AcDbCircle, AcGePoint3d } = dm
if (!AcDbDatabase || !AcGePoint3d) {
  throw new Error('data-model CJS bundle missing AcDbDatabase / AcGePoint3d')
}

function parseHandseed(dxf) {
  const marker = '9\n$HANDSEED\n5\n'
  const idx = dxf.indexOf(marker)
  if (idx < 0) throw new Error('$HANDSEED not found')
  const start = idx + marker.length
  const end = dxf.indexOf('\n', start)
  return Number.parseInt(dxf.slice(start, end).trim(), 16)
}

function collectObjectHandles(dxf) {
  const headerEnd = dxf.indexOf('\n0\nENDSEC\n')
  const body = headerEnd >= 0 ? dxf.slice(headerEnd + '\n0\nENDSEC\n'.length) : dxf
  const lines = body.split('\n')
  const handles = []
  for (let i = 0; i + 1 < lines.length; i += 2) {
    if (lines[i] === '5') handles.push(lines[i + 1].toUpperCase())
  }
  return handles
}

function findOda() {
  const argIdx = process.argv.indexOf('--oda')
  if (argIdx >= 0 && process.argv[argIdx + 1]) return process.argv[argIdx + 1]
  const candidates = [
    process.env.ODA_FILE_CONVERTER,
    'D:\\ODAFileConverter 26.4.0\\ODAFileConverter.exe',
    'C:\\Program Files\\ODA\\ODAFileConverter\\ODAFileConverter.exe'
  ]
  for (const c of candidates) {
    if (c && existsSync(c)) return c
  }
  return null
}

const db = new AcDbDatabase()
db.createDefaultData()
const line = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(100, 50, 0))
line.layer = '0'
const circle = new AcDbCircle(new AcGePoint3d(40, 25, 0), 15)
circle.layer = '0'
db.tables.blockTable.modelSpace.appendEntity(line)
db.tables.blockTable.modelSpace.appendEntity(circle)

const dxf = db.dxfOut(undefined, 6, 'AC1015')
if (typeof dxf !== 'string') throw new Error('expected ASCII dxfOut')

const outDir = join(root, 'temp', 'track-a-handseed')
mkdirSync(outDir, { recursive: true })
const dxfPath = join(outDir, 'minimal_line_circle.dxf')
writeFileSync(dxfPath, dxf, 'utf8')

const handseed = parseHandseed(dxf)
const handles = collectObjectHandles(dxf)
const maxHandle = Math.max(...handles.map(h => Number.parseInt(h, 16)))
const unique = new Set(handles)

console.log('DXF:', dxfPath)
console.log('$HANDSEED:', handseed.toString(16).toUpperCase(), `(${handseed})`)
console.log('max object handle:', maxHandle.toString(16).toUpperCase(), `(${maxHandle})`)
console.log('handle count:', handles.length, 'unique:', unique.size)

if (!(handseed > maxHandle)) {
  console.error('FAIL: $HANDSEED must be > max assigned handle')
  process.exit(1)
}
if (unique.size !== handles.length) {
  console.error('FAIL: duplicate handles in DXF')
  process.exit(1)
}
if (!dxf.includes('0\nLINE\n') || !dxf.includes('0\nCIRCLE\n')) {
  console.error('FAIL: missing LINE or CIRCLE')
  process.exit(1)
}
console.log('ASSERTIONS: OK ($HANDSEED > max, no duplicate handles)')

const oda = findOda()
if (!oda) {
  console.log('ODA: not found (skipped). Pass --oda <path> to run conversion.')
  process.exit(0)
}

const odaIn = join(outDir, 'oda_in')
const odaOut = join(outDir, 'oda_out')
mkdirSync(odaIn, { recursive: true })
mkdirSync(odaOut, { recursive: true })
writeFileSync(join(odaIn, 'minimal_line_circle.dxf'), dxf, 'utf8')

// ODAFileConverter InputFolder OutputFolder OutputVersion OutputFileType Recurse Audit [Filter]
// OutputVersion: ACAD2010; OutputFileType: DWG
console.log('ODA:', oda)
const result = spawnSync(
  oda,
  [odaIn, odaOut, 'ACAD2010', 'DWG', '0', '1'],
  { encoding: 'utf8', windowsHide: true }
)
console.log('ODA exit:', result.status)
if (result.stdout) console.log('ODA stdout:\n', result.stdout.slice(0, 4000))
if (result.stderr) console.log('ODA stderr:\n', result.stderr.slice(0, 4000))

const dwgs = existsSync(odaOut)
  ? readdirSync(odaOut).filter(f => f.toLowerCase().endsWith('.dwg'))
  : []
console.log('ODA output DWGs:', dwgs)
if (result.status !== 0 || dwgs.length === 0) {
  console.error('FAIL: ODA conversion did not produce DWG')
  process.exit(1)
}
console.log('ODA: OK →', join(odaOut, dwgs[0]))
