import { AcGeMatrix3d, AcGePoint3d } from '@mlightcad/geometry-engine'
import { acdbHostApplicationServices } from '../src/base'
import { AcDbDimStyleTableRecord, AcDbDatabase } from '../src/database'
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
    expect(db.tables.blockTable.getAt(CLOSED_FILLED_ARROW_BLOCK)).toBeTruthy()

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

describe('AcDbDimBlockBuilder / radius and diameter user text', () => {
  const createStyledDb = () => {
    const db = createDb()
    db.tables.dimStyleTable.add(
      new AcDbDimStyleTableRecord({
        name: 'UserText',
        dimasz: 3,
        dimscale: 4,
        dimtxt: 2.5,
        dimgap: 0.5,
        dimtad: 1,
        dimtih: 1,
        dimtoh: 1,
        dimtofl: 1
      })
    )
    return db
  }

  const linesOf = (block: Iterable<unknown>) =>
    [...block].filter((e): e is AcDbLine => e instanceof AcDbLine)

  const createDiameter = () => {
    const db = createStyledDb()
    // Taken from a DWG where AutoCAD draws one arrowhead on the far chord
    // point and a landing under text placed inside the circle.
    const dim = new AcDbDiametricDimension(
      new AcGePoint3d(6223.58, 751.97, 0),
      new AcGePoint3d(6083.82, 464.1, 0),
      0,
      null,
      'UserText'
    )
    dim.textPosition = new AcGePoint3d(6137.39, 509.55, 0)
    dim.isUsingDefaultTextPosition = false
    db.tables.blockTable.modelSpace.appendEntity(dim)
    return { db, dim }
  }

  it('diametric keeps user text and draws arrow, line to text height and landing', () => {
    const { dim } = createDiameter()
    const block = [...dim.createDimBlock('*DU1').newIterator()]

    const lines = linesOf(block)
    expect(lines).toHaveLength(2)
    const [leader, landing] = lines
    expect(leader.startPoint.x).toBeCloseTo(6083.82, 2)
    expect(leader.startPoint.y).toBeCloseTo(464.1, 2)
    expect(leader.endPoint.x).toBeCloseTo(6105.91, 1)
    expect(leader.endPoint.y).toBeCloseTo(509.55, 2)
    expect(landing.startPoint.x).toBeCloseTo(leader.endPoint.x, 6)
    expect(landing.endPoint.x - landing.startPoint.x).toBeCloseTo(12, 6)
    expect(landing.endPoint.y).toBeCloseTo(509.55, 6)

    const arrows = block.filter(e => e instanceof AcDbBlockReference)
    expect(arrows).toHaveLength(1)
    expect(arrows[0].position.x).toBeCloseTo(6083.82, 2)

    const text = block.find(e => e instanceof AcDbMText) as AcDbMText
    expect(text.location.x).toBeCloseTo(6137.39, 2)
    expect(text.location.y).toBeCloseTo(509.55, 2)
    expect(dim.textPosition.x).toBeCloseTo(6137.39, 2)
  })

  it('diametric with user text keeps its layout after a uniform scale', () => {
    const { db, dim } = createDiameter()
    const base = new AcGePoint3d(6000, 600, 0)
    dim.transformBy(
      new AcGeMatrix3d()
        .makeTranslation(base.x, base.y, 0)
        .multiply(new AcGeMatrix3d().makeScale(2, 2, 2))
        .multiply(new AcGeMatrix3d().makeTranslation(-base.x, -base.y, 0))
    )
    dim.recomputeDimBlock()

    expect(dim.measurement).toBeCloseTo(640, 1)
    const block = [
      ...db.tables.blockTable.getAt(dim.dimBlockId!)!.newIterator()
    ]
    const [leader, landing] = linesOf(block)
    expect(leader.startPoint.x).toBeCloseTo(6167.64, 2)
    expect(leader.endPoint.y).toBeCloseTo(419.1, 2)
    // Landing keeps the dimension-style size; only the geometry is scaled.
    expect(landing.endPoint.x - landing.startPoint.x).toBeCloseTo(12, 6)
    const text = block.find(e => e instanceof AcDbMText) as AcDbMText
    expect(text.location.x).toBeCloseTo(6274.78, 2)
    expect(text.contents).toContain('640')
  })

  it('radial keeps user text inside the circle with a landing', () => {
    const db = createStyledDb()
    const dim = new AcDbRadialDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(6, 8, 0),
      0,
      null,
      'UserText'
    )
    dim.textPosition = new AcGePoint3d(2, 3, 0)
    dim.isUsingDefaultTextPosition = false
    db.tables.blockTable.modelSpace.appendEntity(dim)

    const block = [...dim.createDimBlock('*DU2').newIterator()]
    const [leader, landing] = linesOf(block)
    expect(leader.startPoint).toMatchObject({ x: 6, y: 8 })
    expect(leader.endPoint.x).toBeCloseTo(2.25, 6)
    expect(leader.endPoint.y).toBeCloseTo(3, 6)
    expect(landing.endPoint.x).toBeCloseTo(2.25 - 12, 6)
    const text = block.find(e => e instanceof AcDbMText) as AcDbMText
    expect(text.location).toMatchObject({ x: 2, y: 3 })
  })
})
