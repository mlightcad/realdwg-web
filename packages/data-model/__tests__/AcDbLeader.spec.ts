import { AcCmColor } from '@mlightcad/common'
import {
  AcGeMatrix3d,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'
import {
  AcGiMTextAttachmentPoint,
  DEFAULT_ACGI_CONTEXT
} from '@mlightcad/graphic-interface'

import {
  AcDbDxfCode,
  AcDbDxfFiler,
  acdbHostApplicationServices,
  AcDbResultBuffer
} from '../src/base'
import {
  AcDbBlockTableRecord,
  AcDbDatabase,
  AcDbDimStyleTableRecord
} from '../src/database'
import {
  AcDbLeader,
  AcDbLeaderAnnotationType,
  AcDbMText,
  AcDbPolyline
} from '../src/entity'
import { AcDbOsnapMode, AcDbRenderingCache } from '../src/misc'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

const createWorkingDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

const createRenderer = () => ({
  lines: jest.fn((points: unknown[]) => ({ kind: 'lines', points }))
})

describe('AcDbLeader', () => {
  it('exposes type names and public getters/setters', () => {
    const leader = new AcDbLeader()

    expect(AcDbLeader.typeName).toBe('Leader')
    expect(leader.dxfTypeName).toBe('LEADER')

    expect(leader.isSplined).toBe(false)
    expect(leader.hasArrowHead).toBe(false)
    expect(leader.hasHookLine).toBe(false)
    expect(leader.numVertices).toBe(0)
    expect(leader.vertices).toEqual([])
    expect(leader.dimensionStyle).toBe('')
    expect(leader.annoType).toBe(AcDbLeaderAnnotationType.NoAnnotation)
    expect(leader.closed).toBe(false)

    leader.isSplined = true
    leader.hasArrowHead = true
    leader.hasHookLine = true
    leader.dimensionStyle = 'Standard'
    leader.annoType = AcDbLeaderAnnotationType.MText
    leader.closed = true

    expect(leader.isSplined).toBe(true)
    expect(leader.hasArrowHead).toBe(true)
    expect(leader.hasHookLine).toBe(true)
    expect(leader.dimensionStyle).toBe('Standard')
    expect(leader.annoType).toBe(AcDbLeaderAnnotationType.MText)
    expect(leader.closed).toBe(false)
  })

  it('supports appendVertex, numVertices and returns cloned vertices', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(2, 1, 0))

    expect(leader.numVertices).toBe(2)
    expect(leader.vertices).toHaveLength(2)

    const exported = leader.vertices
    exported[0].x = 999
    expect(leader.vertices[0].x).toBe(0)
  })

  it('returns all leader vertices as grip points', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(5, 5, 0))
    leader.appendVertex(new AcGePoint3d(10, 5, 0))
    const grips = leader.subGetGripPoints()
    expect(grips).toHaveLength(3)
    expect(grips[0]).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(grips[2]).toMatchObject({ x: 10, y: 5, z: 0 })
  })

  it('supports setVertexAt and vertexAt with range checking', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))

    expect(leader.setVertexAt(0, new AcGePoint3d(5, 5, 0))).toBe(leader)
    expect(leader.vertexAt(0)).toMatchObject({ x: 5, y: 5, z: 0 })

    expect(() => leader.setVertexAt(-1, new AcGePoint3d(9, 8, 7))).toThrow(
      'The vertex index is out of range!'
    )
    expect(() => leader.vertexAt(-1)).toThrow(
      'The vertex index is out of range!'
    )
  })

  it('returns geometric extents for non-splined and splined leader', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(-1, 3, 0))
    leader.appendVertex(new AcGePoint3d(4, -2, 1))

    const extents = leader.geometricExtents
    expect(extents.min).toMatchObject({ x: -1, y: -2, z: 0 })
    expect(extents.max).toMatchObject({ x: 4, y: 3, z: 1 })

    leader.appendVertex(new AcGePoint3d(6, 1, 2))
    leader.appendVertex(new AcGePoint3d(8, 0, 0))
    leader.isSplined = true
    leader.subWorldDraw(createRenderer() as never)

    const splineExtents = leader.geometricExtents
    expect(splineExtents.isEmpty()).toBe(false)
  })

  it('updates geometricExtents when a vertex is moved', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(4, 0, 0))

    expect(leader.geometricExtents.max.x).toBeCloseTo(4)

    leader.setVertexAt(1, new AcGePoint3d(4, 8, 0))

    expect(leader.geometricExtents.max.y).toBeCloseTo(8)
  })

  it('draws polyline/spline branches in subWorldDraw', () => {
    const rendererA = createRenderer()
    const leaderA = new AcDbLeader()
    leaderA.appendVertex(new AcGePoint3d(0, 0, 0))
    const drawA = leaderA.subWorldDraw(rendererA as never)
    expect(rendererA.lines).toHaveBeenCalledTimes(1)
    expect(drawA).toMatchObject({ kind: 'lines' })
    expect((rendererA.lines.mock.calls[0] as unknown[][])[0]).toHaveLength(1)

    const rendererB = createRenderer()
    const leaderB = new AcDbLeader()
    leaderB.appendVertex(new AcGePoint3d(0, 0, 0))
    leaderB.isSplined = true
    leaderB.subWorldDraw(rendererB as never)
    expect((rendererB.lines.mock.calls[0] as unknown[][])[0]).toHaveLength(1)

    const rendererC = createRenderer()
    const leaderC = new AcDbLeader()
    leaderC.appendVertex(new AcGePoint3d(0, 0, 0))
    leaderC.appendVertex(new AcGePoint3d(2, 1, 0))
    leaderC.appendVertex(new AcGePoint3d(4, 0, 0))
    leaderC.appendVertex(new AcGePoint3d(6, 1, 0))
    leaderC.isSplined = true
    leaderC.subWorldDraw(rendererC as never)
    const splinedPoints = (rendererC.lines.mock.calls[0] as unknown[][])[0]
    expect(splinedPoints.length).toBeGreaterThan(1)
    expect(splinedPoints.length).toBeLessThanOrEqual(100)
  })

  it('extends straight leaders with a horizontal hook line segment', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(10, 5, 0))
    leader.hasHookLine = true
    leader.isHookLineSameDirection = true
    leader.textWidth = 4
    leader.horizontalDirection = new AcGeVector3d(1, 0, 0)

    const renderer = createRenderer()
    leader.subWorldDraw(renderer as never)
    const points = (
      renderer.lines.mock.calls[0] as unknown[][]
    )[0] as AcGePoint3d[]
    expect(points).toHaveLength(3)
    expect(points[2]).toMatchObject({ x: 15, y: 5, z: 0 })
  })

  it('prefers associated MTEXT extents width for hook line length', () => {
    const db = createWorkingDb()
    const mtext = new AcDbMText()
    mtext.location = new AcGePoint3d(10, 8, 0)
    mtext.height = 5
    mtext.extentsWidth = 18
    db.tables.blockTable.modelSpace.appendEntity(mtext)

    const leader = new AcDbLeader()
    db.tables.blockTable.modelSpace.appendEntity(leader)
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(10, 5, 0))
    leader.hasHookLine = true
    leader.isHookLineSameDirection = true
    leader.textWidth = 9.51
    leader.annoType = AcDbLeaderAnnotationType.MText
    leader.horizontalDirection = new AcGeVector3d(1, 0, 0)

    const renderer = createRenderer()
    leader.subWorldDraw(renderer as never)
    const points = (
      renderer.lines.mock.calls[0] as unknown[][]
    )[0] as AcGePoint3d[]
    expect(points[2]).toMatchObject({ x: 28, y: 5, z: 0 })
  })

  it('draws hook line when textWidth is zero but MTEXT bounds define the span', () => {
    const db = createWorkingDb()
    const mtext = new AcDbMText()
    mtext.location = new AcGePoint3d(10, 8, 0)
    mtext.height = 5
    mtext.extentsWidth = 20
    db.tables.blockTable.modelSpace.appendEntity(mtext)

    const leader = new AcDbLeader()
    db.tables.blockTable.modelSpace.appendEntity(leader)
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(10, 6, 0))
    leader.hasHookLine = true
    leader.annoType = AcDbLeaderAnnotationType.MText
    leader.textWidth = 0
    leader.isHookLineSameDirection = true
    leader.horizontalDirection = new AcGeVector3d(1, 0, 0)

    const renderer = createRenderer()
    leader.subWorldDraw(renderer as never)
    const points = (
      renderer.lines.mock.calls[0] as unknown[][]
    )[0] as AcGePoint3d[]
    expect(points).toHaveLength(3)
    expect(points[2]).toMatchObject({ x: 30, y: 6, z: 0 })
  })

  it('does not extend a standalone leader over an unrelated nearby MTEXT', () => {
    const db = createWorkingDb()
    const mtext = new AcDbMText()
    mtext.location = new AcGePoint3d(10, 8, 0)
    mtext.height = 5
    mtext.extentsWidth = 16
    db.tables.blockTable.modelSpace.appendEntity(mtext)

    // DXF 73 = 3 (no annotation) and DXF 75 = 0: AutoCAD draws the stored
    // vertices only, even though a TEXT/MTEXT sits right next to the landing.
    const leader = new AcDbLeader()
    db.tables.blockTable.modelSpace.appendEntity(leader)
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(10, 6, 0))
    leader.hasHookLine = false
    leader.annoType = AcDbLeaderAnnotationType.NoAnnotation
    leader.textWidth = 0
    leader.isHookLineSameDirection = true
    leader.horizontalDirection = new AcGeVector3d(1, 0, 0)

    const renderer = createRenderer()
    leader.subWorldDraw(renderer as never)
    const points = (
      renderer.lines.mock.calls[0] as unknown[][]
    )[0] as AcGePoint3d[]
    expect(points).toHaveLength(2)
    expect(points[1]).toMatchObject({ x: 10, y: 6, z: 0 })
  })

  it('keeps the author geometry for leaders like handles 4E61F / 4E621', () => {
    // Exact DXF values from 蓝田记翼项目檐下集装饰施工图8.19.dwg:
    //   71 = 0 (no arrowhead), 72 = 0, 73 = 3 (no annotation), 74 = 1,
    //   75 absent (no hook line), 40 = 0, 41 = 0.
    const db = createWorkingDb()
    const mtext = new AcDbMText()
    mtext.location = new AcGePoint3d(4355.61, 6591.5, 0)
    mtext.height = 5
    mtext.extentsWidth = 40
    db.tables.blockTable.modelSpace.appendEntity(mtext)

    const leader = new AcDbLeader()
    db.tables.blockTable.modelSpace.appendEntity(leader)
    leader.appendVertex(
      new AcGePoint3d(4297.252344611998, 6590.970519376428, 0)
    )
    leader.appendVertex(new AcGePoint3d(4370.38725693262, 6590.970519376428, 0))
    leader.hasArrowHead = false
    leader.hasHookLine = false
    leader.annoType = AcDbLeaderAnnotationType.NoAnnotation
    leader.isHookLineSameDirection = true
    leader.textHeight = 0
    leader.textWidth = 0
    leader.horizontalDirection = new AcGeVector3d(1, 0, 0)

    const renderer = createRenderer()
    leader.subWorldDraw(renderer as never)
    const points = (
      renderer.lines.mock.calls[0] as unknown[][]
    )[0] as AcGePoint3d[]

    expect(points).toHaveLength(2)
    expect(points[1].x).toBeCloseTo(4370.387, 3)
    expect(points[1].y).toBeCloseTo(6590.971, 3)
  })

  it('only uses associated MTEXT for landing geometry of annotated leaders', () => {
    const db = createWorkingDb()
    const mtext = new AcDbMText()
    mtext.location = new AcGePoint3d(10, 8, 0)
    mtext.height = 5
    mtext.extentsWidth = 16
    db.tables.blockTable.modelSpace.appendEntity(mtext)

    const leader = new AcDbLeader()
    db.tables.blockTable.modelSpace.appendEntity(leader)
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(10, 6, 0))
    leader.hasHookLine = true
    leader.annoType = AcDbLeaderAnnotationType.MText
    leader.textWidth = 0
    leader.isHookLineSameDirection = true
    leader.horizontalDirection = new AcGeVector3d(1, 0, 0)

    const renderer = createRenderer()
    leader.subWorldDraw(renderer as never)
    const points = (
      renderer.lines.mock.calls[0] as unknown[][]
    )[0] as AcGePoint3d[]
    expect(points).toHaveLength(3)
    expect(points[2]).toMatchObject({ x: 26, y: 6, z: 0 })
  })

  it('extends hook line in the negative horizontal direction', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(10, 5, 0))
    leader.hasHookLine = true
    leader.isHookLineSameDirection = false
    leader.textWidth = 4
    leader.horizontalDirection = new AcGeVector3d(1, 0, 0)

    const renderer = createRenderer()
    leader.subWorldDraw(renderer as never)
    const points = (
      renderer.lines.mock.calls[0] as unknown[][]
    )[0] as AcGePoint3d[]
    expect(points[2]).toMatchObject({ x: 5, y: 5, z: 0 })
  })

  it('resolves MTEXT by associatedAnnotation handle before spatial search', () => {
    const db = createWorkingDb()
    const farMtext = new AcDbMText()
    farMtext.location = new AcGePoint3d(100, 100, 0)
    farMtext.height = 5
    farMtext.extentsWidth = 50
    db.tables.blockTable.modelSpace.appendEntity(farMtext)

    const nearMtext = new AcDbMText()
    nearMtext.location = new AcGePoint3d(10, 8, 0)
    nearMtext.height = 5
    nearMtext.extentsWidth = 10
    db.tables.blockTable.modelSpace.appendEntity(nearMtext)

    const leader = new AcDbLeader()
    db.tables.blockTable.modelSpace.appendEntity(leader)
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(10, 5, 0))
    leader.associatedAnnotation = farMtext.objectId
    leader.hasHookLine = true
    leader.annoType = AcDbLeaderAnnotationType.MText
    leader.isHookLineSameDirection = true
    leader.textWidth = 0
    leader.horizontalDirection = new AcGeVector3d(1, 0, 0)

    const renderer = createRenderer()
    leader.subWorldDraw(renderer as never)
    const points = (
      renderer.lines.mock.calls[0] as unknown[][]
    )[0] as AcGePoint3d[]
    expect(points[2].x).toBeGreaterThan(100)
    expect(points[2].x).not.toBeCloseTo(20)
  })

  it('includes hook line endpoint in geometricExtents', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(10, 5, 0))
    leader.hasHookLine = true
    leader.isHookLineSameDirection = true
    leader.textWidth = 4
    leader.horizontalDirection = new AcGeVector3d(1, 0, 0)

    expect(leader.geometricExtents.max.x).toBeCloseTo(15)
    expect(leader.geometricExtents.max.y).toBeCloseTo(5)
  })

  it('associates rotated MTEXT using oriented local coordinates', () => {
    const db = createWorkingDb()
    const decoy = new AcDbMText()
    decoy.location = new AcGePoint3d(20, 5, 0)
    decoy.height = 4
    decoy.extentsWidth = 30
    db.tables.blockTable.modelSpace.appendEntity(decoy)

    const rotated = new AcDbMText()
    rotated.location = new AcGePoint3d(10, 10, 0)
    rotated.rotation = Math.PI / 2
    rotated.direction = new AcGeVector3d(0, 1, 0)
    rotated.height = 4
    rotated.extentsWidth = 20
    rotated.attachmentPoint = AcGiMTextAttachmentPoint.TopLeft
    db.tables.blockTable.modelSpace.appendEntity(rotated)

    const leader = new AcDbLeader()
    db.tables.blockTable.modelSpace.appendEntity(leader)
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(12, 20, 0))
    leader.hasHookLine = true
    leader.annoType = AcDbLeaderAnnotationType.MText
    leader.isHookLineSameDirection = true
    leader.textWidth = 0
    leader.horizontalDirection = new AcGeVector3d(1, 0, 0)

    const renderer = createRenderer()
    leader.subWorldDraw(renderer as never)
    const points = (
      renderer.lines.mock.calls[0] as unknown[][]
    )[0] as AcGePoint3d[]
    expect(points).toHaveLength(3)
    expect(points[2].x).toBeCloseTo(14)
    expect(points[2].y).toBeCloseTo(20)
  })

  it('transforms vertices and keeps working for splined geometry', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(1, 0, 0))

    const matrix = new AcGeMatrix3d().makeTranslation(10, -2, 3)
    expect(leader.transformBy(matrix)).toBe(leader)
    expect(leader.vertices[0]).toMatchObject({ x: 10, y: -2, z: 3 })
    expect(leader.vertices[1]).toMatchObject({ x: 11, y: -2, z: 3 })

    leader.appendVertex(new AcGePoint3d(12, -1, 3))
    leader.appendVertex(new AcGePoint3d(14, -2, 3))
    leader.isSplined = true
    leader.subWorldDraw(createRenderer() as never)
    expect(
      leader.transformBy(new AcGeMatrix3d().makeTranslation(1, 1, 0))
    ).toBe(leader)

    const renderer = createRenderer()
    leader.subWorldDraw(renderer as never)
    const sampled = (renderer.lines.mock.calls[0] as unknown[][])[0]
    expect(sampled.length).toBeGreaterThan(1)
    expect(sampled.length).toBeLessThanOrEqual(100)
  })

  it('writes leader-specific DXF fields', () => {
    const db = createWorkingDb()
    const leader = new AcDbLeader()
    db.tables.blockTable.modelSpace.appendEntity(leader)

    leader.dimensionStyle = 'Standard'
    leader.hasArrowHead = true
    leader.hasHookLine = true
    leader.isHookLineSameDirection = true
    leader.isSplined = true
    leader.annoType = AcDbLeaderAnnotationType.BlockReference
    leader.textHeight = 2.5
    leader.textWidth = 8
    leader.associatedAnnotation = 'ABC'
    leader.appendVertex(new AcGePoint3d(1, 2, 3))
    leader.appendVertex(new AcGePoint3d(4, 5, 6))

    const filer = new AcDbDxfFiler()
    expect(leader.dxfOutFields(filer)).toBe(leader)

    const dxf = filer.toString()
    expect(dxf).toContain('100\nAcDbLeader\n')
    expect(dxf).toContain('\n3\nStandard\n')
    expect(dxf).toContain('\n71\n1\n')
    expect(dxf).toContain('\n72\n1\n')
    expect(dxf).toContain('\n73\n2\n')
    expect(dxf).toContain('\n74\n1\n')
    expect(dxf).toContain('\n75\n1\n')
    expect(dxf).toContain('\n76\n2\n')
    expect(dxf).toContain('\n40\n2.5\n')
    expect(dxf).toContain('\n41\n8\n')
    expect(dxf).toContain('\n340\nABC\n')
    expect(dxf).toContain('\n10\n1\n')
    expect(dxf).toContain('\n20\n2\n')
    expect(dxf).toContain('\n30\n3\n')
    expect(dxf).toContain('\n10\n4\n')
    expect(dxf).toContain('\n20\n5\n')
    expect(dxf).toContain('\n30\n6\n')
  })

  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbLeader())
  })

  it('offsets straight leader vertices as a polyline path', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(10, 0, 0))
    leader.appendVertex(new AcGePoint3d(10, 5, 0))
    const [result] = leader.getOffsetCurves(2) as AcDbPolyline[]
    expect(result.numberOfVertices).toBeGreaterThanOrEqual(2)
  })

  it('computes osnap points for straight and splined leaders', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(4, 0, 0))
    leader.appendVertex(new AcGePoint3d(4, 3, 0))

    const endPoints: AcGePoint3d[] = []
    leader.subGetOsnapPoints(
      AcDbOsnapMode.EndPoint,
      new AcGePoint3d(),
      new AcGePoint3d(),
      endPoints
    )
    expect(endPoints).toHaveLength(3)

    const midPoints: AcGePoint3d[] = []
    leader.subGetOsnapPoints(
      AcDbOsnapMode.MidPoint,
      new AcGePoint3d(),
      new AcGePoint3d(),
      midPoints
    )
    expect(midPoints).toHaveLength(2)
    expect(midPoints[0]).toMatchObject({ x: 2, y: 0, z: 0 })
    expect(midPoints[1]).toMatchObject({ x: 4, y: 1.5, z: 0 })

    const straightNearestPoints: AcGePoint3d[] = []
    leader.subGetOsnapPoints(
      AcDbOsnapMode.Nearest,
      new AcGePoint3d(4, 2, 0),
      new AcGePoint3d(),
      straightNearestPoints
    )
    expect(straightNearestPoints).toHaveLength(1)
    expect(straightNearestPoints[0]).toMatchObject({ x: 4, y: 2, z: 0 })

    const perpendicularPoints: AcGePoint3d[] = []
    leader.subGetOsnapPoints(
      AcDbOsnapMode.Perpendicular,
      new AcGePoint3d(4, 2, 0),
      new AcGePoint3d(),
      perpendicularPoints
    )
    expect(perpendicularPoints).toHaveLength(1)
    expect(perpendicularPoints[0]).toMatchObject({ x: 4, y: 2, z: 0 })

    leader.appendVertex(new AcGePoint3d(6, 1, 0))
    leader.appendVertex(new AcGePoint3d(8, 0, 0))
    leader.isSplined = true

    const splineEndPoints: AcGePoint3d[] = []
    leader.subGetOsnapPoints(
      AcDbOsnapMode.EndPoint,
      new AcGePoint3d(),
      new AcGePoint3d(),
      splineEndPoints
    )
    expect(splineEndPoints).toHaveLength(2)
    expect(splineEndPoints[0]).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(splineEndPoints[1]).toMatchObject({ x: 8, y: 0, z: 0 })

    const nearestPoints: AcGePoint3d[] = []
    leader.subGetOsnapPoints(
      AcDbOsnapMode.Nearest,
      new AcGePoint3d(4, 2, 0),
      new AcGePoint3d(),
      nearestPoints
    )
    expect(nearestPoints).toHaveLength(1)
  })

  describe('arrowhead (DXF group code 71)', () => {
    const createArrowRenderer = () => ({
      context: DEFAULT_ACGI_CONTEXT,
      subEntityTraits: {
        color: new AcCmColor(),
        fillType: undefined
      } as Record<string, unknown>,
      lines: jest.fn((points: unknown[]) => ({ kind: 'lines', points })),
      area: jest.fn((area: unknown) => ({ kind: 'area', area })),
      group: jest.fn((entities: unknown[]) => ({ kind: 'group', entities }))
    })

    const createLeader = (hasArrowHead: boolean) => {
      const leader = new AcDbLeader()
      leader.appendVertex(new AcGePoint3d(0, 0, 0))
      leader.appendVertex(new AcGePoint3d(10, 0, 0))
      leader.hasArrowHead = hasArrowHead
      return leader
    }

    it('draws no arrowhead when group 71 is 0', () => {
      const leader = createLeader(false)
      const renderer = createArrowRenderer()

      const result = leader.subWorldDraw(renderer as never)

      expect(renderer.area).not.toHaveBeenCalled()
      expect(renderer.group).not.toHaveBeenCalled()
      expect(result).toMatchObject({ kind: 'lines' })
    })

    it('falls back to a filled triangle when the arrow block is missing', () => {
      const leader = createLeader(true)
      const renderer = createArrowRenderer()

      leader.subWorldDraw(renderer as never)

      expect(renderer.lines).toHaveBeenCalledTimes(1)
      expect(renderer.area).toHaveBeenCalledTimes(1)
      expect(renderer.group).toHaveBeenCalledTimes(1)
      // The procedural arrow uses the tip vertex and points along the segment.
      const area = (renderer.area.mock.calls[0] as unknown[])[0] as {
        loops: unknown[]
      }
      expect(area).toBeDefined()
    })

    it('renders the arrow block from the dimension style DIMLDRBLK', () => {
      const db = createWorkingDb()
      const arrowBlock = new AcDbBlockTableRecord()
      arrowBlock.name = '_CLOSEDFILLED'
      db.tables.blockTable.add(arrowBlock)

      const style = new AcDbDimStyleTableRecord()
      style.name = 'ARROW_STYLE'
      style.dimldrblk = '_CLOSEDFILLED'
      db.tables.dimStyleTable.add(style)

      const leader = createLeader(true)
      leader.dimensionStyle = 'ARROW_STYLE'
      db.tables.blockTable.modelSpace.appendEntity(leader)

      const renderer = createArrowRenderer()
      const drawSpy = jest
        .spyOn(AcDbRenderingCache.instance, 'draw')
        .mockReturnValue({ kind: 'arrow-block' } as never)

      leader.subWorldDraw(renderer as never)

      expect(drawSpy).toHaveBeenCalledTimes(1)
      expect(drawSpy.mock.calls[0][1]).toBe(arrowBlock)
      expect(renderer.area).not.toHaveBeenCalled()

      drawSpy.mockRestore()
    })

    it('skips the arrowhead when DIMLDRBLK resolves to _NONE', () => {
      const db = createWorkingDb()
      const style = new AcDbDimStyleTableRecord()
      style.name = 'NO_ARROW_STYLE'
      style.dimldrblk = '_NONE'
      db.tables.dimStyleTable.add(style)

      const leader = createLeader(true)
      leader.dimensionStyle = 'NO_ARROW_STYLE'
      db.tables.blockTable.modelSpace.appendEntity(leader)

      const renderer = createArrowRenderer()
      leader.subWorldDraw(renderer as never)

      expect(renderer.area).not.toHaveBeenCalled()
      expect(renderer.group).not.toHaveBeenCalled()
    })

    it('generates a missing built-in arrow block instead of dropping the arrow', () => {
      // Drawings only store custom arrow blocks; `_DOT` / `_ARCHTICK` are
      // AutoCAD built-ins that are absent from the block table. Dimensions
      // generate them on demand, so leaders must do the same.
      const db = createWorkingDb()
      const style = new AcDbDimStyleTableRecord()
      style.name = 'DOT_STYLE'
      style.dimldrblk = '_DOT'
      db.tables.dimStyleTable.add(style)

      const leader = createLeader(true)
      leader.dimensionStyle = 'DOT_STYLE'
      db.tables.blockTable.modelSpace.appendEntity(leader)

      const renderer = createArrowRenderer()
      const drawSpy = jest
        .spyOn(AcDbRenderingCache.instance, 'draw')
        .mockReturnValue({ kind: 'arrow-block' } as never)

      leader.subWorldDraw(renderer as never)

      expect(db.tables.blockTable.getAt('_DOT')).toBeTruthy()
      expect(drawSpy).toHaveBeenCalledTimes(1)
      drawSpy.mockRestore()
    })

    it('sizes the arrowhead from DIMASZ × DIMSCALE, not DIMTSZ', () => {
      // DIMASZ is documented as the size of dimension line *and leader line*
      // arrowheads. DIMTSZ only replaces terminators on dimension entities.
      const db = createWorkingDb()
      const arrowBlock = new AcDbBlockTableRecord()
      arrowBlock.name = '_CLOSEDFILLED'
      db.tables.blockTable.add(arrowBlock)

      const style = new AcDbDimStyleTableRecord()
      style.name = 'SIZE_STYLE'
      style.dimldrblk = '_CLOSEDFILLED'
      style.dimasz = 3
      style.dimtsz = 7
      style.dimscale = 2
      db.tables.dimStyleTable.add(style)

      const leader = createLeader(true)
      leader.dimensionStyle = 'SIZE_STYLE'
      db.tables.blockTable.modelSpace.appendEntity(leader)

      const renderer = createArrowRenderer()
      const drawSpy = jest
        .spyOn(AcDbRenderingCache.instance, 'draw')
        .mockReturnValue({ kind: 'arrow-block' } as never)

      leader.subWorldDraw(renderer as never)

      const matrix = drawSpy.mock.calls[0][5] as unknown as AcGeMatrix3d
      const tip = new AcGePoint3d(0, 0, 0).applyMatrix4(matrix)
      // Arrow blocks are authored tip-at-origin with the tail along -X, so a
      // block point one unit up the base maps exactly one arrow size away.
      const base = new AcGePoint3d(0, 1, 0).applyMatrix4(matrix)
      expect(tip.distanceTo(base)).toBeCloseTo(6, 6)
      drawSpy.mockRestore()
    })

    it('stays off the direct batch path when an arrowhead may be drawn', () => {
      expect(createLeader(false).directBatchPrimitive).toBe('lineStrip')
      expect(createLeader(true).directBatchPrimitive).toBeNull()
    })

    it('memoizes the effective style and invalidates it with ACAD XData', () => {
      // `subWorldDraw` resolves the style for the arrow size, the arrow block
      // name and the hook gap. With overrides present each call would otherwise
      // clone the table record, so the resolved style has to be cached.
      const db = createWorkingDb()
      const block = new AcDbBlockTableRecord()
      block.name = '_CLOSEDFILLED'
      db.tables.blockTable.add(block)

      const style = new AcDbDimStyleTableRecord()
      style.name = 'CACHE_STYLE'
      style.dimldrblk = '_CLOSEDFILLED'
      db.tables.dimStyleTable.add(style)

      const leader = createLeader(true)
      leader.dimensionStyle = 'CACHE_STYLE'
      db.tables.blockTable.modelSpace.appendEntity(leader)
      leader.setXData(
        new AcDbResultBuffer([
          { code: AcDbDxfCode.ExtendedDataRegAppName, value: 'ACAD' },
          { code: AcDbDxfCode.ExtendedDataAsciiString, value: 'DSTYLE' },
          { code: AcDbDxfCode.ExtendedDataControlString, value: '{' },
          { code: AcDbDxfCode.ExtendedDataInteger16, value: 41 },
          { code: AcDbDxfCode.ExtendedDataReal, value: 4 },
          { code: AcDbDxfCode.ExtendedDataControlString, value: '}' }
        ] as never)
      )

      let clones = 0
      const original = style.clonePreservingIdentity.bind(style)
      style.clonePreservingIdentity = (() => {
        clones++
        return original()
      }) as never

      const drawSpy = jest
        .spyOn(AcDbRenderingCache.instance, 'draw')
        .mockReturnValue({ kind: 'arrow-block' } as never)
      const renderer = createArrowRenderer()

      leader.subWorldDraw(renderer as never)
      const afterFirst = clones
      leader.subWorldDraw(renderer as never)

      expect(afterFirst).toBe(1)
      expect(clones).toBe(1)

      // New overrides must rebuild the effective style.
      leader.setXData(
        new AcDbResultBuffer([
          { code: AcDbDxfCode.ExtendedDataRegAppName, value: 'ACAD' },
          { code: AcDbDxfCode.ExtendedDataAsciiString, value: 'DSTYLE' },
          { code: AcDbDxfCode.ExtendedDataControlString, value: '{' },
          { code: AcDbDxfCode.ExtendedDataInteger16, value: 41 },
          { code: AcDbDxfCode.ExtendedDataReal, value: 6 },
          { code: AcDbDxfCode.ExtendedDataControlString, value: '}' }
        ] as never)
      )
      leader.subWorldDraw(renderer as never)
      expect(clones).toBe(2)

      drawSpy.mockRestore()
    })
  })

  describe('properties', () => {
    const byName = (leader: AcDbLeader) => {
      const props = leader.properties
      expect(props.type).toBe('Leader')
      const general = props.groups.find(g => g.groupName === 'general')
      const leaderGroup = props.groups.find(g => g.groupName === 'leader')
      const textGroup = props.groups.find(g => g.groupName === 'text')
      const geometry = props.groups.find(g => g.groupName === 'geometry')
      expect(general).toBeDefined()
      expect(leaderGroup).toBeDefined()
      expect(textGroup).toBeDefined()
      expect(geometry).toBeDefined()

      return Object.fromEntries(
        [
          ...(leaderGroup?.properties ?? []),
          ...(textGroup?.properties ?? []),
          ...(geometry?.properties ?? [])
        ].map(p => [p.name, p])
      )
    }

    it('exposes the DXF leader fields with working accessors', () => {
      const leader = new AcDbLeader()
      leader.appendVertex(new AcGePoint3d(0, 0, 0))
      leader.appendVertex(new AcGePoint3d(5, 5, 0))
      const props = byName(leader)

      expect(props.dimensionStyleName.editable).toBe(true)
      props.dimensionStyleName.accessor.set?.('Standard')
      expect(leader.dimensionStyle).toBe('Standard')
      expect(props.dimensionStyleName.accessor.get()).toBe('Standard')

      props.annoType.accessor.set?.(AcDbLeaderAnnotationType.MText)
      expect(leader.annoType).toBe(AcDbLeaderAnnotationType.MText)
      expect(props.annoType.accessor.get()).toBe(AcDbLeaderAnnotationType.MText)

      props.hasArrowHead.accessor.set?.(true)
      props.hasHookLine.accessor.set?.(true)
      props.isHookLineSameDirection.accessor.set?.(true)
      props.isSplined.accessor.set?.(true)
      expect(leader.hasArrowHead).toBe(true)
      expect(leader.hasHookLine).toBe(true)
      expect(leader.isHookLineSameDirection).toBe(true)
      expect(leader.isSplined).toBe(true)
      expect(props.hasArrowHead.accessor.get()).toBe(true)

      props.textHeight.accessor.set?.(2.5)
      props.textWidth.accessor.set?.(12)
      expect(leader.textHeight).toBe(2.5)
      expect(leader.textWidth).toBe(12)
      expect(props.textWidth.accessor.get()).toBe(12)
    })

    it('offers the annotation types as enum options and keeps read-only fields read-only', () => {
      const leader = new AcDbLeader()
      const props = byName(leader)

      expect(props.annoType.type).toBe('enum')
      expect(props.annoType.options?.map(option => option.value)).toEqual([
        AcDbLeaderAnnotationType.MText,
        AcDbLeaderAnnotationType.Fcf,
        AcDbLeaderAnnotationType.BlockReference,
        AcDbLeaderAnnotationType.NoAnnotation
      ])
      // Labels come from the TypeScript enum names so the palette can
      // translate them through `entity.enum`.
      expect(props.annoType.options?.map(option => option.label)).toEqual([
        'MText',
        'Fcf',
        'BlockReference',
        'NoAnnotation'
      ])

      expect(props.associatedAnnotation.editable).toBe(false)
      expect(props.byBlockColor.editable).toBe(false)
      expect(props.vertices.editable).toBe(false)
    })

    it('exposes vertices, normal, horizontal direction and optional offsets', () => {
      const leader = new AcDbLeader()
      leader.appendVertex(new AcGePoint3d(1, 2, 3))
      leader.appendVertex(new AcGePoint3d(4, 5, 6))
      const props = byName(leader)

      expect(props.vertices.type).toBe('array')
      expect(props.vertices.accessor.get()).toEqual([
        { x: 1, y: 2, z: 3 },
        { x: 4, y: 5, z: 6 }
      ])
      // The palette edits array elements in place, which must not leak into
      // the entity through a shared object.
      ;(props.vertices.accessor.get() as { x: number; y: number }[])[0].y = 99
      expect(leader.vertices[0].y).toBe(2)

      expect(props.normalZ.accessor.get()).toBe(1)
      props.horizontalDirectionX.accessor.set?.(0)
      expect(leader.horizontalDirection.x).toBe(0)

      // Optional vectors start out absent.
      expect(props.offsetFromBlockX.accessor.get()).toBeUndefined()
      props.offsetFromBlockX.accessor.set?.(3)
      expect(leader.offsetFromBlock).toMatchObject({ x: 3, y: 0, z: 0 })
      expect(props.offsetFromBlockX.accessor.get()).toBe(3)

      props.offsetFromAnnotationZ.accessor.set?.(4)
      expect(leader.offsetFromAnnotation).toMatchObject({ x: 0, y: 0, z: 4 })
      expect(props.offsetFromAnnotationZ.accessor.get()).toBe(4)
    })
  })
})
