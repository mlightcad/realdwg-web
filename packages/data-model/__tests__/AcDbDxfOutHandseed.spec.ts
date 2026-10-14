import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbCircle } from '../src/entity/AcDbCircle'
import { AcDbLine } from '../src/entity/AcDbLine'
import { AcGePoint3d } from '@mlightcad/geometry-engine'

/**
 * Track A / EXTENSIONS.md §3 — `$HANDSEED` and handle uniqueness for ODA.
 *
 * Minimal drawing: one LINE + one CIRCLE in model space.
 */

function asAsciiDxf(dxf: string | Uint8Array): string {
  expect(typeof dxf).toBe('string')
  return dxf as string
}

function parseHandseed(dxf: string): number {
  const marker = '9\n$HANDSEED\n5\n'
  const idx = dxf.indexOf(marker)
  expect(idx).toBeGreaterThanOrEqual(0)
  const start = idx + marker.length
  const end = dxf.indexOf('\n', start)
  const hex = dxf.slice(start, end === -1 ? undefined : end).trim()
  expect(hex).toMatch(/^[0-9A-F]+$/i)
  return Number.parseInt(hex, 16)
}

/**
 * Collect group-code 5 handle values from object sections only (excludes
 * HEADER `$HANDSEED`, which also uses group code 5).
 */
function collectObjectHandles(dxf: string): string[] {
  const headerEnd = dxf.indexOf('\n0\nENDSEC\n')
  const body =
    headerEnd >= 0 ? dxf.slice(headerEnd + '\n0\nENDSEC\n'.length) : dxf
  const lines = body.split('\n')
  const handles: string[] = []
  for (let i = 0; i + 1 < lines.length; i += 2) {
    if (lines[i] === '5') {
      handles.push(lines[i + 1].toUpperCase())
    }
  }
  return handles
}

function buildMinimalLineCircleDb(): AcDbDatabase {
  const db = new AcDbDatabase()
  db.createDefaultData()

  const line = new AcDbLine(
    new AcGePoint3d(0, 0, 0),
    new AcGePoint3d(100, 50, 0)
  )
  line.layer = '0'

  const circle = new AcDbCircle(new AcGePoint3d(40, 25, 0), 15)
  circle.layer = '0'

  db.tables.blockTable.modelSpace.appendEntity(line)
  db.tables.blockTable.modelSpace.appendEntity(circle)
  return db
}

describe('dxfOut HANDSEED / handle consistency (Track A)', () => {
  it('emits $HANDSEED strictly greater than every assigned handle', () => {
    const db = buildMinimalLineCircleDb()
    const dxf = asAsciiDxf(db.dxfOut(undefined, 6, 'AC1015'))

    const handseed = parseHandseed(dxf)
    const handles = collectObjectHandles(dxf)
    expect(handles.length).toBeGreaterThan(0)

    const maxHandle = Math.max(
      ...handles.map(h => Number.parseInt(h, 16)).filter(n => Number.isFinite(n))
    )
    expect(handseed).toBeGreaterThan(maxHandle)
  })

  it('emits unique group-5 handles (no duplicates)', () => {
    const db = buildMinimalLineCircleDb()
    const dxf = asAsciiDxf(db.dxfOut(undefined, 6, 'AC1015'))
    const handles = collectObjectHandles(dxf)
    const unique = new Set(handles)
    expect(unique.size).toBe(handles.length)
  })

  it('includes LINE and CIRCLE entities in the ENTITIES section', () => {
    const db = buildMinimalLineCircleDb()
    const dxf = asAsciiDxf(db.dxfOut(undefined, 6, 'AC1015'))
    expect(dxf).toContain('0\nLINE\n')
    expect(dxf).toContain('0\nCIRCLE\n')
  })
})
