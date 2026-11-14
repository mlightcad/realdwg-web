import {
  AcGeMatrix3d,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase, AcDbDimStyleTableRecord } from '../src/database'
import {
  AcDb3PointAngularDimension,
  AcDbAlignedDimension,
  AcDbArcDimension,
  AcDbDiametricDimension,
  AcDbDimension,
  AcDbLine,
  AcDbMText,
  AcDbOrdinateDimension,
  AcDbRadialDimension,
  AcDbRotatedDimension
} from '../src/entity'

const createDb = (dimtmove = 0) => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  db.tables.dimStyleTable.add(
    new AcDbDimStyleTableRecord({
      name: 'GripTest',
      dimtxt: 1,
      dimasz: 0.5,
      dimgap: 0.25,
      dimexo: 0,
      dimexe: 0,
      dimtad: 0,
      dimtmove
    })
  )
  return db
}

const addDim = <T extends AcDbDimension>(db: AcDbDatabase, dim: T): T => {
  dim.dimensionStyleName = 'GripTest'
  db.tables.blockTable.modelSpace.appendEntity(dim)
  dim.recomputeDimBlock()
  return dim
}

const v = (x: number, y: number) => new AcGeVector3d(x, y, 0)

const blockText = (db: AcDbDatabase, dim: AcDbDimension) => {
  const btr = db.tables.blockTable.getAt(dim.dimBlockId!)!
  return [...btr.newIterator()].find(
    (e): e is AcDbMText => e instanceof AcDbMText
  )
}

const blockLines = (db: AcDbDatabase, dim: AcDbDimension) => {
  const btr = db.tables.blockTable.getAt(dim.dimBlockId!)!
  return [...btr.newIterator()].filter(
    (e): e is AcDbLine => e instanceof AcDbLine
  )
}

describe('AcDbDimension.recomputeDimBlock', () => {
  it('builds a new *D block, keeps the old one, and refreshes measurement', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDbAlignedDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(10, 0, 0),
        new AcGePoint3d(10, 5, 0)
      )
    )
    const first = dim.dimBlockId!
    expect(first).toMatch(/^\*D\d+$/)
    expect(dim.measurement).toBeCloseTo(10)

    dim.subMoveGripPointsAt([1], v(5, 0))
    const second = dim.recomputeDimBlock()

    expect(second).not.toBe(first)
    expect(dim.dimBlockId).toBe(second)
    expect(db.tables.blockTable.getAt(first)).toBeDefined()
    expect(dim.measurement).toBeCloseTo(15)
    expect(blockText(db, dim)?.contents).toContain('15')
  })

  it('replaces an existing block when a name is given', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDbAlignedDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(10, 0, 0),
        new AcGePoint3d(10, 5, 0)
      )
    )
    dim.recomputeDimBlock('*UDIM')
    const firstBlock = db.tables.blockTable.getAt('*UDIM')
    dim.recomputeDimBlock('*UDIM')
    expect(db.tables.blockTable.getAt('*UDIM')).not.toBe(firstBlock)
    expect(dim.dimBlockId).toBe('*UDIM')
  })

  it('resets block offset accumulated by transformBy', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDbAlignedDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(10, 0, 0),
        new AcGePoint3d(10, 5, 0)
      )
    )
    dim.transformBy(new AcGeMatrix3d().makeTranslation(3, 4, 0))
    expect(dim.dimBlockPosition).toMatchObject({ x: 3, y: 4 })
    dim.recomputeDimBlock()
    expect(dim.dimBlockPosition).toMatchObject({ x: 0, y: 0, z: 0 })
    const lines = blockLines(db, dim)
    expect(
      lines.some(
        l =>
          Math.abs(l.startPoint.y - 9) < 1e-9 &&
          Math.abs(l.endPoint.y - 9) < 1e-9
      )
    ).toBe(true)
  })
})

