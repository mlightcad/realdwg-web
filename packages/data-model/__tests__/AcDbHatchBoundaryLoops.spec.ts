/**
 * Track C / EXTENSIONS.md §5 — HATCH ordered boundary loops dump & round-trip.
 */
import { AcGePolyline2d } from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices, AcDbDxfFiler } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbDxfDocumentReader } from '../src/dxf'
import { AcDbHatch } from '../src/entity'

const createDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

const rect = (x: number, y: number, w: number, h: number) =>
  new AcGePolyline2d(
    [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h }
    ],
    true
  )

describe('HATCH boundary loops (Track C)', () => {
  it('dumpBoundaryLoops exposes outer then island in OCS', () => {
    const db = createDb()
    const hatch = new AcDbHatch()
    db.tables.blockTable.modelSpace.appendEntity(hatch)
    hatch.isSolidFill = true
    hatch.patternName = 'SOLID'
    hatch.elevation = 2
    hatch.add(rect(0, 0, 10, 5))
    hatch.add(rect(2, 1, 2, 2))

    expect(hatch.loops.length).toBe(2)
    const dump = hatch.dumpBoundaryLoops()
    expect(dump.coordinateSpace).toBe('OCS')
    expect(dump.elevation).toBe(2)
    expect(dump.loops).toHaveLength(2)
    expect(dump.loops[0].index).toBe(0)
    expect(dump.loops[0].isClosed).toBe(true)
    expect(dump.loops[0].polyline).toHaveLength(4)
    expect(dump.loops[0].polyline![0].point).toEqual([0, 0, 2])
    expect(dump.loops[1].index).toBe(1)
    expect(dump.loops[1].polyline![0].point[0]).toBe(2)
  })

  it('dxfOut / dxfIn preserves polyline loops (entity fields)', () => {
    const db = createDb()
    const hatch = new AcDbHatch()
    db.tables.blockTable.modelSpace.appendEntity(hatch)
    hatch.isSolidFill = true
    hatch.patternName = 'SOLID'
    hatch.add(rect(0, 0, 8, 4))
    hatch.add(rect(1, 1, 2, 1))

    const out = new AcDbDxfFiler().setVersion(27)
    hatch.dxfOut(out)
    const dxf = out.toString()
    expect(dxf).toMatch(/\n91\n2\n/)

    const roundTrip = new AcDbHatch()
    db.tables.blockTable.modelSpace.appendEntity(roundTrip)
    // Pre-seed a bogus loop to prove dxfIn clears first.
    roundTrip.add(rect(99, 99, 1, 1))
    expect(roundTrip.loops.length).toBe(1)

    roundTrip.dxfIn(AcDbDxfFiler.fromString(dxf, { database: db }))
    expect(roundTrip.loops.length).toBe(2)
    const dump = roundTrip.dumpBoundaryLoops()
    expect(dump.loops[0].polyline![0].point.slice(0, 2)).toEqual([0, 0])
    expect(dump.loops[1].polyline![0].point.slice(0, 2)).toEqual([1, 1])
  })

  it('database dxfOut → document read keeps ordered loops', async () => {
    const db = createDb()
    const hatch = new AcDbHatch()
    hatch.isSolidFill = true
    hatch.patternName = 'SOLID'
    hatch.add(rect(0, 0, 10, 5))
    hatch.add(rect(3, 1, 2, 2))
    db.tables.blockTable.modelSpace.appendEntity(hatch)

    const ascii = db.dxfOut(undefined, 6) as string
    expect(ascii).toMatch(/\n91\n2\n/)

    const db2 = createDb()
    await new AcDbDxfDocumentReader(db2).read(
      AcDbDxfFiler.fromString(ascii, { database: db2 })
    )
    const read = [...db2.tables.blockTable.modelSpace.newIterator()].find(
      e => e instanceof AcDbHatch
    ) as AcDbHatch
    expect(read).toBeInstanceOf(AcDbHatch)
    expect(read.loops.length).toBe(2)
    expect(read.dumpBoundaryLoops().loops[0].polyline).toHaveLength(4)
    expect(read.dumpBoundaryLoops().loops[1].polyline![0].point[0]).toBe(3)
  })
})
