import { AcCmColor } from '@mlightcad/common'
import {
  AcGePoint2d,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import { AcDbDatabase } from '../src/database'
import {
  AcDb2dPolyline,
  AcDb3dPolyline,
  AcDbArc,
  AcDbCircle,
  AcDbCurve,
  AcDbEllipse,
  AcDbLeader,
  AcDbLine,
  AcDbPoly2dType,
  AcDbPoly3dType,
  AcDbPolyline,
  AcDbRay,
  AcDbSpline,
  AcDbXline
} from '../src/entity'

type PointLike = { x: number; y: number; z?: number }

const expectPoint = (
  actual: PointLike | undefined,
  expected: PointLike,
  digits = 6
) => {
  expect(actual).toBeDefined()
  expect(actual!.x).toBeCloseTo(expected.x, digits)
  expect(actual!.y).toBeCloseTo(expected.y, digits)
  expect(actual!.z ?? 0).toBeCloseTo(expected.z ?? 0, digits)
}

const curveStart = (curve: AcDbCurve) =>
  curve.getPointAtParam(curve.startParam)!
const curveEnd = (curve: AcDbCurve) => curve.getPointAtParam(curve.endParam)!

const createPolyline = (
  points: [number, number, number?, number?, number?][],
  closed = false
) => {
  const pline = new AcDbPolyline()
  points.forEach(([x, y, bulge = 0, sw = -1, ew = -1], i) =>
    pline.addVertexAt(i, new AcGePoint2d(x, y), bulge, sw, ew)
  )
  pline.closed = closed
  return pline
}

const plineVertices = (pline: AcDbPolyline) =>
  Array.from({ length: pline.numberOfVertices }, (_, i) => ({
    point: pline.getPoint2dAt(i),
    bulge: pline.getBulgeAt(i)
  }))

describe('AcDbCurve parameter / split / extend defaults', () => {
  it('reports unsupported curves safely', () => {
    const leader = new AcDbLeader()
    expect(leader.startParam).toBe(0)
    expect(leader.endParam).toBe(0)
    expect(leader.getParamAtPoint({ x: 0, y: 0, z: 0 })).toBeUndefined()
    expect(leader.getPointAtParam(0)).toBeUndefined()
    expect(leader.getClosestPointTo({ x: 0, y: 0, z: 0 })).toBeUndefined()
    expect(leader.getDistAtParam(0)).toBeUndefined()
    expect(leader.getSplitCurves([0.5])).toEqual([])
    expect(leader.getSplitCurvesAtPoints([{ x: 0, y: 0, z: 0 }])).toEqual([])
    expect(leader.extend(1)).toBe(false)
    expect(leader.extendToPoint(true, { x: 0, y: 0, z: 0 })).toBe(false)
  })
})

describe('AcDbLine', () => {
  const create = () =>
    new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(10, 0, 0))

  it('maps parameters to distance from the start point', () => {
    const line = create()
    expect(line.startParam).toBe(0)
    expect(line.endParam).toBeCloseTo(10)
    expect(line.getParamAtPoint({ x: 4, y: 0, z: 0 })).toBeCloseTo(4)
    expect(line.getParamAtPoint({ x: -2, y: 0, z: 0 })).toBeCloseTo(-2)
    expect(line.getParamAtPoint({ x: 12, y: 0, z: 0 })).toBeCloseTo(12)
    expect(line.getParamAtPoint({ x: 4, y: 1, z: 0 })).toBeUndefined()
    expectPoint(line.getPointAtParam(4), { x: 4, y: 0, z: 0 })
    expect(line.getDistAtParam(4)).toBeCloseTo(4)
    expectPoint(line.getClosestPointTo({ x: 4, y: 3, z: 0 }), { x: 4, y: 0 })
    expectPoint(line.getClosestPointTo({ x: 15, y: 3, z: 0 }), { x: 10, y: 0 })
    expectPoint(line.getClosestPointTo({ x: 15, y: 3, z: 0 }, true), {
      x: 15,
      y: 0
    })
  })

  it('splits with one and two params into detached pieces', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    const line = create()
    line.layer = '0'
    line.color = new AcCmColor().setRGB(255, 0, 0)
    line.thickness = 2
    db.tables.blockTable.modelSpace.appendEntity(line)

    const one = line.getSplitCurves([4]) as AcDbLine[]
    expect(one).toHaveLength(2)
    expectPoint(one[0].startPoint, { x: 0, y: 0 })
    expectPoint(one[0].endPoint, { x: 4, y: 0 })
    expectPoint(one[1].startPoint, { x: 4, y: 0 })
    expectPoint(one[1].endPoint, { x: 10, y: 0 })
    for (const piece of one) {
      expect(piece).toBeInstanceOf(AcDbLine)
      expect(piece.objectId).not.toBe(line.objectId)
      expect(piece.isTemp).toBe(true)
      expect(piece.getAttrWithoutException('ownerId')).toBeUndefined()
      expect(piece.layer).toBe('0')
      expect(piece.color.red).toBe(255)
      expect(piece.thickness).toBe(2)
    }
    expect(db.tables.blockTable.getEntityById(one[0].objectId)).toBeUndefined()

    const two = line.getSplitCurves([7, 3, 3.0000000001]) as AcDbLine[]
    expect(two).toHaveLength(3)
    expectPoint(two[0].endPoint, { x: 3, y: 0 })
    expectPoint(two[1].endPoint, { x: 7, y: 0 })
    expectPoint(two[2].endPoint, { x: 10, y: 0 })

    expect(line.getSplitCurves([0, 10, -1, 12])).toEqual([])
  })

  it('splits at points and ignores points off the line', () => {
    const pieces = create().getSplitCurvesAtPoints([
      { x: 5, y: 0, z: 0 },
      { x: 5, y: 1, z: 0 }
    ])
    expect(pieces).toHaveLength(2)
  })

  it('extends the start and the end', () => {
    const line = create()
    expect(line.extend(5)).toBe(false)
    expect(line.extend(-5)).toBe(true)
    expectPoint(line.startPoint, { x: -5, y: 0 })
    expect(line.extend(20)).toBe(true)
    expectPoint(line.endPoint, { x: 15, y: 0 })
  })

  it('extends to points on the extension and rejects others', () => {
    const line = create()
    expect(line.extendToPoint(true, { x: 5, y: 0, z: 0 })).toBe(false)
    expect(line.extendToPoint(true, { x: 20, y: 0, z: 0 })).toBe(false)
    expect(line.extendToPoint(false, { x: 20, y: 1, z: 0 })).toBe(false)
    expectPoint(line.startPoint, { x: 0, y: 0 })
    expectPoint(line.endPoint, { x: 10, y: 0 })
    expect(line.extendToPoint(true, { x: -3, y: 0, z: 0 })).toBe(true)
    expect(line.extendToPoint(false, { x: 20, y: 0, z: 0 })).toBe(true)
    expectPoint(line.startPoint, { x: -3, y: 0 })
    expectPoint(line.endPoint, { x: 20, y: 0 })
  })
})

