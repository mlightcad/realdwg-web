/**
 * Track B / EXTENSIONS.md §4 — DIMENSION definition points round-trip & dump.
 *
 * Verifies typed points survive dxfOut → dxfIn, dump exposes them without
 * exploding anonymous `*D` blocks, and DXF groups 10/13/14/… are present.
 */
import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices, AcDbDxfFiler } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbDxfDocumentReader } from '../src/dxf'
import {
  AcDb3PointAngularDimension,
  AcDbAlignedDimension,
  AcDbArcDimension,
  AcDbDiametricDimension,
  AcDbDimension,
  AcDbOrdinateDimension,
  AcDbRadialDimension,
  AcDbRotatedDimension
} from '../src/entity'

const createDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

const pointCloseTo = (
  actual: { x: number; y: number; z?: number },
  expected: { x: number; y: number; z?: number },
  digits = 6
) => {
  expect(actual.x).toBeCloseTo(expected.x, digits)
  expect(actual.y).toBeCloseTo(expected.y, digits)
  expect(actual.z ?? 0).toBeCloseTo(expected.z ?? 0, digits)
}

/** Write entity fields and read them back into a fresh instance of the same class. */
function roundTripDimension<T extends AcDbDimension>(
  source: T,
  createEmpty: () => T
): T {
  const db = createDb()
  db.tables.blockTable.modelSpace.appendEntity(source)

  const out = new AcDbDxfFiler().setVersion(27)
  source.dxfOut(out)
  const dxf = out.toString()

  const target = createEmpty()
  db.tables.blockTable.modelSpace.appendEntity(target)
  target.dxfIn(AcDbDxfFiler.fromString(dxf, { database: db }))
  return target
}

