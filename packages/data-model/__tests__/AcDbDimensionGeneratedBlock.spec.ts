import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices } from '../src/base'
import { AcDbBlockTableRecord, AcDbDatabase } from '../src/database'
import {
  AcDbAlignedDimension,
  AcDbLine,
  AcDbMText,
  AcDbOrdinateDimension,
  AcDbRotatedDimension
} from '../src/entity'

const createDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

/**
 * Drives block generation directly rather than through subWorldDraw, so the
 * assertions are about the generated geometry and not the rendering cache.
 */
function generate(dim: { subWorldDraw: unknown }) {
  return (
    dim as unknown as {
      getOrCreateDimBlockTableRecord(): AcDbBlockTableRecord | undefined
    }
  ).getOrCreateDimBlockTableRecord()
}

function generatedBlockOf(db: AcDbDatabase, objectId: string) {
  return db.tables.blockTable.getAt(`*D_GEN_${objectId}`)
}

describe('dimension geometry generated when the file ships no *D block', () => {
  it('lays out a rotated dimension as dimension line, extension lines and text', () => {
    const db = createDb()
    const dim = new AcDbRotatedDimension(
      new AcGePoint3d(10, 10, 0),
      new AcGePoint3d(40, 20, 0),
      new AcGePoint3d(10, 30, 0)
    )
    dim.rotation = 0
    db.tables.blockTable.modelSpace.appendEntity(dim)
    expect(dim.dimBlockId).toBeNull()

    generate(dim)

    const block = generatedBlockOf(db, dim.objectId)
    expect(block).toBeInstanceOf(AcDbBlockTableRecord)
    const entities = [...block!.newIterator()]
    const lines = entities.filter(e => e instanceof AcDbLine) as AcDbLine[]
    // One dimension line plus two extension lines.
    expect(lines).toHaveLength(3)

    // The dimension line is horizontal at the dim-line point's height and spans
    // the two measured points.
    const dimLine = lines[0]
    expect(dimLine.startPoint.y).toBeCloseTo(30)
    expect(dimLine.endPoint.y).toBeCloseTo(30)
    expect(Math.abs(dimLine.endPoint.x - dimLine.startPoint.x)).toBeCloseTo(30)

    const texts = entities.filter(e => e instanceof AcDbMText) as AcDbMText[]
    expect(texts).toHaveLength(1)
    // Rotated dimensions measure along the dimension line, not point to point,
    // so 30x10 dimensioned horizontally reads 30 rather than 31.62.
    expect(Number(texts[0].contents)).toBeCloseTo(30)
  })

  it('reuses the generated block instead of appending a new one per draw', () => {
    const db = createDb()
    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(0, 5, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(dim)

    generate(dim)
    const afterFirst = db.tables.blockTable.numEntries
    generate(dim)

    expect(db.tables.blockTable.numEntries).toBe(afterFirst)
  })

  it('does not touch the block table when only extents are read', () => {
    const db = createDb()
    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(0, 5, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(dim)
    const before = db.tables.blockTable.numEntries

    expect(dim.geometricExtents.isEmpty()).toBe(false)
    expect(db.tables.blockTable.numEntries).toBe(before)
  })

  it('lays out an ordinate dimension as a doglegged leader with its coordinate', () => {
    const db = createDb()
    const dim = new AcDbOrdinateDimension(
      new AcGePoint3d(20, 10, 0),
      new AcGePoint3d(20, 40, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(dim)

    generate(dim)

    const block = generatedBlockOf(db, dim.objectId)
    expect(block).toBeDefined()
    const entities = [...block!.newIterator()]
    expect(entities.filter(e => e instanceof AcDbLine).length).toBeGreaterThan(
      0
    )
    const texts = entities.filter(e => e instanceof AcDbMText) as AcDbMText[]
    expect(texts).toHaveLength(1)
    // Measured along Y here, so the label is the defining point's Y ordinate.
    expect(Number(texts[0].contents)).toBeCloseTo(10)
  })
})