describe('AcDbArc', () => {
  const create = () => new AcDbArc(new AcGePoint3d(0, 0, 0), 10, 0, Math.PI / 2)

  it('uses angles as parameters', () => {
    const arc = create()
    expect(arc.startParam).toBeCloseTo(0)
    expect(arc.endParam).toBeCloseTo(Math.PI / 2)
    expect(arc.getParamAtPoint({ x: 0, y: 10, z: 0 })).toBeCloseTo(Math.PI / 2)
    expect(arc.getParamAtPoint({ x: -10, y: 0, z: 0 })).toBeCloseTo(Math.PI)
    expect(arc.getParamAtPoint({ x: 0, y: -10, z: 0 })).toBeCloseTo(
      (3 * Math.PI) / 2
    )
    expect(arc.getParamAtPoint({ x: 5, y: 5, z: 0 })).toBeUndefined()
    const p = arc.getPointAtParam(Math.PI / 4)!
    expect(arc.getParamAtPoint(p)).toBeCloseTo(Math.PI / 4)
    expect(arc.getDistAtParam(Math.PI / 2)).toBeCloseTo(5 * Math.PI)
    expectPoint(arc.getClosestPointTo({ x: 20, y: 20, z: 0 }), {
      x: Math.SQRT1_2 * 10,
      y: Math.SQRT1_2 * 10
    })
    expectPoint(arc.getClosestPointTo({ x: -20, y: -1, z: 0 }), {
      x: 0,
      y: 10
    })
    expectPoint(arc.getClosestPointTo({ x: -20, y: 0, z: 0 }, true), {
      x: -10,
      y: 0
    })
  })

  it('maps points of arcs crossing angle 0 into [start, start + 2π)', () => {
    const arc = new AcDbArc(
      new AcGePoint3d(0, 0, 0),
      10,
      (3 * Math.PI) / 2,
      Math.PI / 2
    )
    expect(arc.startParam).toBeCloseTo((3 * Math.PI) / 2)
    expect(arc.endParam).toBeCloseTo((5 * Math.PI) / 2)
    expect(arc.getParamAtPoint({ x: 10, y: 0, z: 0 })).toBeCloseTo(2 * Math.PI)
    const pieces = arc.getSplitCurves([2 * Math.PI]) as AcDbArc[]
    expect(pieces).toHaveLength(2)
    expectPoint(pieces[0].endPoint, { x: 10, y: 0 })
    expectPoint(pieces[1].startPoint, { x: 10, y: 0 })
    expectPoint(pieces[1].endPoint, { x: 0, y: 10 })
  })

  it('splits with one and two params', () => {
    const arc = create()
    const one = arc.getSplitCurves([Math.PI / 4]) as AcDbArc[]
    expect(one).toHaveLength(2)
    expect(one[0]).toBeInstanceOf(AcDbArc)
    expectPoint(one[0].startPoint, arc.startPoint)
    expectPoint(one[0].endPoint, arc.getPointAtParam(Math.PI / 4)!)
    expectPoint(one[1].endPoint, arc.endPoint)

    const two = arc.getSplitCurves([Math.PI / 3, Math.PI / 6]) as AcDbArc[]
    expect(two).toHaveLength(3)
    expect(two[0].endAngle).toBeCloseTo(Math.PI / 6)
    expect(two[1].startAngle).toBeCloseTo(Math.PI / 6)
    expect(two[1].endAngle).toBeCloseTo(Math.PI / 3)
    expect(two[2].endAngle).toBeCloseTo(Math.PI / 2)
    // Points beyond the arc end are ignored.
    expect(arc.getSplitCurves([Math.PI])).toEqual([])
  })

  it('extends the start and the end while staying below a full turn', () => {
    const arc = create()
    expect(arc.extend(Math.PI / 4)).toBe(false)
    expect(arc.extend(Math.PI)).toBe(true)
    expect(arc.endAngle).toBeCloseTo(Math.PI)
    expect(arc.extend(-Math.PI / 4)).toBe(true)
    expectPoint(arc.startPoint, {
      x: 10 * Math.SQRT1_2,
      y: -10 * Math.SQRT1_2
    })
    expect(arc.extend(-2 * Math.PI)).toBe(false)
  })

  it('extends to points on the circle and rejects others', () => {
    const arc = create()
    expect(arc.extendToPoint(false, { x: 11, y: 0, z: 0 })).toBe(false)
    expect(
      arc.extendToPoint(false, {
        x: 10 * Math.SQRT1_2,
        y: 10 * Math.SQRT1_2,
        z: 0
      })
    ).toBe(false)
    expect(arc.extendToPoint(false, { x: -10, y: 0, z: 0 })).toBe(true)
    expect(arc.endAngle).toBeCloseTo(Math.PI)
    expect(arc.extendToPoint(true, { x: 0, y: -10, z: 0 })).toBe(true)
    expect(arc.startAngle).toBeCloseTo((3 * Math.PI) / 2)
    expect(arc.endParam - arc.startParam).toBeCloseTo((3 * Math.PI) / 2)
  })
})