describe('Rotated (linear) dimension grips', () => {
  const create = (db: AcDbDatabase) => {
    const dim = new AcDbRotatedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 3, 0),
      new AcGePoint3d(10, 6, 0)
    )
    dim.rotation = 0
    return addDim(db, dim)
  }

  it('exposes extension origins, dim line ends and text', () => {
    const dim = create(createDb())
    const grips = dim.subGetGripPoints()
    expect(grips).toHaveLength(5)
    expect(grips[2]).toMatchObject({ x: 0, y: 6 })
    expect(grips[3]).toMatchObject({ x: 10, y: 6 })
    expect(dim.measurement).toBeCloseTo(10)
  })

  it('keeps a horizontal dimension horizontal when an origin moves', () => {
    const dim = create(createDb())
    dim.subMoveGripPointsAt([1], v(5, 7))
    expect(dim.rotation).toBe(0)
    expect(dim.xLine2Point).toMatchObject({ x: 15, y: 10 })
    expect(dim.dimLinePoint).toMatchObject({ x: 15, y: 6 })
    dim.recomputeDimBlock()
    expect(dim.measurement).toBeCloseTo(15)
  })

  it('moves the dimension line only along its normal', () => {
    const dim = create(createDb())
    dim.subMoveGripPointsAt([2], v(4, 2))
    expect(dim.dimLinePoint).toMatchObject({ x: 10, y: 8 })
    expect(dim.xLine1Point).toMatchObject({ x: 0, y: 0 })
  })

  it('applies the dim-line move once when both end grips are stretched', () => {
    const dim = create(createDb())
    dim.subMoveGripPointsAt([2, 3], v(0, 2))
    expect(dim.dimLinePoint.y).toBeCloseTo(8)
  })

  it('DIMTMOVE 0: text drags the dimension line with it', () => {
    const db = createDb(0)
    const dim = create(db)
    const home = dim.textPosition.clone()
    dim.subMoveGripPointsAt([4], v(2, 3))
    expect(dim.dimLinePoint.y).toBeCloseTo(9)
    expect(dim.isUsingDefaultTextPosition).toBe(false)
    dim.recomputeDimBlock()
    expect(dim.textPosition).toMatchObject({ x: home.x + 2, y: home.y + 3 })
    expect(blockText(db, dim)?.location).toMatchObject({
      x: home.x + 2,
      y: home.y + 3
    })
  })

  it('DIMTMOVE 0: text beyond the extension lines extends the dim line', () => {
    const db = createDb(0)
    const dim = create(db)
    dim.subMoveGripPointsAt([4], v(20, 0))
    dim.recomputeDimBlock()
    const lines = blockLines(db, dim)
    const maxX = Math.max(
      ...lines.map(l => Math.max(l.startPoint.x, l.endPoint.x))
    )
    expect(maxX).toBeCloseTo(25)
  })

  it('DIMTMOVE 1: text moves alone and gets a leader', () => {
    const db = createDb(1)
    const dim = create(db)
    const before = blockLines(db, dim).length
    dim.subMoveGripPointsAt([4], v(0, 5))
    expect(dim.dimLinePoint).toMatchObject({ x: 10, y: 6 })
    dim.recomputeDimBlock()
    expect(blockLines(db, dim).length).toBe(before + 1)
  })

  it('DIMTMOVE 2: text moves alone without a leader', () => {
    const db = createDb(2)
    const dim = create(db)
    const before = blockLines(db, dim).length
    dim.subMoveGripPointsAt([4], v(0, 5))
    expect(dim.dimLinePoint).toMatchObject({ x: 10, y: 6 })
    dim.recomputeDimBlock()
    expect(blockLines(db, dim).length).toBe(before)
  })
})

describe('Aligned dimension grips', () => {
  it('follows the origins and keeps the dimension line offset', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDbAlignedDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(10, 0, 0),
        new AcGePoint3d(10, 2, 0)
      )
    )
    dim.subMoveGripPointsAt([1], v(-10, 10))
    expect(dim.rotation).toBeCloseTo(Math.PI / 2)
    // Offset 2 to the left of the new (vertical) chord.
    expect(dim.dimLinePoint.x).toBeCloseTo(-2)
    expect(dim.dimLinePoint.y).toBeCloseTo(10)
    dim.recomputeDimBlock()
    expect(dim.measurement).toBeCloseTo(10)
  })
})

describe('Angular and arc length dimension grips', () => {
  it('angular: definition grips move freely and update the angle', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDb3PointAngularDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(10, 0, 0),
        new AcGePoint3d(0, 10, 0),
        new AcGePoint3d(5, 5, 0)
      )
    )
    expect(dim.subGetGripPoints()).toHaveLength(5)
    expect(dim.measurement).toBeCloseTo(Math.PI / 2)
    dim.subMoveGripPointsAt([2], v(-10, -10))
    dim.recomputeDimBlock()
    expect(dim.measurement).toBeCloseTo(Math.PI)
  })

  it('angular: DIMTMOVE 0 text moves the arc radius', () => {
    const db = createDb(0)
    const dim = addDim(
      db,
      new AcDb3PointAngularDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(10, 0, 0),
        new AcGePoint3d(0, 10, 0),
        new AcGePoint3d(5, 5, 0)
      )
    )
    const r0 = dim.arcPoint.distanceTo(dim.centerPoint)
    const dir = dim.textPosition.clone().normalize()
    dim.subMoveGripPointsAt([4], dir.multiplyScalar(3))
    expect(dim.arcPoint.distanceTo(dim.centerPoint)).toBeCloseTo(r0 + 3)
  })

  it('arc length: extension origins stay on the arc', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDbArcDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(10, 0, 0),
        new AcGePoint3d(0, 10, 0),
        new AcGePoint3d(9, 9, 0)
      )
    )
    dim.subMoveGripPointsAt([2], v(-20, -5))
    expect(dim.xLine2Point.distanceTo(dim.centerPoint)).toBeCloseTo(10)
    dim.recomputeDimBlock()
    expect(dim.measurement).toBeGreaterThan(10 * (Math.PI / 2))
  })
})

