import {
  AcGeMatrix3d,
  AcGePoint2d,
  AcGePoint3d,
  AcGePolyline2d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDb2dVertex } from '../src/entity/AcDb2dVertex'
import { AcDbArc } from '../src/entity/AcDbArc'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbCircle } from '../src/entity/AcDbCircle'
import { AcDbEllipse } from '../src/entity/AcDbEllipse'
import { AcDbHatch, AcDbHatchPatternType } from '../src/entity/AcDbHatch'
import { AcDbLeader } from '../src/entity/AcDbLeader'
import { AcDbLine } from '../src/entity/AcDbLine'
import { AcDbMLeader } from '../src/entity/AcDbMLeader'
import { AcDbMLine } from '../src/entity/AcDbMLine'
import { AcDbMText } from '../src/entity/AcDbMText'
import { AcDbPoint } from '../src/entity/AcDbPoint'
import { AcDbPolyline } from '../src/entity/AcDbPolyline'
import { AcDbRasterImage } from '../src/entity/AcDbRasterImage'
import { AcDbText } from '../src/entity/AcDbText'
import { AcDbTrace } from '../src/entity/AcDbTrace'
import { AcDbAlignedDimension } from '../src/entity/dimension/AcDbAlignedDimension'
import { AcDbRadialDimension } from '../src/entity/dimension/AcDbRadialDimension'

/**
 * Uniform scale about a base point, exactly as the SCALE command builds it:
 * `T(base) * S(k, k, k) * T(-base)`.
 */
const makeScaleAbout = (base: AcGePoint3d, k: number) =>
  new AcGeMatrix3d()
    .makeTranslation(base.x, base.y, base.z)
    .multiply(new AcGeMatrix3d().makeScale(k, k, k))
    .multiply(new AcGeMatrix3d().makeTranslation(-base.x, -base.y, -base.z))

const makeRotateAbout = (base: AcGePoint3d, angle: number) =>
  new AcGeMatrix3d()
    .makeTranslation(base.x, base.y, base.z)
    .multiply(new AcGeMatrix3d().makeRotationZ(angle))
    .multiply(new AcGeMatrix3d().makeTranslation(-base.x, -base.y, -base.z))

const BASE = new AcGePoint3d(10, 5, 0)
const K = 2
const SCALE = makeScaleAbout(BASE, K)

/** Image of `p` under {@link SCALE}. */
const scaled = (x: number, y: number, z = 0) => ({
  x: BASE.x + K * (x - BASE.x),
  y: BASE.y + K * (y - BASE.y),
  z: BASE.z + K * (z - BASE.z)
})

const expectPointClose = (
  actual: { x: number; y: number; z?: number },
  expected: { x: number; y: number; z?: number }
) => {
  expect(actual.x).toBeCloseTo(expected.x, 8)
  expect(actual.y).toBeCloseTo(expected.y, 8)
  expect(actual.z ?? 0).toBeCloseTo(expected.z ?? 0, 8)
}

const len = (v: { x: number; y: number; z: number }) =>
  Math.hypot(v.x, v.y, v.z)

const createWorkingDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