describe('AcDbCircle', () => {
  const create = () => {
    const circle = new AcDbCircle(new AcGePoint3d(1, 2, 0), 5)
    circle.layer = 'Walls'
    return circle
  }

  it('uses the polar angle in [0, 2π)', () => {
    const circle = create()
    expect(circle.startParam).toBe(0)
    expect(circle.endParam).toBeCloseTo(2 * Math.PI)
    expect(circle.getParamAtPoint({ x: 1, y: 7, z: 0 })).toBeCloseTo(
      Math.PI / 2
    )
    expect(circle.getParamAtPoint({ x: 6, y: 2, z: 0 })).toBe(0)
    expect(circle.getParamAtPoint({ x: 1, y: 2, z: 0 })).toBeUndefined()
    expectPoint(circle.getPointAtParam(Math.PI), { x: -4, y: 2 })
    expect(circle.getDistAtParam(Math.PI)).toBeCloseTo(5 * Math.PI)
    expect(circle.extend(1)).toBe(false)
  })

  it('needs two params and wraps the last piece through the seam', () => {
    const circle = create()
    expect(circle.getSplitCurves([Math.PI / 2])).toEqual([])
    const pieces = circle.getSplitCurves([Math.PI, Math.PI / 2]) as AcDbArc[]
    expect(pieces).toHaveLength(2)
    expect(pieces[0]).toBeInstanceOf(AcDbArc)
    expect(pieces[0].startAngle).toBeCloseTo(Math.PI / 2)
    expect(pieces[0].endAngle).toBeCloseTo(Math.PI)
    expect(pieces[1].startAngle).toBeCloseTo(Math.PI)
    expect(pieces[1].endAngle).toBeCloseTo(Math.PI / 2)
    expect(pieces[1].endParam - pieces[1].startParam).toBeCloseTo(
      (3 * Math.PI) / 2
    )
    expect(pieces[1].layer).toBe('Walls')

    const three = circle.getSplitCurvesAtPoints([
      { x: 6, y: 2, z: 0 },
      { x: 1, y: 7, z: 0 },
      { x: -4, y: 2, z: 0 }
    ]) as AcDbArc[]
    expect(three).toHaveLength(3)
    expect(three[0].startAngle).toBeCloseTo(0)
    expect(three[2].startAngle).toBeCloseTo(Math.PI)
    expect(three[2].endAngle).toBeCloseTo(0)
  })
})