describe('Radius, diameter and ordinate grips', () => {
  it('radius: chord grip slides on the circle, text swings the leader', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDbRadialDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(5, 0, 0),
        0
      )
    )
    expect(dim.subGetGripPoints()).toHaveLength(3)
    dim.subMoveGripPointsAt([1], v(-5, 10))
    expect(dim.chordPoint.x).toBeCloseTo(0)
    expect(dim.chordPoint.y).toBeCloseTo(5)

    const target = new AcGePoint3d(-20, 0, 0)
    dim.subMoveGripPointsAt(
      [2],
      new AcGeVector3d().subVectors(target, dim.textPosition)
    )
    expect(dim.chordPoint.x).toBeCloseTo(-5)
    expect(dim.leaderLength).toBeGreaterThan(0)
    dim.recomputeDimBlock()
    expect(dim.measurement).toBeCloseTo(5)
  })

  it('radius: center grip changes the measured radius', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDbRadialDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(5, 0, 0),
        0
      )
    )
    dim.subMoveGripPointsAt([0], v(-3, 0))
    dim.recomputeDimBlock()
    expect(dim.measurement).toBeCloseTo(8)
  })

  it('diameter: chord grips keep the diameter and stay opposite', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDbDiametricDimension(
        new AcGePoint3d(5, 0, 0),
        new AcGePoint3d(-5, 0, 0)
      )
    )
    dim.subMoveGripPointsAt([0], v(-5, 5))
    expect(dim.chordPoint.x).toBeCloseTo(0)
    expect(dim.chordPoint.y).toBeCloseTo(5)
    expect(dim.farChordPoint.x).toBeCloseTo(0)
    expect(dim.farChordPoint.y).toBeCloseTo(-5)
    dim.recomputeDimBlock()
    expect(dim.measurement).toBeCloseTo(10)
  })

  it('diameter: stretching both chord grips translates the diameter', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDbDiametricDimension(
        new AcGePoint3d(5, 0, 0),
        new AcGePoint3d(-5, 0, 0)
      )
    )
    dim.subMoveGripPointsAt([0, 1], v(2, 3))
    expect(dim.chordPoint).toMatchObject({ x: 7, y: 3 })
    expect(dim.farChordPoint).toMatchObject({ x: -3, y: 3 })
    expect(dim.chordPoint.distanceTo(dim.farChordPoint)).toBeCloseTo(10)
  })

  it('radius: stretching center and chord translates the dimension', () => {
    const db = createDb()
    const dim = addDim(
      db,
      new AcDbRadialDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(5, 0, 0),
        0
      )
    )
    dim.subMoveGripPointsAt([0, 1], v(2, 3))
    expect(dim.center).toMatchObject({ x: 2, y: 3 })
    expect(dim.chordPoint).toMatchObject({ x: 7, y: 3 })
    expect(dim.center.distanceTo(dim.chordPoint)).toBeCloseTo(5)
  })

  it('ordinate: feature grip remeasures, text grip moves the leader end', () => {
    const db = createDb()
    const dim = new AcDbOrdinateDimension(
      new AcGePoint3d(4, 2, 0),
      new AcGePoint3d(4, 8, 0)
    )
    dim.useXAxis = true
    addDim(db, dim)
    expect(dim.measurement).toBeCloseTo(4)
    const textBefore = dim.textPosition.clone()
    dim.subMoveGripPointsAt([0], v(3, 0))
    dim.subMoveGripPointsAt([2], v(1, 1))
    expect(dim.leaderEndPoint).toMatchObject({ x: 5, y: 9 })
    expect(dim.textPosition).toMatchObject({
      x: textBefore.x + 1,
      y: textBefore.y + 1
    })
    dim.recomputeDimBlock()
    expect(dim.measurement).toBeCloseTo(7)
  })
})
