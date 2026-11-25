import {
  AcGePoint2d,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import { AcDbArc } from '../src/entity/AcDbArc'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbCircle } from '../src/entity/AcDbCircle'
import { AcDbPolyline } from '../src/entity/AcDbPolyline'

describe('AcDb stretch protocol', () => {
  it('circle stretch points are center only and move the circle', () => {
    const circle = new AcDbCircle(new AcGePoint3d(5, 5, 0), 2)
    const stretchPoints = circle.subGetStretchPoints()
    expect(stretchPoints).toHaveLength(1)
    expect(stretchPoints[0]).toMatchObject({ x: 5, y: 5, z: 0 })

    circle.subMoveStretchPointsAt([0], new AcGeVector3d(3, -1, 0))
    expect(circle.center).toMatchObject({ x: 8, y: 4, z: 0 })
    expect(circle.radius).toBe(2)
  })

  it('polyline stretch points exclude segment midpoints', () => {
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0))
    pline.addVertexAt(1, new AcGePoint2d(10, 0))
    pline.addVertexAt(2, new AcGePoint2d(10, 10))

    const stretchPoints = pline.subGetStretchPoints()
    expect(stretchPoints).toHaveLength(3)

    pline.subMoveStretchPointsAt([2], new AcGeVector3d(0, 5, 0))
    expect(pline.getPoint3dAt(0)).toMatchObject({ x: 0, y: 0 })
    expect(pline.getPoint3dAt(1)).toMatchObject({ x: 10, y: 0 })
    expect(pline.getPoint3dAt(2)).toMatchObject({ x: 10, y: 15 })
  })

  it('block reference stretch point is the insertion point', () => {
    const blockRef = new AcDbBlockReference('TEST')
    blockRef.position = new AcGePoint3d(1, 2, 0)
    const stretchPoints = blockRef.subGetStretchPoints()
    expect(stretchPoints).toHaveLength(1)
    expect(stretchPoints[0]).toMatchObject({ x: 1, y: 2, z: 0 })

    blockRef.subMoveStretchPointsAt([0], new AcGeVector3d(4, 0, 0))
    expect(blockRef.position).toMatchObject({ x: 5, y: 2, z: 0 })
  })

  it('arc translates when the center stretch point is included', () => {
    const arc = new AcDbArc(new AcGePoint3d(0, 0, 0), 10, 0, Math.PI / 2)
    const startAngle = arc.startAngle
    const endAngle = arc.endAngle

    arc.subMoveStretchPointsAt([0, 1], new AcGeVector3d(4, 2, 0))

    expect(arc.center).toMatchObject({ x: 4, y: 2, z: 0 })
    expect(arc.radius).toBe(10)
    expect(arc.startAngle).toBeCloseTo(startAngle)
    expect(arc.endAngle).toBeCloseTo(endAngle)
  })

  it('arc reshapes when only endpoints are stretched', () => {
    const arc = new AcDbArc(new AcGePoint3d(0, 0, 0), 10, 0, Math.PI / 2)
    const center = arc.center.clone()

    arc.subMoveStretchPointsAt([1], new AcGeVector3d(0, 5, 0))

    expect(arc.center).toMatchObject({ x: center.x, y: center.y, z: center.z })
    expect(arc.startAngle).not.toBeCloseTo(0)
  })
})