describe('AcDbEllipse', () => {
  const create = (start = 0, end = 2 * Math.PI) =>
    new AcDbEllipse(
      new AcGePoint3d(0, 0, 0),
      AcGeVector3d.Z_AXIS,
      AcGeVector3d.X_AXIS,
      10,
      5,
      start,
      end
    )

  it('uses the parametric angle', () => {
    const ellipse = create()
    expect(ellipse.closed).toBe(true)
    expect(ellipse.startParam).toBe(0)
    expect(ellipse.endParam).toBeCloseTo(2 * Math.PI)
    expect(ellipse.getParamAtPoint({ x: 0, y: 5, z: 0 })).toBeCloseTo(
      Math.PI / 2
    )
    const p = ellipse.getPointAtParam(1)!
    expectPoint(p, { x: 10 * Math.cos(1), y: 5 * Math.sin(1) })
    expect(ellipse.getParamAtPoint(p)).toBeCloseTo(1, 8)
    expect(ellipse.getParamAtPoint({ x: 3, y: 3, z: 0 })).toBeUndefined()
    const quarter = ellipse.getDistAtParam(Math.PI / 2)!
    // Quarter perimeter of a 10 x 5 ellipse.
    expect(quarter).toBeCloseTo(12.110560271, 5)
    expectPoint(ellipse.getClosestPointTo({ x: 0, y: 20, z: 0 }), {
      x: 0,
      y: 5
    })
  })

  it('splits a full ellipse following the closed rules', () => {
    const ellipse = create()
    expect(ellipse.getSplitCurves([1])).toEqual([])
    const pieces = ellipse.getSplitCurves([2, 1]) as AcDbEllipse[]
    expect(pieces).toHaveLength(2)
    expect(pieces[0]).toBeInstanceOf(AcDbEllipse)
    expect(pieces[0].startAngle).toBeCloseTo(1)
    expect(pieces[0].endAngle).toBeCloseTo(2)
    expect(pieces[1].startAngle).toBeCloseTo(2)
    expect(pieces[1].endAngle).toBeCloseTo(1)
    expectPoint(curveStart(pieces[1]), ellipse.getPointAtParam(2)!)
    expectPoint(curveEnd(pieces[1]), ellipse.getPointAtParam(1)!)
    expect(ellipse.extend(1)).toBe(false)
  })

  it('splits and extends elliptical arcs', () => {
    const arc = create(0, Math.PI)
    expect(arc.closed).toBe(false)
    const outside = arc.getPointAtParam((3 * Math.PI) / 2)!
    expect(arc.getParamAtPoint(outside)).toBeCloseTo((3 * Math.PI) / 2)
    const pieces = arc.getSplitCurves([1]) as AcDbEllipse[]
    expect(pieces).toHaveLength(2)
    expect(pieces[0].endAngle).toBeCloseTo(1)

    expect(arc.extend(4)).toBe(true)
    expect(arc.endAngle).toBeCloseTo(4)
    const target = arc.getPointAtParam(-0.5)!
    expect(arc.extendToPoint(true, { x: 20, y: 0, z: 0 })).toBe(false)
    expect(arc.extendToPoint(true, target)).toBe(true)
    expect(arc.startAngle).toBeCloseTo(2 * Math.PI - 0.5)
    expectPoint(arc.getPointAtParam(arc.startParam), target)
  })
})

