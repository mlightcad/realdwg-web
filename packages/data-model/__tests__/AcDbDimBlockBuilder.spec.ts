import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { acdbHostApplicationServices } from '../src/base'
import {
  AcDbDimStyleTableRecord,
  AcDbDatabase
} from '../src/database'
import {
  AcDb3PointAngularDimension,
  AcDbAlignedDimension,
  AcDbDiametricDimension,
  AcDbMText,
  AcDbRadialDimension,
  AcDbRotatedDimension
} from '../src/entity'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbLine } from '../src/entity/AcDbLine'
import {
  CLOSED_FILLED_ARROW_BLOCK,
  acdbFormatLinearMeasurement
} from '../src/entity/dimension'

const createDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

describe('AcDbDimBlockBuilder / createDimBlock', () => {
  it('formats linear measurement from dimstyle', () => {
    const style = new AcDbDimStyleTableRecord({
      name: 'Test',
      dimdec: 2,
      dimlfac: 1,
      dimpost: ' mm'
    })
    expect(acdbFormatLinearMeasurement(12.3456, style)).toBe('12.35 mm')
  })

  it('aligned createDimBlock uses dimtxt*dimscale for text height and standard arrow', () => {
    const db = createDb()
    const style = new AcDbDimStyleTableRecord({
      name: 'DimHi',
      dimtxt: 3,
      dimscale: 2,
      dimasz: 1.5,
      dimexo: 1,
      dimexe: 0.5,
      dimdec: 3,
      dimblk: ''
    })
    db.tables.dimStyleTable.add(style)

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(100, 0, 0),
      new AcGePoint3d(50, 20, 0)
    )
    dim.dimensionStyleName = 'DimHi'
    db.tables.blockTable.modelSpace.appendEntity(dim)

    const block = dim.createDimBlock('*D1')
    db.tables.blockTable.add(block)
    dim.dimBlockId = '*D1'

    const entities = [...block.newIterator()]
    const lines = entities.filter(e => e instanceof AcDbLine)
    const inserts = entities.filter(e => e instanceof AcDbBlockReference)
    const texts = entities.filter(e => e instanceof AcDbMText)

    expect(lines.length).toBeGreaterThanOrEqual(3)
    expect(inserts.length).toBe(2)
    expect(inserts[0].position).toBeTruthy()
    expect(
      db.tables.blockTable.getAt(CLOSED_FILLED_ARROW_BLOCK)
    ).toBeTruthy()

    expect(texts).toHaveLength(1)
    expect(texts[0].height).toBeCloseTo(6, 5) // dimtxt * dimscale
    expect(texts[0].contents).toMatch(/100/)
  })

  it('annotative style scale replaces dimscale for text height', () => {
    const db = createDb()
    const style = new AcDbDimStyleTableRecord({
      name: '1-1',
      dimtxt: 3,
      dimscale: 1,
      dimasz: 3,
      dimdec: 0
    })
    db.tables.dimStyleTable.add(style)
    db.setDimStyleAnnotationScale('1-1', 16)

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(100, 0, 0),
      new AcGePoint3d(50, 20, 0)
    )
    dim.dimensionStyleName = '1-1'
    db.tables.blockTable.modelSpace.appendEntity(dim)

    const block = dim.createDimBlock('*Danno')
    const texts = [...block.newIterator()].filter(e => e instanceof AcDbMText)
    expect(texts).toHaveLength(1)
    expect(texts[0].height).toBeCloseTo(48, 5)
  })

  it('rotated createDimBlock inherits aligned builder', () => {
    const db = createDb()
    const dim = new AcDbRotatedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(50, 0, 0),
      new AcGePoint3d(25, 10, 0)
    )
    dim.rotation = 0
    db.tables.blockTable.modelSpace.appendEntity(dim)
    const block = dim.createDimBlock('*D2')
    expect([...block.newIterator()].length).toBeGreaterThan(0)
  })

  it('radial createDimBlock produces line, arrow and R-prefixed text', () => {
    const db = createDb()
    const dim = new AcDbRadialDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(25, 0, 0),
      5
    )
    db.tables.blockTable.modelSpace.appendEntity(dim)
    const block = dim.createDimBlock('*D3')
    const texts = [...block.newIterator()].filter(e => e instanceof AcDbMText)
    expect(texts.length).toBe(1)
    expect(texts[0].contents.startsWith('R')).toBe(true)
  })

  it('diametric createDimBlock produces diameter symbol text', () => {
    const db = createDb()
    const dim = new AcDbDiametricDimension(
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(-10, 0, 0),
      0
    )
    db.tables.blockTable.modelSpace.appendEntity(dim)
    const block = dim.createDimBlock('*D4')
    const texts = [...block.newIterator()].filter(e => e instanceof AcDbMText)
    expect(texts[0].contents.includes('%%c')).toBe(true)
  })

  it('angular createDimBlock produces arc and degree text', () => {
    const db = createDb()
    const dim = new AcDb3PointAngularDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(0, 10, 0),
      new AcGePoint3d(7, 7, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(dim)
    const block = dim.createDimBlock('*D5')
    const entities = [...block.newIterator()]
    expect(entities.length).toBeGreaterThan(2)
    const texts = entities.filter(e => e instanceof AcDbMText)
    expect(texts[0].contents.includes('%%d')).toBe(true)
    // Minor arc (~90°) between +X and +Y with arc point in Q1
    expect(texts[0].contents).toMatch(/^90/)
  })

  it('angular annotation matches major-arc sweep selected by arcPoint', () => {
    const db = createDb()
    // Rays along +X and +Y; arc point in Q3 selects the 270° major sweep.
    const dim = new AcDb3PointAngularDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(0, 10, 0),
      new AcGePoint3d(-7, -7, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(dim)
    const block = dim.createDimBlock('*D5b')
    const texts = [...block.newIterator()].filter(e => e instanceof AcDbMText)
    expect(texts[0].contents).toMatch(/^270/)
  })

  it('aligned arrows stay at true endpoints when dimdle extends the line', () => {
    const db = createDb()
    const style = new AcDbDimStyleTableRecord({
      name: 'DimDle',
      dimdle: 5,
      dimasz: 2.5,
      dimtxt: 2.5,
      dimexo: 0,
      dimexe: 0
    })
    db.tables.dimStyleTable.add(style)

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(40, 0, 0),
      new AcGePoint3d(20, 10, 0)
    )
    dim.dimensionStyleName = 'DimDle'
    db.tables.blockTable.modelSpace.appendEntity(dim)
    const block = dim.createDimBlock('*D5c')
    const inserts = [...block.newIterator()].filter(
      e => e instanceof AcDbBlockReference
    )
    expect(inserts).toHaveLength(2)
    const xs = inserts.map(i => i.position.x).sort((a, b) => a - b)
    // Extension lines meet dim line near x=0 and x=40; arrows must not ride
    // the DIMDLE-extended ends (±5 past those points).
    expect(xs[0]).toBeCloseTo(0, 5)
    expect(xs[1]).toBeCloseTo(40, 5)
  })

  it('extension offsets respond to dimexo/dimexe', () => {
    const db = createDb()
    const style = new AcDbDimStyleTableRecord({
      name: 'Offsets',
      dimexo: 2,
      dimexe: 3,
      dimtxt: 2.5,
      dimasz: 2.5
    })
    db.tables.dimStyleTable.add(style)

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(40, 0, 0),
      new AcGePoint3d(20, 15, 0)
    )
    dim.dimensionStyleName = 'Offsets'
    db.tables.blockTable.modelSpace.appendEntity(dim)
    const block = dim.createDimBlock('*D6')
    const lines = [...block.newIterator()].filter(e => e instanceof AcDbLine)
    // Extension lines should not start exactly at definition points due to dimexo
    const extLike = lines.filter(l => {
      const dy = Math.abs(l.startPoint.y - l.endPoint.y)
      return dy > 5
    })
    expect(extLike.length).toBeGreaterThanOrEqual(1)
    for (const line of extLike) {
      const nearOrigin =
        Math.hypot(line.startPoint.x, line.startPoint.y) < 0.01 ||
        Math.hypot(line.endPoint.x - 40, line.endPoint.y) < 0.01
      // After dimexo offset, neither end should sit exactly on (0,0)/(40,0)
      // while still near the vertical through those points.
      expect(nearOrigin).toBe(false)
    }
  })
})
