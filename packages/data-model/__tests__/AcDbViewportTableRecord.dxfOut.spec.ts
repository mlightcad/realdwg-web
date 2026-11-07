import { acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbDxfFiler } from '../src/base/AcDbDxfFiler'
import { AcDbViewportTableRecord } from '../src/database/AcDbViewportTableRecord'
import { ACTIVE_VPORT_NAME } from '../src/misc/AcDbConstants'

/** Extract one TABLES-section VPORT record body (pairs after the entity type). */
function vportRecordPairs(dxf: string, name: string): string[] {
  const tablesStart = dxf.indexOf('0\nSECTION\n2\nTABLES\n')
  expect(tablesStart).toBeGreaterThanOrEqual(0)
  const tablesEnd = dxf.indexOf('\n0\nENDSEC\n', tablesStart)
  const tables = dxf.slice(tablesStart, tablesEnd)

  const marker = `0\nVPORT\n`
  let from = 0
  while (true) {
    const start = tables.indexOf(marker, from)
    expect(start).toBeGreaterThanOrEqual(0)
    // Do not stop at `\n0\n` alone — point coords use group 10/20 with value 0.
    let j = start + marker.length
    let next = tables.length
    while (true) {
      const p = tables.indexOf('\n0\n', j)
      if (p < 0) break
      const type = tables.slice(p + 3).split('\n')[0]
      if (/^[A-Z_*]/.test(type)) {
        next = p
        break
      }
      j = p + 3
    }
    const body = tables.slice(start + marker.length, next)
    if (body.includes(`\n2\n${name}\n`) || body.startsWith(`2\n${name}\n`)) {
      return body.split('\n')
    }
    from = next
  }
}

describe('AcDbViewportTableRecord.dxfOutFields (#294)', () => {
  it('writes view height as VPORT group 40 only (not entity group 45)', () => {
    const record = new AcDbViewportTableRecord()
    record.name = ACTIVE_VPORT_NAME
    record.gsView.viewHeight = 12.5
    record.gsView.aspectRatio = 1.5

    const filer = new AcDbDxfFiler()
    record.dxfOutFields(filer)
    const text = filer.toString()

    expect(text).toMatch(/\n40\n12\.5\n/)
    expect(text).toMatch(/\n41\n1\.5\n/)
    // LibreDWG rejects DXF group 45 on VPORT table records.
    expect(text).not.toMatch(/\n45\n/)
  })

  it('exports a default AC1015 database without VPORT group 45 or R2007+ fields', () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db
    db.createDefaultData()

    const dxf = db.dxfOut(undefined, 6, 'AC1015') as string
    expect(typeof dxf).toBe('string')

    const pairs = vportRecordPairs(dxf, ACTIVE_VPORT_NAME)
    const codes = new Set<string>()
    for (let i = 0; i + 1 < pairs.length; i += 2) {
      codes.add(pairs[i])
    }

    expect(codes.has('40')).toBe(true)
    expect(codes.has('45')).toBe(false)
    // R2007+ VPORT fields — LibreDWG rejects these on AC1015.
    expect(codes.has('61')).toBe(false)
    expect(codes.has('292')).toBe(false)
    expect(codes.has('348')).toBe(false)
  })
})