describe('AcDbPolyline', () => {
  // (0,0) -> (10,0) line with widths 1 -> 2, (10,0) -> (10,10) CCW semicircle
  // through (15,5), (10,10) -> (0,10) line.
  const create = () =>
    createPolyline([
      [0, 0, 0, 1, 2],
      [10, 0, 1, 2, 2],
      [10, 10, 0, 2, 2],
      [0, 10, 0, 2, 2]
    ])

  it('uses vertex index + fraction as parameter', () => {
    const pline = create()
    expect(pline.startParam).toBe(0)
    expect(pline.endParam).toBe(3)
    expectPoint(pline.getPointAtParam(0.5), { x: 5, y: 0 })
    expectPoint(pline.getPointAtParam(1.5), { x: 15, y: 5 })
    expect(pline.getParamAtPoint({ x: 15, y: 5, z: 0 })).toBeCloseTo(1.5)
    expect(pline.getParamAtPoint({ x: 5, y: 10, z: 0 })).toBeCloseTo(2.5)
    expect(pline.getParamAtPoint({ x: 5, y: 5, z: 0 })).toBeUndefined()
    // Extensions of the first and last segments.
    expect(pline.getParamAtPoint({ x: -2, y: 0, z: 0 })).toBeCloseTo(-0.2)
    expect(pline.getParamAtPoint({ x: -5, y: 10, z: 0 })).toBeCloseTo(3.5)
    expectPoint(pline.getPointAtParam(-0.2), { x: -2, y: 0 })
    expect(pline.getDistAtParam(2)).toBeCloseTo(10 + 5 * Math.PI)
    expect(pline.getDistAtParam(2.5)).toBeCloseTo(15 + 5 * Math.PI)
    expectPoint(pline.getClosestPointTo({ x: 20, y: 5, z: 0 }), {
      x: 15,
      y: 5
    })
    expectPoint(pline.getClosestPointTo({ x: -5, y: 1, z: 0 }), { x: 0, y: 0 })
    expectPoint(pline.getClosestPointTo({ x: -5, y: 1, z: 0 }, true), {
      x: -5,
      y: 0
    })
  })

  it('splits keeping bulges and interpolated widths', () => {
    const pline = create()
    const one = pline.getSplitCurves([0.5]) as AcDbPolyline[]
    expect(one).toHaveLength(2)
    expect(one[0].numberOfVertices).toBe(2)
    expect(one[0].getStartWidthAt(0)).toBeCloseTo(1)
    expect(one[0].getEndWidthAt(0)).toBeCloseTo(1.5)
    expect(one[1].getStartWidthAt(0)).toBeCloseTo(1.5)
    expect(one[1].getEndWidthAt(0)).toBeCloseTo(2)
    expect(one[1].getBulgeAt(1)).toBeCloseTo(1)

    const pieces = pline.getSplitCurves([1.5, 0.5]) as AcDbPolyline[]
    expect(pieces).toHaveLength(3)
    const middle = plineVertices(pieces[1])
    expect(middle).toHaveLength(3)
    expectPoint({ ...middle[0].point, z: 0 }, { x: 5, y: 0 })
    expectPoint({ ...middle[1].point, z: 0 }, { x: 10, y: 0 })
    expectPoint({ ...middle[2].point, z: 0 }, { x: 15, y: 5 })
    expect(middle[1].bulge).toBeCloseTo(Math.tan(Math.PI / 8))
    const last = plineVertices(pieces[2])
    expect(last[0].bulge).toBeCloseTo(Math.tan(Math.PI / 8))
    expectPoint({ ...last[1].point, z: 0 }, { x: 10, y: 10 })
    expectPoint({ ...last[2].point, z: 0 }, { x: 0, y: 10 })
    const total = pieces.reduce(
      (sum, piece) => sum + piece.getDistAtParam(piece.endParam)!,
      0
    )
    expect(total).toBeCloseTo(pline.getDistAtParam(3)!)
  })

  it('keeps elevation and normal', () => {
    const pline = create()
    pline.elevation = 3
    pline.normal = new AcGeVector3d(0, 0, -1)
    const p = pline.getPointAtParam(0.5)!
    expect(pline.getParamAtPoint(p)).toBeCloseTo(0.5)
    const pieces = pline.getSplitCurves([0.5]) as AcDbPolyline[]
    expect(pieces[0].elevation).toBe(3)
    expect(pieces[0].normal.z).toBe(-1)
    expectPoint(curveEnd(pieces[0]), p)
  })

  it('wraps the last piece of a closed polyline through the seam', () => {
    const square = createPolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ],
      true
    )
    expect(square.endParam).toBe(4)
    expect(square.getSplitCurves([1])).toEqual([])
    const pieces = square.getSplitCurves([2.5, 0.5]) as AcDbPolyline[]
    expect(pieces).toHaveLength(2)
    const first = plineVertices(pieces[0]).map(v => [v.point.x, v.point.y])
    const second = plineVertices(pieces[1]).map(v => [v.point.x, v.point.y])
    expect(first).toEqual([
      [5, 0],
      [10, 0],
      [10, 10],
      [5, 10]
    ])
    expect(second).toEqual([
      [5, 10],
      [0, 10],
      [0, 0],
      [5, 0]
    ])
    expect(pieces[1].closed).toBe(false)
    expect(square.extend(-1)).toBe(false)
  })

  it('extends line end segments', () => {
    const pline = createPolyline([
      [0, 0],
      [10, 0],
      [10, 10]
    ])
    expect(pline.extend(1)).toBe(false)
    expect(pline.extend(-0.5)).toBe(true)
    expectPoint(pline.getPoint3dAt(0), { x: -5, y: 0 })
    expect(pline.extend(2.5)).toBe(true)
    expectPoint(pline.getPoint3dAt(2), { x: 10, y: 15 })
    expect(pline.extendToPoint(false, { x: 12, y: 20, z: 0 })).toBe(false)
    expect(pline.extendToPoint(false, { x: 10, y: 5, z: 0 })).toBe(false)
    expect(pline.extendToPoint(true, { x: 20, y: 0, z: 0 })).toBe(false)
    expect(pline.extendToPoint(false, { x: 10, y: 20, z: 0 })).toBe(true)
    expectPoint(pline.getPoint3dAt(2), { x: 10, y: 20 })
    expect(pline.extendToPoint(true, { x: -8, y: 0, z: 0 })).toBe(true)
    expectPoint(pline.getPoint3dAt(0), { x: -8, y: 0 })
  })

  it('extends arc end segments keeping center and radius', () => {
    // Quarter arc from (10,0) to (20,10) around (10,10).
    const quarter = Math.tan(Math.PI / 8)
    const pline = createPolyline([
      [0, 0],
      [10, 0, quarter],
      [20, 10]
    ])
    expect(pline.extendToPoint(false, { x: 25, y: 25, z: 0 })).toBe(false)
    expect(pline.extendToPoint(false, { x: 10, y: 20, z: 0 })).toBe(true)
    expectPoint(pline.getPoint3dAt(2), { x: 10, y: 20 })
    expect(pline.getBulgeAt(1)).toBeCloseTo(1)

    const startArc = createPolyline([
      [20, 10, -quarter],
      [10, 0],
      [0, 0]
    ])
    expect(startArc.extendToPoint(true, { x: 10, y: 20, z: 0 })).toBe(true)
    expectPoint(startArc.getPoint3dAt(0), { x: 10, y: 20 })
    expect(startArc.getBulgeAt(0)).toBeCloseTo(-1)
    expect(startArc.extend(-3)).toBe(false)
  })

  it('extends past duplicated end vertices (zero-length end segments)', () => {
    const pline = createPolyline([
      [0, 0],
      [0, 0],
      [10, 0],
      [10, 10],
      [10, 10]
    ])
    expect(pline.getParamAtPoint({ x: -5, y: 0, z: 0 })).toBeCloseTo(-0.5)
    expectPoint(pline.getPointAtParam(-0.5), { x: -5, y: 0 })
    expect(pline.getDistAtParam(-0.5)).toBeCloseTo(-5)
    expect(pline.getParamAtPoint({ x: 10, y: 15, z: 0 })).toBeCloseTo(4.5)
    expectPoint(pline.getPointAtParam(4.5), { x: 10, y: 15 })
    expect(pline.getDistAtParam(4.5)).toBeCloseTo(25)
    expectPoint(pline.getClosestPointTo({ x: -5, y: 1, z: 0 }, true), {
      x: -5,
      y: 0
    })

    expect(pline.extendToPoint(true, { x: -5, y: 0, z: 0 })).toBe(true)
    expectPoint(pline.getPoint3dAt(0), { x: -5, y: 0 })
    expect(pline.extendToPoint(false, { x: 10, y: 15, z: 0 })).toBe(true)
    expectPoint(pline.getPoint3dAt(4), { x: 10, y: 15 })
    expect(pline.getDistAtParam(pline.endParam)).toBeCloseTo(30)

    // Arc end segment followed by a duplicated vertex.
    const quarter = Math.tan(Math.PI / 8)
    const arc = createPolyline([
      [0, 0],
      [10, 0, quarter],
      [20, 10],
      [20, 10]
    ])
    expect(arc.extendToPoint(false, { x: 10, y: 20, z: 0 })).toBe(true)
    expectPoint(arc.getPoint3dAt(3), { x: 10, y: 20 })
    expectPoint(arc.getPointAtParam(2.5), {
      x: 10 + 10 * Math.cos(Math.PI / 4),
      y: 10 + 10 * Math.sin(Math.PI / 4)
    })
    expect(arc.getDistAtParam(arc.endParam)).toBeCloseTo(10 + 10 * Math.PI)
  })

  it('drops zero-length segments from split pieces', () => {
    const pline = createPolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 0]
      ],
      true
    )
    const pieces = pline.getSplitCurves([0.5, 1.5]) as AcDbPolyline[]
    expect(pieces).toHaveLength(2)
    expect(plineVertices(pieces[1]).map(v => [v.point.x, v.point.y])).toEqual([
      [10, 5],
      [10, 10],
      [0, 0],
      [5, 0]
    ])
  })
})

