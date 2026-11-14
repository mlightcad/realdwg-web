import { AcGePoint3d, AcGeVector3d } from '@mlightcad/geometry-engine'
import {
  AcGiMTextAttachmentPoint,
  DEFAULT_ACGI_CONTEXT
} from '@mlightcad/graphic-interface'

import { acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database'
import {
  AcDbMLeader,
  AcDbMLeaderDirectionType,
  AcDbMLeaderLineType
} from '../src/entity'

const createDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

const standardStyle = (db: AcDbDatabase) => {
  // The default style is created lazily when the first MLEADER is appended.
  db.tables.blockTable.modelSpace.appendEntity(new AcDbMLeader())
  return db.objects.mleaderStyle.getAt(db.cmleaderstyle || 'Standard')!
}

/**
 * Builds a multileader the way the MLEADER command does: arrowhead at the
 * origin, landing from (12, 10) to (20, 10) pointing +X, text attached.
 */
const createMLeader = (db: AcDbDatabase, direction: 1 | -1 = 1) => {
  const mleader = new AcDbMLeader()
  db.tables.blockTable.modelSpace.appendEntity(mleader)
  mleader.applyMLeaderStyle(standardStyle(db))
  mleader.addLeader({
    lastLeaderLinePoint: { x: 12 * direction, y: 10, z: 0 },
    lastLeaderLinePointSet: true,
    doglegVector: { x: direction, y: 0, z: 0 },
    doglegVectorSet: true,
    doglegLength: 8,
    directionType:
      direction > 0
        ? AcDbMLeaderDirectionType.Left
        : AcDbMLeaderDirectionType.Right,
    leaderLines: [{ vertices: [{ x: 0, y: 0, z: 0 }] }]
  })
  mleader.contents = 'ABCDEFGH'
  mleader.textLocation = { x: 20 * direction, y: 10, z: 0 }
  mleader.attachContentToLanding()
  return mleader
}

const gripIndex = (
  mleader: AcDbMLeader,
  point: { x: number; y: number }
): number =>
  mleader
    .subGetGripPoints()
    .findIndex(p => Math.hypot(p.x - point.x, p.y - point.y) < 1e-9)

const createRenderer = () => ({
  context: DEFAULT_ACGI_CONTEXT,
  subEntityTraits: {
    color: undefined,
    lineType: undefined,
    lineWeight: undefined
  },
  lines: jest.fn((points: AcGePoint3d[]) => ({ kind: 'lines', points })),
  group: jest.fn((entities: unknown[]) => ({ kind: 'group', entities })),
  mtext: jest.fn(() => ({ kind: 'mtext' })),
  area: jest.fn(() => ({ kind: 'area' }))
})

describe('AcDbMLeader style application', () => {
  it('takes text height, sizes and landing from the style scaled by its overall scale', () => {
    const db = createDb()
    const style = standardStyle(db)
    style.textHeight = 4
    style.arrowSize = 3
    style.doglegLength = 6
    style.landingGap = 1.5
    style.scale = 2

    const mleader = new AcDbMLeader()
    db.tables.blockTable.modelSpace.appendEntity(mleader)
    mleader.applyMLeaderStyle(style)

    expect(mleader.mleaderStyleId).toBe(style.objectId)
    expect(mleader.textHeight).toBe(8)
    expect(mleader.arrowheadSize).toBe(6)
    expect(mleader.doglegLength).toBe(12)
    expect(mleader.landingGap).toBe(3)
    expect(mleader.textStyleId).toBe(style.textStyleId)
    expect(mleader.resolveAnnotativePresentation().textHeight).toBe(8)
  })

  it('scales annotative styles by the annotation scale instead', () => {
    const db = createDb()
    const style = standardStyle(db)
    style.textHeight = 2.5
    style.scale = 7
    style.annotative = true

    const mleader = new AcDbMLeader()
    db.tables.blockTable.modelSpace.appendEntity(mleader)
    mleader.applyMLeaderStyle(style, 50)

    expect(mleader.textHeight).toBe(125)
    expect(mleader.annotative).toBe(true)
  })
})

describe('AcDbMLeader content attachment', () => {
  it('attaches text by its left side past the landing gap for right-pointing landings', () => {
    const db = createDb()
    const mleader = createMLeader(db, 1)
    const h = mleader.textHeight
    const gap = mleader.landingGap!

    expect(mleader.contentBasePosition).toMatchObject({ x: 20, y: 10 })
    // Standard style: "Middle of top line" left attachment.
    expect(mleader.textAttachmentPoint).toBe(AcGiMTextAttachmentPoint.TopLeft)
    expect(mleader.textLocation!.x).toBeCloseTo(20 + gap)
    expect(mleader.textLocation!.y).toBeCloseTo(10 + h / 2)
  })

  it('attaches text by its right side for left-pointing landings', () => {
    const db = createDb()
    const mleader = createMLeader(db, -1)
    const gap = mleader.landingGap!

    expect(mleader.textAttachmentPoint).toBe(AcGiMTextAttachmentPoint.TopRight)
    expect(mleader.textLocation!.x).toBeCloseTo(-20 - gap)
  })
})

describe('AcDbMLeader grips', () => {
  it('exposes one grip per arrowhead, landing, landing end and content', () => {
    const db = createDb()
    const mleader = createMLeader(db)
    const grips = mleader.subGetGripPoints()

    expect(grips).toHaveLength(4)
    for (let i = 0; i < grips.length; i++) {
      for (let j = i + 1; j < grips.length; j++) {
        expect(grips[i].distanceTo(grips[j])).toBeGreaterThan(1e-6)
      }
    }
  })

  it('stretches only the arrowhead when its grip is dragged', () => {
    const db = createDb()
    const mleader = createMLeader(db)
    const text = new AcGePoint3d(mleader.textLocation!)

    mleader.subMoveGripPointsAt([gripIndex(mleader, { x: 0, y: 0 })], {
      x: -5,
      y: -5,
      z: 0
    })

    expect(mleader.leaders[0].leaderLines[0].vertices[0]).toMatchObject({
      x: -5,
      y: -5
    })
    expect(mleader.leaders[0].lastLeaderLinePoint).toMatchObject({
      x: 12,
      y: 10
    })
    expect(mleader.textLocation).toMatchObject(text)
  })

  it('moves landing and text together from the landing grip; arrowhead stays', () => {
    const db = createDb()
    const mleader = createMLeader(db)
    const text = new AcGePoint3d(mleader.textLocation!)

    mleader.subMoveGripPointsAt([gripIndex(mleader, { x: 12, y: 10 })], {
      x: 3,
      y: 4,
      z: 0
    })

    expect(mleader.leaders[0].leaderLines[0].vertices[0]).toMatchObject({
      x: 0,
      y: 0
    })
    expect(mleader.leaders[0].lastLeaderLinePoint).toMatchObject({
      x: 15,
      y: 14
    })
    expect(mleader.contentBasePosition).toMatchObject({ x: 23, y: 14 })
    expect(mleader.textLocation!.x).toBeCloseTo(text.x + 3)
    expect(mleader.textLocation!.y).toBeCloseTo(text.y + 4)
  })

  it('moves text together with its landing from the content grip', () => {
    const db = createDb()
    const mleader = createMLeader(db)
    const text = new AcGePoint3d(mleader.textLocation!)

    mleader.subMoveGripPointsAt([gripIndex(mleader, text)], {
      x: 10,
      y: -2,
      z: 0
    })

    expect(mleader.textLocation!.x).toBeCloseTo(text.x + 10)
    expect(mleader.leaders[0].lastLeaderLinePoint).toMatchObject({
      x: 22,
      y: 8
    })
    expect(mleader.leaders[0].leaderLines[0].vertices[0]).toMatchObject({
      x: 0,
      y: 0
    })
  })

  it('lengthens the landing from its end grip and keeps the text attached', () => {
    const db = createDb()
    const mleader = createMLeader(db)
    const text = new AcGePoint3d(mleader.textLocation!)

    mleader.subMoveGripPointsAt([gripIndex(mleader, { x: 20, y: 10 })], {
      x: 5,
      y: 3,
      z: 0
    })

    expect(mleader.leaders[0].doglegLength).toBeCloseTo(13)
    expect(mleader.leaders[0].lastLeaderLinePoint).toMatchObject({
      x: 12,
      y: 10
    })
    expect(mleader.contentBasePosition).toMatchObject({ x: 25, y: 10 })
    expect(mleader.textLocation!.x).toBeCloseTo(text.x + 5)
    expect(mleader.textLocation!.y).toBeCloseTo(text.y)
  })

  it('flips the landing to the other side when the text crosses the leader', () => {
    const db = createDb()
    const mleader = createMLeader(db)
    const text = new AcGePoint3d(mleader.textLocation!)
    const gap = mleader.landingGap!

    // Drag the text far to the left of the arrowhead.
    mleader.subMoveGripPointsAt([gripIndex(mleader, text)], {
      x: -60,
      y: 0,
      z: 0
    })

    const leader = mleader.leaders[0]
    expect(mleader.textLocation!.x).toBeCloseTo(text.x - 60)
    expect(mleader.textAttachmentPoint).toBe(AcGiMTextAttachmentPoint.TopRight)
    expect(leader.doglegVector!.x).toBeCloseTo(-1)
    expect(mleader.contentBasePosition!.x).toBeCloseTo(text.x - 60 + gap)
    expect(leader.lastLeaderLinePoint!.x).toBeCloseTo(text.x - 60 + gap + 8)
    expect(leader.lastLeaderLinePoint!.y).toBeCloseTo(10)
    expect(leader.directionType).toBe(AcDbMLeaderDirectionType.Right)
  })
})

describe('AcDbMLeader addLeaderLineAtPoint', () => {
  it('joins a new leader on the same side to the existing landing', () => {
    const db = createDb()
    const mleader = createMLeader(db)

    const result = mleader.addLeaderLineAtPoint({ x: 2, y: 20, z: 0 })

    expect(result).toEqual({ leaderIndex: 0, leaderLineIndex: 1 })
    expect(mleader.numberOfLeaders).toBe(1)
    expect(mleader.leaders[0].leaderLines[1].vertices).toHaveLength(1)
  })

  it('creates a landing past the far side of the text for an opposite leader', () => {
    const db = createDb()
    const mleader = createMLeader(db)
    const textRight = Math.max(...mleader.subGetGripPoints().map(p => p.x))

    const result = mleader.addLeaderLineAtPoint({ x: 120, y: -10, z: 0 })

    expect(result.leaderIndex).toBe(1)
    const leader = mleader.leaders[1]
    expect(leader.doglegVector!.x).toBeCloseTo(-1)
    expect(leader.directionType).toBe(AcDbMLeaderDirectionType.Right)
    expect(leader.lastLeaderLinePoint!.y).toBeCloseTo(10)
    // The new landing must sit right of the whole text, not on it.
    const end = leader.lastLeaderLinePoint!.x - leader.doglegLength!
    expect(end).toBeGreaterThan(textRight + mleader.textHeight)
    // The original landing keeps its own end.
    expect(mleader.contentBasePosition).toMatchObject({ x: 20, y: 10 })
    const renderer = createRenderer()
    mleader.subWorldDraw(renderer as never)
    const doglegs = renderer.lines.mock.calls
      .map(([points]) => points)
      .filter(points => points.length === 2 && points[0].y === 10)
    expect(doglegs).toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ x: 12 }), expect.objectContaining({ x: 20 })]
      ])
    )
  })
})

