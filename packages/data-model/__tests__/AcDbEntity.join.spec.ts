import { AcCmColor, AcCmColorMethod } from '@mlightcad/common'
import { AcGePoint2d, AcGePoint3d } from '@mlightcad/geometry-engine'

import {
  AcDbArc,
  AcDbCircle,
  AcDbLine,
  acdbJoinAllEntities,
  AcDbPolyline
} from '../src/entity'

const expectPoint = (
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z?: number }
) => {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
  expect(actual.z).toBeCloseTo(expected.z ?? 0, 6)
}

describe('AcDbEntity.join', () => {
  describe('joinEntity / joinEntities on Line', () => {
    it('merges two collinear lines with a gap into one line', () => {
      const a = new AcDbLine(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(10, 0, 0)
      )
      const b = new AcDbLine(
        new AcGePoint3d(15, 0, 0),
        new AcGePoint3d(25, 0, 0)
      )
      a.layer = 'WALL'
      a.color = new AcCmColor(AcCmColorMethod.ByACI, 1)

      const joined = a.joinEntity(b)
      expect(joined).toBeInstanceOf(AcDbLine)
      const line = joined as AcDbLine
      expectPoint(line.startPoint, { x: 0, y: 0 })
      expectPoint(line.endPoint, { x: 25, y: 0 })
      expect(line.layer).toBe('WALL')
      expect(line.color?.colorIndex).toBe(1)
    })

    it('returns undefined for non-collinear lines', () => {
      const a = new AcDbLine(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(10, 0, 0)
      )
      const b = new AcDbLine(
        new AcGePoint3d(10, 0, 0),
        new AcGePoint3d(10, 10, 0)
      )
      expect(a.joinEntity(b)).toBeUndefined()
    })

    it('joins multiple collinear lines via joinEntities', () => {
      const a = new AcDbLine(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(5, 0, 0)
      )
      const b = new AcDbLine(
        new AcGePoint3d(5, 0, 0),
        new AcGePoint3d(10, 0, 0)
      )
      const c = new AcDbLine(
        new AcGePoint3d(12, 0, 0),
        new AcGePoint3d(20, 0, 0)
      )
      const joined = a.joinEntities([b, c]) as AcDbLine
      expect(joined).toBeInstanceOf(AcDbLine)
      expectPoint(joined.startPoint, { x: 0, y: 0 })
      expectPoint(joined.endPoint, { x: 20, y: 0 })
    })
  })

  describe('joinEntity / joinEntities on Arc', () => {
    it('merges concentric arcs into a longer arc', () => {
      const a = new AcDbArc(new AcGePoint3d(0, 0, 0), 10, 0, Math.PI / 2)
      const b = new AcDbArc(
        new AcGePoint3d(0, 0, 0),
        10,
        Math.PI,
        (3 * Math.PI) / 2
      )
      const joined = a.joinEntity(b)
      expect(joined).toBeInstanceOf(AcDbArc)
      const arc = joined as AcDbArc
      expect(arc.startAngle).toBeCloseTo(0, 6)
      expect(arc.endAngle).toBeCloseTo((3 * Math.PI) / 2, 6)
      expect(arc.radius).toBeCloseTo(10, 6)
    })

    it('merges arcs that cover a full circle into a circle', () => {
      const a = new AcDbArc(new AcGePoint3d(0, 0, 0), 5, 0, Math.PI)
      const b = new AcDbArc(new AcGePoint3d(0, 0, 0), 5, Math.PI, Math.PI * 2)
      const joined = a.joinEntities([b])
      expect(joined).toBeInstanceOf(AcDbCircle)
      const circle = joined as AcDbCircle
      expect(circle.radius).toBeCloseTo(5, 6)
      expectPoint(circle.center, { x: 0, y: 0 })
    })

    it('returns undefined for arcs with different radii', () => {
      const a = new AcDbArc(new AcGePoint3d(0, 0, 0), 5, 0, Math.PI / 2)
      const b = new AcDbArc(new AcGePoint3d(0, 0, 0), 8, Math.PI / 2, Math.PI)
      expect(a.joinEntity(b)).toBeUndefined()
    })
  })

  describe('joinEntity / joinEntities on Polyline', () => {
    it('joins a line at a shared endpoint into a polyline', () => {
      const pline = new AcDbPolyline()
      pline.addVertexAt(0, new AcGePoint2d(0, 0))
      pline.addVertexAt(1, new AcGePoint2d(10, 0))
      const line = new AcDbLine(
        new AcGePoint3d(10, 0, 0),
        new AcGePoint3d(10, 5, 0)
      )

      const joined = pline.joinEntity(line)
      expect(joined).toBeInstanceOf(AcDbPolyline)
      const result = joined as AcDbPolyline
      expect(result.numberOfVertices).toBe(3)
      expectPoint(result.getPoint3dAt(0), { x: 0, y: 0 })
      expectPoint(result.getPoint3dAt(2), { x: 10, y: 5 })
    })

    it('joins an arc at a shared endpoint into a polyline with bulge', () => {
      // Polyline along X to (20,0); quarter-circle center (10,0) from (20,0) to (10,10).
      const pline = new AcDbPolyline()
      pline.addVertexAt(0, new AcGePoint2d(0, 0))
      pline.addVertexAt(1, new AcGePoint2d(20, 0))
      const arc = new AcDbArc(new AcGePoint3d(10, 0, 0), 10, 0, Math.PI / 2)

      const joined = pline.joinEntities([arc]) as AcDbPolyline
      expect(joined).toBeInstanceOf(AcDbPolyline)
      expect(joined.numberOfVertices).toBe(3)
      expect(Math.abs(joined.getBulgeAt(1))).toBeGreaterThan(0.1)
      expectPoint(joined.getPoint3dAt(2), { x: 10, y: 10 })
    })

    it('joins two open polylines end-to-end', () => {
      const a = new AcDbPolyline()
      a.addVertexAt(0, new AcGePoint2d(0, 0))
      a.addVertexAt(1, new AcGePoint2d(5, 0))
      const b = new AcDbPolyline()
      b.addVertexAt(0, new AcGePoint2d(5, 0))
      b.addVertexAt(1, new AcGePoint2d(5, 5))

      const joined = a.joinEntity(b) as AcDbPolyline
      expect(joined.numberOfVertices).toBe(3)
      expectPoint(joined.getPoint3dAt(0), { x: 0, y: 0 })
      expectPoint(joined.getPoint3dAt(2), { x: 5, y: 5 })
    })

    it('ignores closed polylines', () => {
      const a = new AcDbPolyline()
      a.addVertexAt(0, new AcGePoint2d(0, 0))
      a.addVertexAt(1, new AcGePoint2d(5, 0))
      a.closed = true
      const line = new AcDbLine(
        new AcGePoint3d(5, 0, 0),
        new AcGePoint3d(5, 5, 0)
      )
      expect(a.joinEntity(line)).toBeUndefined()
    })
  })

  describe('acdbJoinAllEntities', () => {
    it('joins disjoint collinear line groups and an L-shaped chain', () => {
      const l1 = new AcDbLine(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(5, 0, 0)
      )
      const l2 = new AcDbLine(
        new AcGePoint3d(8, 0, 0),
        new AcGePoint3d(12, 0, 0)
      )
      const l3 = new AcDbLine(
        new AcGePoint3d(0, 10, 0),
        new AcGePoint3d(5, 10, 0)
      )
      const l4 = new AcDbLine(
        new AcGePoint3d(5, 10, 0),
        new AcGePoint3d(5, 15, 0)
      )

      const { groups, consumed } = acdbJoinAllEntities([l1, l2, l3, l4])
      expect(consumed).toHaveLength(4)
      expect(groups).toHaveLength(2)

      const lineResult = groups.find(g => g.result instanceof AcDbLine)
        ?.result as AcDbLine
      const plineResult = groups.find(g => g.result instanceof AcDbPolyline)
        ?.result as AcDbPolyline
      expect(lineResult).toBeDefined()
      expect(plineResult).toBeDefined()
      expectPoint(lineResult.startPoint, { x: 0, y: 0 })
      expectPoint(lineResult.endPoint, { x: 12, y: 0 })
      expect(plineResult.numberOfVertices).toBe(3)
    })

    it('leaves unjoinable singles unconsumed', () => {
      const a = new AcDbLine(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(1, 0, 0)
      )
      const b = new AcDbLine(
        new AcGePoint3d(10, 10, 0),
        new AcGePoint3d(11, 10, 0)
      )
      // Not collinear with each other and not touching.
      const { groups, consumed } = acdbJoinAllEntities([a, b])
      expect(groups).toHaveLength(0)
      expect(consumed).toHaveLength(0)
    })

    it('still joins a simple chain when an unrelated Y-junction exists', () => {
      // Simple L-chain far away (not collinear with the branched group).
      const c1 = new AcDbLine(
        new AcGePoint3d(100, 50, 0),
        new AcGePoint3d(110, 50, 0)
      )
      const c2 = new AcDbLine(
        new AcGePoint3d(110, 50, 0),
        new AcGePoint3d(110, 60, 0)
      )
      // Branched graph: main touches three non-collinear branches (degree 3).
      const main = new AcDbLine(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(10, 0, 0)
      )
      const b1 = new AcDbLine(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(-3, 5, 0)
      )
      const b2 = new AcDbLine(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(-3, -5, 0)
      )
      const b3 = new AcDbLine(
        new AcGePoint3d(10, 0, 0),
        new AcGePoint3d(13, 5, 0)
      )

      const { groups, consumed } = acdbJoinAllEntities([
        c1,
        c2,
        main,
        b1,
        b2,
        b3
      ])
      const pline = groups.find(g => g.result instanceof AcDbPolyline)
        ?.result as AcDbPolyline | undefined
      expect(pline).toBeDefined()
      expect(pline!.numberOfVertices).toBe(3)
      expect(consumed).toEqual(expect.arrayContaining([c1, c2]))
      expect(consumed).not.toEqual(
        expect.arrayContaining([main, b1, b2, b3])
      )
    })
  })
})