describe('AcDb2dPolyline', () => {
  it('splits into AcDb2dPolyline pieces keeping bulges and type', () => {
    const pline = new AcDb2dPolyline(
      AcDbPoly2dType.SimplePoly,
      [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 10, z: 0 }
      ],
      2,
      false,
      0,
      0,
      [0, 1, 0]
    )
    expect(pline.endParam).toBe(2)
    expect(pline.getParamAtPoint({ x: 15, y: 5, z: 2 })).toBeCloseTo(1.5)
    const pieces = pline.getSplitCurves([1.5]) as AcDb2dPolyline[]
    expect(pieces).toHaveLength(2)
    expect(pieces[0]).toBeInstanceOf(AcDb2dPolyline)
    expect(pieces[0].polyType).toBe(AcDbPoly2dType.SimplePoly)
    expect(pieces[0].elevation).toBe(2)
    expect(pieces[0].getBulgeAt(1)).toBeCloseTo(Math.tan(Math.PI / 8))
    expect(pieces[1].getBulgeAt(0)).toBeCloseTo(Math.tan(Math.PI / 8))
    expectPoint(curveEnd(pieces[0]), { x: 15, y: 5, z: 2 })

    expect(pline.extend(-0.5)).toBe(true)
    expect(pline.getPointAt(0).x).toBeCloseTo(-5)
  })
})