describe('AcDbEntity.transformBy with a uniform SCALE matrix', () => {
  it('scales circle radius and thickness and keeps the OCS frame', () => {
    const circle = new AcDbCircle(new AcGePoint3d(1, 2, 0), 3)
    circle.thickness = 4
    circle.transformBy(SCALE)

    expectPointClose(circle.center, scaled(1, 2))
    expect(circle.radius).toBeCloseTo(6, 8)
    expect(circle.thickness).toBeCloseTo(8, 8)
    expectPointClose(circle.normal, { x: 0, y: 0, z: 1 })
  })

  it('keeps arc start / end angles under scale and moves them under rotation', () => {
    const arc = new AcDbArc(
      new AcGePoint3d(1, 2, 0),
      3,
      Math.PI / 6,
      (2 * Math.PI) / 3
    )
    arc.thickness = 1
    arc.transformBy(SCALE)

    expectPointClose(arc.center, scaled(1, 2))
    expect(arc.radius).toBeCloseTo(6, 8)
    expect(arc.startAngle).toBeCloseTo(Math.PI / 6, 8)
    expect(arc.endAngle).toBeCloseTo((2 * Math.PI) / 3, 8)
    expect(arc.thickness).toBeCloseTo(2, 8)
    expectPointClose(arc.normal, { x: 0, y: 0, z: 1 })

    arc.transformBy(makeRotateAbout(BASE, Math.PI / 2))
    expect(arc.startAngle).toBeCloseTo((2 * Math.PI) / 3, 8)
    expect(arc.endAngle).toBeCloseTo((7 * Math.PI) / 6, 8)
  })

  it('mirrors an arc in its plane without flipping the normal', () => {
    const arc = new AcDbArc(new AcGePoint3d(0, 0, 0), 1, 0, Math.PI / 2)
    // Mirror about the Y axis.
    arc.transformBy(new AcGeMatrix3d().makeScale(-1, 1, 1))

    expectPointClose(arc.normal, { x: 0, y: 0, z: 1 })
    expect(arc.startAngle).toBeCloseTo(Math.PI / 2, 8)
    expect(arc.endAngle).toBeCloseTo(Math.PI, 8)
    expectPointClose(arc.startPoint, { x: 0, y: 1, z: 0 })
    expectPointClose(arc.endPoint, { x: -1, y: 0, z: 0 })
  })

  it('scales ellipse major axis and keeps the radius ratio', () => {
    const ellipse = new AcDbEllipse(
      new AcGePoint3d(1, 2, 0),
      AcGeVector3d.Z_AXIS,
      AcGeVector3d.X_AXIS,
      4,
      2,
      0,
      Math.PI
    )
    ellipse.transformBy(SCALE)

    expectPointClose(ellipse.center, scaled(1, 2))
    expect(ellipse.majorAxisRadius).toBeCloseTo(8, 8)
    expect(ellipse.minorAxisRadius).toBeCloseTo(4, 8)
    expect(ellipse.startAngle).toBeCloseTo(0, 8)
    expect(ellipse.endAngle).toBeCloseTo(Math.PI, 8)
  })

  it('scales line and point thickness', () => {
    const line = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(1, 1, 0)
    )
    line.thickness = 3
    line.transformBy(SCALE)
    expectPointClose(line.startPoint, scaled(0, 0))
    expectPointClose(line.endPoint, scaled(1, 1))
    expect(line.thickness).toBeCloseTo(6, 8)

    const point = new AcDbPoint()
    point.position = new AcGePoint3d(3, 4, 0)
    point.thickness = 2
    point.transformBy(SCALE)
    expectPointClose(point.position, scaled(3, 4))
    expect(point.thickness).toBeCloseTo(4, 8)
  })

  it('scales lightweight polyline widths and thickness and keeps bulges', () => {
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0), 0.5, 1, 2)
    pline.addVertexAt(1, new AcGePoint2d(4, 0), 0, 3, 4)
    pline.thickness = 1.5
    pline.transformBy(SCALE)

    expectPointClose(pline.getPoint3dAt(0), scaled(0, 0))
    expectPointClose(pline.getPoint3dAt(1), scaled(4, 0))
    const vertices = (
      pline as unknown as {
        _geo: {
          vertices: { bulge?: number; startWidth?: number; endWidth?: number }[]
        }
      }
    )._geo.vertices
    expect(vertices[0].bulge).toBeCloseTo(0.5, 8)
    expect(vertices[0].startWidth).toBeCloseTo(2, 8)
    expect(vertices[0].endWidth).toBeCloseTo(4, 8)
    expect(vertices[1].startWidth).toBeCloseTo(6, 8)
    expect(vertices[1].endWidth).toBeCloseTo(8, 8)
    expect(pline.thickness).toBeCloseTo(3, 8)
  })

  it('transforms lightweight polyline vertices in their OCS', () => {
    const pline = new AcDbPolyline()
    // OCS of the -Z extrusion has its X axis on -X (arbitrary axis algorithm).
    pline.normal = new AcGeVector3d(0, 0, -1)
    pline.elevation = 1
    pline.addVertexAt(0, new AcGePoint2d(1, 2))
    pline.addVertexAt(1, new AcGePoint2d(3, 2))
    const before = [pline.getPoint3dAt(0), pline.getPoint3dAt(1)]

    const matrix = new AcGeMatrix3d().makeTranslation(5, 6, 7)
    pline.transformBy(matrix)

    expectPointClose(pline.getPoint3dAt(0), before[0].applyMatrix4(matrix))
    expectPointClose(pline.getPoint3dAt(1), before[1].applyMatrix4(matrix))
    expectPointClose(pline.normal, { x: 0, y: 0, z: -1 })
  })

  it('scales 2d vertex widths', () => {
    const vertex = new AcDb2dVertex()
    vertex.position = new AcGePoint3d(1, 1, 0)
    vertex.startWidth = 1
    vertex.endWidth = 2
    vertex.transformBy(SCALE)
    expectPointClose(vertex.position, scaled(1, 1))
    expect(vertex.startWidth).toBeCloseTo(2, 8)
    expect(vertex.endWidth).toBeCloseTo(4, 8)
  })

  it('scales trace thickness', () => {
    const trace = new AcDbTrace()
    trace.setPointAt(0, new AcGePoint3d(0, 0, 0))
    trace.setPointAt(1, new AcGePoint3d(1, 0, 0))
    trace.setPointAt(2, new AcGePoint3d(0, 1, 0))
    trace.setPointAt(3, new AcGePoint3d(1, 1, 0))
    trace.thickness = 2
    trace.transformBy(SCALE)
    expectPointClose(trace.getPointAt(3), scaled(1, 1))
    expect(trace.thickness).toBeCloseTo(4, 8)
  })

  it('scales text height and keeps width factor and rotation', () => {
    const text = new AcDbText()
    text.position = new AcGePoint3d(1, 1, 0)
    text.alignmentPoint = new AcGePoint3d(3, 1, 0)
    text.height = 2.5
    text.widthFactor = 0.8
    text.rotation = Math.PI / 5
    text.transformBy(SCALE)

    expectPointClose(text.position, scaled(1, 1))
    expectPointClose(text.alignmentPoint, scaled(3, 1))
    expect(text.height).toBeCloseTo(5, 8)
    expect(text.widthFactor).toBeCloseTo(0.8, 8)
    expect(text.rotation).toBeCloseTo(Math.PI / 5, 8)
  })

  it('scales mtext height, defined width and column sizes', () => {
    const mtext = new AcDbMText()
    mtext.location = new AcGePoint3d(1, 1, 0)
    mtext.direction = new AcGeVector3d(1, 0, 0)
    mtext.height = 2
    mtext.width = 10
    mtext.annotationHeight = 6
    mtext.columnWidth = 4
    mtext.columnGutter = 1
    mtext.transformBy(SCALE)

    expectPointClose(mtext.location, scaled(1, 1))
    expectPointClose(mtext.direction, { x: 1, y: 0, z: 0 })
    expect(mtext.height).toBeCloseTo(4, 8)
    expect(mtext.width).toBeCloseTo(20, 8)
    expect(mtext.annotationHeight).toBeCloseTo(12, 8)
    expect(mtext.columnWidth).toBeCloseTo(8, 8)
    expect(mtext.columnGutter).toBeCloseTo(2, 8)
  })

  it('scales explicit hatch definition lines with the boundary', () => {
    createWorkingDb()
    const hatch = new AcDbHatch()
    // Imported (custom / user-defined) hatches carry explicit lines.
    hatch.patternType = AcDbHatchPatternType.Custom
    hatch.patternScale = 1
    hatch.add(
      new AcGePolyline2d(
        [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 0, y: 4 }
        ],
        true
      )
    )
    // Explicit lines are already expanded (angle, origin and offsets in WCS).
    hatch.definitionLines.push({
      angle: Math.PI / 4,
      base: { x: 1, y: 2 },
      offset: { x: -0.5, y: 0.5 },
      dashLengths: [1, -0.5]
    })
    hatch.transformBy(SCALE)

    expect(hatch.patternScale).toBeCloseTo(2, 8)
    const line = hatch.definitionLines[0]
    expect(line.angle).toBeCloseTo(Math.PI / 4, 8)
    expectPointClose(line.base, scaled(1, 2))
    expectPointClose(line.offset, { x: -1, y: 1 })
    expect(line.dashLengths[0]).toBeCloseTo(2, 8)
    expect(line.dashLengths[1]).toBeCloseTo(-1, 8)

    hatch.transformBy(new AcGeMatrix3d().makeRotationZ(Math.PI / 2))
    const rotated = hatch.definitionLines[0]
    expect(rotated.angle).toBeCloseTo((3 * Math.PI) / 4, 8)
    expectPointClose(rotated.offset, { x: -1, y: -1 })
  })

  it('preserves negative block scale factors and scales attributes', () => {
    const blockRef = new AcDbBlockReference('TEST')
    blockRef.position = new AcGePoint3d(1, 1, 0)
    blockRef.rotation = Math.PI / 6
    blockRef.scaleFactors = new AcGePoint3d(-1, 2, 1)
    blockRef.transformBy(SCALE)

    expectPointClose(blockRef.position, scaled(1, 1))
    expect(blockRef.rotation).toBeCloseTo(Math.PI / 6, 8)
    expectPointClose(blockRef.scaleFactors, { x: -2, y: 4, z: 2 })
    expectPointClose(blockRef.normal, { x: 0, y: 0, z: 1 })

    blockRef.transformBy(makeRotateAbout(BASE, Math.PI / 2))
    expect(blockRef.rotation).toBeCloseTo(Math.PI / 6 + Math.PI / 2, 8)
    expectPointClose(blockRef.scaleFactors, { x: -2, y: 4, z: 2 })
  })

  it('keeps leader normal and horizontal direction unit length', () => {
    const leader = new AcDbLeader()
    leader.appendVertex(new AcGePoint3d(0, 0, 0))
    leader.appendVertex(new AcGePoint3d(2, 2, 0))
    leader.textHeight = 2.5
    leader.textWidth = 10
    leader.transformBy(SCALE)

    expectPointClose(leader.vertices[1], scaled(2, 2))
    expectPointClose(leader.normal, { x: 0, y: 0, z: 1 })
    expect(len(leader.horizontalDirection)).toBeCloseTo(1, 8)
    expect(leader.textHeight).toBeCloseTo(5, 8)
    expect(leader.textWidth).toBeCloseTo(20, 8)
  })

  it('scales multileader content, landing and arrow sizes', () => {
    const mleader = new AcDbMLeader()
    const leaderIndex = mleader.addLeader({
      doglegVector: new AcGeVector3d(1, 0, 0),
      doglegLength: 2
    })
    mleader.addLeaderLine(leaderIndex, [
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(2, 2, 0)
    ])
    mleader.textHeight = 2.5
    mleader.arrowheadSize = 1
    mleader.landingGap = 0.5
    mleader.doglegLength = 2
    mleader.blockContentScale = new AcGeVector3d(1, 1, 1)
    mleader.transformBy(makeRotateAbout(BASE, Math.PI / 2))
    mleader.transformBy(SCALE)

    expectPointClose(mleader.normal, { x: 0, y: 0, z: 1 })
    expect(len(mleader.textDirection)).toBeCloseTo(1, 8)
    expect(len(mleader.doglegVector)).toBeCloseTo(1, 8)
    expect(len(mleader.leaders[0].doglegVector!)).toBeCloseTo(1, 8)
    expect(mleader.leaders[0].doglegLength).toBeCloseTo(4, 8)
    expect(mleader.textHeight).toBeCloseTo(5, 8)
    expect(mleader.arrowheadSize).toBeCloseTo(2, 8)
    expect(mleader.landingGap).toBeCloseTo(1, 8)
    expect(mleader.doglegLength).toBeCloseTo(4, 8)
    expectPointClose(mleader.blockContentScale!, { x: 2, y: 2, z: 2 })
  })

  it('scales multiline scale and element parameters', () => {
    const mline = new AcDbMLine()
    mline.scale = 1
    mline.appendSegment({
      position: new AcGePoint3d(0, 0, 0),
      direction: new AcGeVector3d(1, 0, 0),
      miterDirection: new AcGeVector3d(0, 1, 0),
      elements: [{ parameters: [0.5, 1], fillParameters: [0.25] }]
    })
    mline.transformBy(SCALE)

    expect(mline.scale).toBeCloseTo(2, 8)
    const segment = mline.segments[0]
    expectPointClose(segment.position, scaled(0, 0))
    expect(len(segment.direction)).toBeCloseTo(1, 8)
    expect(len(segment.miterDirection)).toBeCloseTo(1, 8)
    expect(len(mline.normal)).toBeCloseTo(1, 8)
    expect(segment.elements![0].parameters).toEqual([1, 2])
    expect(segment.elements![0].fillParameters).toEqual([0.5])
  })

  it('rotates the raster image boundary about its insertion point', () => {
    const image = new AcDbRasterImage()
    image.position = new AcGePoint3d(1, 1, 0)
    image.width = 4
    image.height = 2
    image.transformBy(makeRotateAbout(new AcGePoint3d(1, 1, 0), -Math.PI / 2))

    const boundary = image.subGetGripPoints()
    expectPointClose(boundary[0], { x: 1, y: 1 })
    expectPointClose(boundary[1], { x: 1, y: -3 })
    expectPointClose(boundary[2], { x: 3, y: -3 })
    expectPointClose(boundary[3], { x: 3, y: 1 })
  })

  it('scales the dimension block and refreshes the measurement', () => {
    createWorkingDb()
    const dimension = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(4, 0, 0),
      new AcGePoint3d(2, 1, 0)
    )
    dimension.textPosition = new AcGePoint3d(2, 1.5, 0)
    dimension.measurement = 4
    dimension.transformBy(SCALE)

    expectPointClose(dimension.xLine1Point, scaled(0, 0))
    expectPointClose(dimension.xLine2Point, scaled(4, 0))
    expectPointClose(dimension.dimLinePoint, scaled(2, 1))
    expectPointClose(dimension.textPosition, scaled(2, 1.5))
    expect(dimension.measurement).toBeCloseTo(8, 8)

    // Cached block geometry (authored in WCS) must land on the scaled points.
    const blockTransform = (
      dimension as unknown as {
        getFullDimBlockTransform(): AcGeMatrix3d
      }
    ).getFullDimBlockTransform()
    expectPointClose(
      new AcGePoint3d(4, 0, 0).applyMatrix4(blockTransform),
      scaled(4, 0)
    )
  })

  it('scales the radial dimension leader length', () => {
    const dimension = new AcDbRadialDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(2, 0, 0),
      1
    )
    dimension.transformBy(SCALE)
    expectPointClose(dimension.center, scaled(0, 0))
    expectPointClose(dimension.chordPoint, scaled(2, 0))
    expect(dimension.leaderLength).toBeCloseTo(2, 8)
  })
})