describe('DIMENSION definition points (Track B)', () => {
  it('aligned: dump + dxfOut group 10/13/14 + round-trip', () => {
    const x1 = { x: 0, y: 0, z: 0 }
    const x2 = { x: 10, y: 0, z: 0 }
    const dimLine = { x: 5, y: 3, z: 0 }
    const dim = new AcDbAlignedDimension(x1, x2, dimLine, '10.000', 'Standard')

    const dump = dim.dumpDefinitionPoints()
    expect(dump.xLine1Point).toMatchObject(x1)
    expect(dump.xLine2Point).toMatchObject(x2)
    expect(dump.dimLinePoint).toMatchObject(dimLine)
    expect(dump.dxfDefinitionPoint).toMatchObject(dimLine)
    expect(dump.dimBlockId).toBeNull()

    const filer = new AcDbDxfFiler()
    createDb().tables.blockTable.modelSpace.appendEntity(dim)
    dim.dxfOutFields(filer)
    const dxf = filer.toString()
    expect(dxf).toMatch(/\n10\n5(\.0+)?\n20\n3(\.0+)?\n/)
    expect(dxf).toMatch(/\n13\n0(\.0+)?\n23\n0(\.0+)?\n/)
    expect(dxf).toMatch(/\n14\n10(\.0+)?\n24\n0(\.0+)?\n/)
    expect(dxf).toContain('100\nAcDbAlignedDimension\n')
    expect(dxf).not.toMatch(/\n15\n5(\.0+)?\n/)

    const read = roundTripDimension(
      dim,
      () =>
        new AcDbAlignedDimension(
          new AcGePoint3d(),
          new AcGePoint3d(),
          new AcGePoint3d()
        )
    )
    pointCloseTo(read.xLine1Point, x1)
    pointCloseTo(read.xLine2Point, x2)
    pointCloseTo(read.dimLinePoint, dimLine)
    pointCloseTo(read.dxfDefinitionPoint, dimLine)
  })

  it('rotated: subclass marker and definition points round-trip', () => {
    const dim = new AcDbRotatedDimension(
      { x: 1, y: 2, z: 0 },
      { x: 11, y: 2, z: 0 },
      { x: 6, y: 5, z: 0 }
    )
    dim.rotation = Math.PI / 2
    expect(dim.dimensionType & 0x0f).toBe(0)

    const read = roundTripDimension(
      dim,
      () =>
        new AcDbRotatedDimension(
          new AcGePoint3d(),
          new AcGePoint3d(),
          new AcGePoint3d()
        )
    )
    pointCloseTo(read.xLine1Point, { x: 1, y: 2, z: 0 })
    pointCloseTo(read.dimLinePoint, { x: 6, y: 5, z: 0 })
    expect(read.dumpDefinitionPoints().dimLinePoint).toMatchObject({
      x: 6,
      y: 5,
      z: 0
    })

    const filer = new AcDbDxfFiler()
    createDb().tables.blockTable.modelSpace.appendEntity(dim)
    dim.dxfOutFields(filer)
    expect(filer.toString()).toContain('100\nAcDbRotatedDimension\n')
  })

  it('radial: group 10=center, group 15=chord round-trip', () => {
    const center = { x: 0, y: 0, z: 0 }
    const chord = { x: 5, y: 0, z: 0 }
    const dim = new AcDbRadialDimension(center, chord, 2.5)

    expect(dim.dumpDefinitionPoints()).toMatchObject({
      center,
      chordPoint: chord,
      leaderLength: 2.5,
      dxfDefinitionPoint: center
    })

    const filer = new AcDbDxfFiler()
    createDb().tables.blockTable.modelSpace.appendEntity(dim)
    dim.dxfOutFields(filer)
    const dxf = filer.toString()
    expect(dxf).toMatch(/\n10\n0(\.0+)?\n20\n0(\.0+)?\n/)
    expect(dxf).toMatch(/\n15\n5(\.0+)?\n25\n0(\.0+)?\n/)
    expect(dxf).toContain('\n40\n2.5\n')

    const read = roundTripDimension(
      dim,
      () => new AcDbRadialDimension(new AcGePoint3d(), new AcGePoint3d(), 0)
    )
    pointCloseTo(read.center, center)
    pointCloseTo(read.chordPoint, chord)
    expect(read.leaderLength).toBeCloseTo(2.5)
  })

  it('diametric: group 10=chord, group 15=far chord round-trip', () => {
    const chord = { x: 5, y: 0, z: 0 }
    const far = { x: -5, y: 0, z: 0 }
    const dim = new AcDbDiametricDimension(chord, far, 1)

    expect(dim.dumpDefinitionPoints()).toMatchObject({
      chordPoint: chord,
      farChordPoint: far,
      dxfDefinitionPoint: chord
    })

    const filer = new AcDbDxfFiler()
    createDb().tables.blockTable.modelSpace.appendEntity(dim)
    dim.dxfOutFields(filer)
    const dxf = filer.toString()
    expect(dxf).toMatch(/\n10\n5(\.0+)?\n20\n0(\.0+)?\n/)
    expect(dxf).toMatch(/\n15\n-5(\.0+)?\n25\n0(\.0+)?\n/)

    const read = roundTripDimension(
      dim,
      () => new AcDbDiametricDimension(new AcGePoint3d(), new AcGePoint3d(), 0)
    )
    pointCloseTo(read.chordPoint, chord)
    pointCloseTo(read.farChordPoint, far)
  })

  it('3-point angular: extension + center + arc dump and round-trip', () => {
    const center = { x: 0, y: 0, z: 0 }
    const x1 = { x: 10, y: 0, z: 0 }
    const x2 = { x: 0, y: 10, z: 0 }
    const arc = { x: 7, y: 7, z: 0 }
    const dim = new AcDb3PointAngularDimension(center, x1, x2, arc)

    expect(dim.dumpDefinitionPoints()).toMatchObject({
      centerPoint: center,
      xLine1Point: x1,
      xLine2Point: x2,
      arcPoint: arc,
      dxfDefinitionPoint: arc
    })

    const read = roundTripDimension(
      dim,
      () =>
        new AcDb3PointAngularDimension(
          new AcGePoint3d(),
          new AcGePoint3d(),
          new AcGePoint3d(),
          new AcGePoint3d()
        )
    )
    pointCloseTo(read.centerPoint, center)
    pointCloseTo(read.xLine1Point, x1)
    pointCloseTo(read.xLine2Point, x2)
    pointCloseTo(read.arcPoint, arc)
  })

  it('arc length: definition points dump and round-trip', () => {
    const center = { x: 0, y: 0, z: 0 }
    const x1 = { x: 5, y: 0, z: 0 }
    const x2 = { x: 0, y: 5, z: 0 }
    const arc = { x: 3.5, y: 3.5, z: 0 }
    const dim = new AcDbArcDimension(center, x1, x2, arc)

    expect(dim.dumpDefinitionPoints().arcPoint).toMatchObject(arc)

    const read = roundTripDimension(
      dim,
      () =>
        new AcDbArcDimension(
          new AcGePoint3d(),
          new AcGePoint3d(),
          new AcGePoint3d(),
          new AcGePoint3d()
        )
    )
    pointCloseTo(read.centerPoint, center)
    pointCloseTo(read.xLine1Point, x1)
    pointCloseTo(read.xLine2Point, x2)
    pointCloseTo(read.arcPoint, arc)
  })

  it('ordinate: defining/leader/origin dump and groups 10/13/14', () => {
    const defining = { x: 4, y: 0, z: 0 }
    const leader = { x: 4, y: 2, z: 0 }
    const origin = { x: 0, y: 0, z: 0 }
    const dim = new AcDbOrdinateDimension(defining, leader)
    dim.dxfDefinitionPoint = origin

    expect(dim.dumpDefinitionPoints()).toMatchObject({
      definingPoint: defining,
      leaderEndPoint: leader,
      origin,
      dxfDefinitionPoint: origin
    })

    const filer = new AcDbDxfFiler()
    createDb().tables.blockTable.modelSpace.appendEntity(dim)
    dim.dxfOutFields(filer)
    const dxf = filer.toString()
    expect(dxf).toMatch(/\n10\n0(\.0+)?\n20\n0(\.0+)?\n/)
    expect(dxf).toMatch(/\n13\n4(\.0+)?\n23\n0(\.0+)?\n/)
    expect(dxf).toMatch(/\n14\n4(\.0+)?\n24\n2(\.0+)?\n/)

    const read = roundTripDimension(
      dim,
      () => new AcDbOrdinateDimension(new AcGePoint3d(), new AcGePoint3d())
    )
    pointCloseTo(read.definingPoint, defining)
    pointCloseTo(read.leaderEndPoint, leader)
    pointCloseTo(read.dxfDefinitionPoint, origin)
  })

  it('database dxfOut → dxfIn preserves aligned definition points', async () => {
    const db = createDb()
    const dim = new AcDbAlignedDimension(
      { x: 2, y: 1, z: 0 },
      { x: 12, y: 1, z: 0 },
      { x: 7, y: 4, z: 0 },
      '10',
      'Standard'
    )
    db.tables.blockTable.modelSpace.appendEntity(dim)

    const ascii = db.dxfOut(undefined, 6) as string
    expect(ascii).toContain('AcDbAlignedDimension')
    expect(ascii).toMatch(/\n13\n2(\.0+)?\n/)
    expect(ascii).toMatch(/\n14\n12(\.0+)?\n/)
    expect(ascii).toMatch(/\n10\n7(\.0+)?\n/)

    const db2 = createDb()
    await new AcDbDxfDocumentReader(db2).read(
      AcDbDxfFiler.fromString(ascii, { database: db2 })
    )
    const entities = [...db2.tables.blockTable.modelSpace.newIterator()]
    const read = entities.find(
      e => e instanceof AcDbAlignedDimension
    ) as AcDbAlignedDimension
    expect(read).toBeInstanceOf(AcDbAlignedDimension)
    pointCloseTo(read.xLine1Point, { x: 2, y: 1, z: 0 })
    pointCloseTo(read.xLine2Point, { x: 12, y: 1, z: 0 })
    pointCloseTo(read.dimLinePoint, { x: 7, y: 4, z: 0 })
    expect(read.dumpDefinitionPoints().dimLinePoint).toMatchObject({
      x: 7,
      y: 4,
      z: 0
    })
  })
})