describe('AcDb3dPolyline', () => {
  it('uses straight 3D segments', () => {
    const pline = new AcDb3dPolyline(AcDbPoly3dType.SimplePoly, [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 10 },
      { x: 10, y: 10, z: 10 }
    ])
    expect(pline.endParam).toBe(2)
    expect(pline.getParamAtPoint({ x: 5, y: 0, z: 5 })).toBeCloseTo(0.5)
    expect(pline.getParamAtPoint({ x: 5, y: 0, z: 0 })).toBeUndefined()
    const pieces = pline.getSplitCurves([0.5]) as AcDb3dPolyline[]
    expect(pieces).toHaveLength(2)
    expectPoint(pieces[0].getPointAt(1), { x: 5, y: 0, z: 5 })
    expectPoint(pieces[1].getPointAt(2), { x: 10, y: 10, z: 10 })
    expect(pline.extend(-1)).toBe(true)
    expectPoint(pline.getPointAt(0), { x: -10, y: 0, z: -10 })
    expect(pline.extendToPoint(false, { x: 10, y: 15, z: 10 })).toBe(true)
    expectPoint(pline.getPointAt(2), { x: 10, y: 15, z: 10 })
  })
})

describe('AcDbRay', () => {
  const create = () => {
    const ray = new AcDbRay()
    ray.basePoint = new AcGePoint3d(1, 1, 0)
    ray.unitDir = new AcGePoint3d(1, 0, 0)
    return ray
  }

  it('splits into lines followed by a ray', () => {
    const ray = create()
    expect(ray.startParam).toBe(0)
    expect(ray.endParam).toBe(Infinity)
    expect(ray.getParamAtPoint({ x: 5, y: 1, z: 0 })).toBeCloseTo(4)
    expect(ray.getParamAtPoint({ x: 5, y: 2, z: 0 })).toBeUndefined()
    expect(ray.getDistAtParam(4)).toBe(4)
    const pieces = ray.getSplitCurves([5, 2, -1])
    expect(pieces).toHaveLength(3)
    expect(pieces[0]).toBeInstanceOf(AcDbLine)
    expect(pieces[1]).toBeInstanceOf(AcDbLine)
    expect(pieces[2]).toBeInstanceOf(AcDbRay)
    expectPoint((pieces[0] as AcDbLine).startPoint, { x: 1, y: 1 })
    expectPoint((pieces[0] as AcDbLine).endPoint, { x: 3, y: 1 })
    expectPoint((pieces[1] as AcDbLine).endPoint, { x: 6, y: 1 })
    expectPoint((pieces[2] as AcDbRay).basePoint, { x: 6, y: 1 })
    expect(ray.extend(-1)).toBe(false)
    expect(ray.extendToPoint(true, { x: -5, y: 1, z: 0 })).toBe(false)
  })
})