describe('AcDbMLeader leader line drawing', () => {
  it('connects multi-vertex leader lines to their landing', () => {
    const db = createDb()
    const mleader = createMLeader(db)
    mleader.setLeaderLineVertices(0, 0, [
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 8, z: 0 }
    ])
    const renderer = createRenderer()
    mleader.subWorldDraw(renderer as never)
    const leaderPath = renderer.lines.mock.calls
      .map(([points]) => points)
      .find(points => points.length === 3)
    expect(leaderPath?.[2]).toMatchObject({ x: 12, y: 10 })
  })

  it('draws spline leaders as a smooth curve through their vertices', () => {
    const db = createDb()
    const mleader = createMLeader(db)
    mleader.leaderLineType = AcDbMLeaderLineType.SplineLeader
    mleader.propertyOverrideFlag = 1
    mleader.setLeaderLineVertices(0, 0, [
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 8, z: 0 }
    ])
    const renderer = createRenderer()
    mleader.subWorldDraw(renderer as never)
    const longest = Math.max(
      ...renderer.lines.mock.calls.map(([points]) => points.length)
    )
    expect(longest).toBeGreaterThan(10)
  })

  it('keeps grip directions as unit vectors after edits', () => {
    const db = createDb()
    const mleader = createMLeader(db)
    mleader.subMoveGripPointsAt([gripIndex(mleader, { x: 12, y: 10 })], {
      x: 1,
      y: 1,
      z: 0
    })
    expect(
      new AcGeVector3d(mleader.leaders[0].doglegVector!).length()
    ).toBeCloseTo(1)
  })
})