describe('AcDbXline', () => {
  it('splits into backward ray, lines and forward ray', () => {
    const xline = new AcDbXline()
    xline.basePoint = new AcGePoint3d(0, 0, 0)
    xline.unitDir = new AcGePoint3d(0, 1, 0)
    expect(xline.startParam).toBe(-Infinity)
    expect(xline.endParam).toBe(Infinity)
    expect(xline.getParamAtPoint({ x: 0, y: -3, z: 0 })).toBeCloseTo(-3)
    const pieces = xline.getSplitCurves([4, -3])
    expect(pieces).toHaveLength(3)
    const back = pieces[0] as AcDbRay
    const line = pieces[1] as AcDbLine
    const forward = pieces[2] as AcDbRay
    expect(back).toBeInstanceOf(AcDbRay)
    expectPoint(back.basePoint, { x: 0, y: -3 })
    expectPoint(back.unitDir, { x: 0, y: -1 })
    expect(line).toBeInstanceOf(AcDbLine)
    expectPoint(line.startPoint, { x: 0, y: -3 })
    expectPoint(line.endPoint, { x: 0, y: 4 })
    expectPoint(forward.basePoint, { x: 0, y: 4 })
    expectPoint(forward.unitDir, { x: 0, y: 1 })
    expect(xline.getSplitCurves([1])).toHaveLength(2)
    expect(xline.extend(5)).toBe(false)
  })
})

describe('AcDbSpline', () => {
  const create = (weights?: number[]) =>
    new AcDbSpline(
      [
        { x: 0, y: 0, z: 0 },
        { x: 3, y: 5, z: 0 },
        { x: 7, y: -5, z: 0 },
        { x: 10, y: 0, z: 0 }
      ],
      [0, 0, 0, 0, 1, 1, 1, 1],
      weights,
      3,
      false
    )

  it('round-trips knot parameters', () => {
    const spline = create()
    expect(spline.startParam).toBe(0)
    expect(spline.endParam).toBe(1)
    const p = spline.getPointAtParam(0.3)!
    expect(spline.getParamAtPoint(p)).toBeCloseTo(0.3, 7)
    expect(spline.getParamAtPoint({ x: 5, y: 10, z: 0 })).toBeUndefined()
    expect(spline.getDistAtParam(1)).toBeCloseTo(
      spline.getDistAtParam(0.3)! +
        spline.getSplitCurves([0.3])[1].getDistAtParam(1)!,
      3
    )
    expect(spline.extend(2)).toBe(false)
    expect(spline.extendToPoint(false, { x: 20, y: 0, z: 0 })).toBe(false)
  })

  it('splits by knot insertion with matching endpoints', () => {
    for (const weights of [undefined, [1, 2, 0.5, 1]]) {
      const spline = create(weights)
      const one = spline.getSplitCurves([0.3]) as AcDbSpline[]
      expect(one).toHaveLength(2)
      expectPoint(curveStart(one[0]), curveStart(spline))
      expectPoint(curveEnd(one[0]), spline.getPointAtParam(0.3)!)
      expectPoint(curveStart(one[1]), spline.getPointAtParam(0.3)!)
      expectPoint(curveEnd(one[1]), curveEnd(spline))
      // Same geometry: the pieces keep the original parameterization.
      expectPoint(one[0].getPointAtParam(0.15), spline.getPointAtParam(0.15)!)
      expectPoint(one[1].getPointAtParam(0.8), spline.getPointAtParam(0.8)!)

      const two = spline.getSplitCurves([0.7, 0.2]) as AcDbSpline[]
      expect(two).toHaveLength(3)
      expectPoint(curveEnd(two[0]), spline.getPointAtParam(0.2)!)
      expectPoint(curveStart(two[1]), spline.getPointAtParam(0.2)!)
      expectPoint(two[1].getPointAtParam(0.5), spline.getPointAtParam(0.5)!)
      expectPoint(curveEnd(two[1]), spline.getPointAtParam(0.7)!)
      expectPoint(curveEnd(two[2]), curveEnd(spline))
    }
  })

  it('splits closed splines wrapping through the seam', () => {
    const spline = new AcDbSpline(
      [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 10, z: 0 },
        { x: 0, y: 10, z: 0 }
      ],
      'Uniform',
      3,
      true
    )
    expect(spline.closed).toBe(true)
    const { startParam, endParam } = spline
    const span = endParam - startParam
    const a = startParam + span * 0.25
    const b = startParam + span * 0.6
    expect(spline.getSplitCurves([a])).toEqual([])
    const pieces = spline.getSplitCurves([b, a]) as AcDbSpline[]
    expect(pieces).toHaveLength(2)
    expectPoint(curveStart(pieces[0]), spline.getPointAtParam(a)!, 5)
    expectPoint(curveEnd(pieces[0]), spline.getPointAtParam(b)!, 5)
    expectPoint(curveStart(pieces[1]), spline.getPointAtParam(b)!, 5)
    expectPoint(curveEnd(pieces[1]), spline.getPointAtParam(a)!, 5)
    // The wrap piece passes through the original seam point.
    const seam = curveStart(spline)
    expect(pieces[1].getParamAtPoint(seam)).toBeDefined()
    expect(pieces[0].getParamAtPoint(seam)).toBeUndefined()
  })
})
