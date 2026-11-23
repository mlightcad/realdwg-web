import { AcGePoint2d, AcGePoint3d } from '@mlightcad/geometry-engine'

import {
  AcDbArc,
  acdbChamferTwoEntities,
  acdbFilletPolyline,
  acdbFilletTwoEntities,
  AcDbLine,
  AcDbPolyline
} from '../src/entity'

const expectPoint = (
  actual: { x: number; y: number; z?: number },
  expected: { x: number; y: number; z?: number }
) => {
  expect(actual.x).toBeCloseTo(expected.x, 5)
  expect(actual.y).toBeCloseTo(expected.y, 5)
  if (expected.z !== undefined) {
    expect(actual.z ?? 0).toBeCloseTo(expected.z, 5)
  }
}

describe('acdbFilletTwoEntities', () => {
  it('fillets two perpendicular lines', () => {
    const a = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(10, 0, 0))
    const b = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(0, 10, 0))
    a.layer = '0'
    b.layer = '0'

    const outcome = acdbFilletTwoEntities(
      a,
      { x: 5, y: 0, z: 0 },
      b,
      { x: 0, y: 5, z: 0 },
      { radius: 1 }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.created).toHaveLength(1)
    expect(outcome.result.created[0]).toBeInstanceOf(AcDbArc)
    // Keep the far ends; move the shared-corner ends to the fillet tangents.
    expectPoint(a.startPoint, { x: 1, y: 0 })
    expectPoint(a.endPoint, { x: 10, y: 0 })
    expectPoint(b.startPoint, { x: 0, y: 1 })
    expectPoint(b.endPoint, { x: 0, y: 10 })
  })

  it('creates a minor fillet arc for a peak corner', () => {
    // Peak ∧ — the fillet under the peak must be the short arc, not the
    // long way around (regression: clockwise CircArc2d → AcDbArc swapped into
    // a major sweep).
    const a = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(50, 80, 0))
    const b = new AcDbLine(
      new AcGePoint3d(100, 0, 0),
      new AcGePoint3d(50, 80, 0)
    )
    a.layer = '0'
    b.layer = '0'

    const outcome = acdbFilletTwoEntities(
      a,
      { x: 25, y: 40, z: 0 },
      b,
      { x: 75, y: 40, z: 0 },
      { radius: 45 }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.created).toHaveLength(1)
    const fillet = outcome.result.created[0] as AcDbArc
    expect(fillet).toBeInstanceOf(AcDbArc)
    const sweep = Math.abs(fillet.endAngle - fillet.startAngle)
    const normalized =
      ((sweep % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    expect(normalized).toBeLessThanOrEqual(Math.PI + 1e-6)
  })

  it('keeps both arms when filleting two connected lines', () => {
    // Shared corner at (10,0); picks are mid-segment.
    const a = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(10, 0, 0))
    const b = new AcDbLine(new AcGePoint3d(10, 0, 0), new AcGePoint3d(10, 10, 0))
    a.layer = '0'
    b.layer = '0'

    const outcome = acdbFilletTwoEntities(
      a,
      { x: 5, y: 0, z: 0 },
      b,
      { x: 10, y: 5, z: 0 },
      { radius: 1 }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.created).toHaveLength(1)
    expectPoint(a.startPoint, { x: 0, y: 0 })
    expectPoint(a.endPoint, { x: 9, y: 0 })
    expectPoint(b.startPoint, { x: 10, y: 1 })
    expectPoint(b.endPoint, { x: 10, y: 10 })
    expect(a.startPoint.distanceTo(a.endPoint)).toBeGreaterThan(1)
    expect(b.startPoint.distanceTo(b.endPoint)).toBeGreaterThan(1)
  })

  it('does not collapse connected lines when radius is 0', () => {
    const a = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(10, 0, 0))
    const b = new AcDbLine(new AcGePoint3d(10, 0, 0), new AcGePoint3d(10, 10, 0))

    // Picks near the shared corner — the old endpoint-distance heuristic
    // collapsed both segments to zero length.
    const outcome = acdbFilletTwoEntities(
      a,
      { x: 9.5, y: 0, z: 0 },
      b,
      { x: 10, y: 0.5, z: 0 },
      { radius: 0 }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.created).toHaveLength(0)
    expect(a.startPoint.distanceTo(a.endPoint)).toBeCloseTo(10, 5)
    expect(b.startPoint.distanceTo(b.endPoint)).toBeCloseTo(10, 5)
  })

  it('creates a sharp corner when radius is 0', () => {
    const a = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(10, 0, 0))
    const b = new AcDbLine(new AcGePoint3d(5, -5, 0), new AcGePoint3d(5, 5, 0))

    const outcome = acdbFilletTwoEntities(
      a,
      { x: 2, y: 0, z: 0 },
      b,
      { x: 5, y: 2, z: 0 },
      { radius: 0 }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.created).toHaveLength(0)
  })
})

describe('acdbFilletPolyline', () => {
  it('fillets all corners of a rectangle', () => {
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0))
    pline.addVertexAt(1, new AcGePoint2d(10, 0))
    pline.addVertexAt(2, new AcGePoint2d(10, 8))
    pline.addVertexAt(3, new AcGePoint2d(0, 8))
    pline.closed = true

    const stats = acdbFilletPolyline(pline, { radius: 1 })
    expect(stats.filleted).toBeGreaterThanOrEqual(3)
    expect(pline.numberOfVertices).toBeGreaterThan(4)
  })

  it('keeps the open-polyline end vertex after filleting', () => {
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0))
    pline.addVertexAt(1, new AcGePoint2d(10, 0))
    pline.addVertexAt(2, new AcGePoint2d(10, 10))
    pline.addVertexAt(3, new AcGePoint2d(0, 10))

    const stats = acdbFilletPolyline(pline, { radius: 1 }, 1)
    expect(stats.filleted).toBe(1)
    const last = pline.getPoint2dAt(pline.numberOfVertices - 1)
    expectPoint(last, { x: 0, y: 10 })
  })
})

describe('acdbFilletTwoEntities same polyline', () => {
  it('fillets only the shared corner of adjacent segments', () => {
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0))
    pline.addVertexAt(1, new AcGePoint2d(10, 0))
    pline.addVertexAt(2, new AcGePoint2d(10, 8))
    pline.addVertexAt(3, new AcGePoint2d(0, 8))
    pline.closed = true

    const outcome = acdbFilletTwoEntities(
      pline,
      { x: 5, y: 0, z: 0 },
      pline,
      { x: 10, y: 4, z: 0 },
      { radius: 1 }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.modified).toEqual([pline])
    // One corner → 4 vertices become 5 (corner replaced by two trim points).
    expect(pline.numberOfVertices).toBe(5)
  })

  it('rejects non-adjacent segments on the same polyline', () => {
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0))
    pline.addVertexAt(1, new AcGePoint2d(10, 0))
    pline.addVertexAt(2, new AcGePoint2d(10, 8))
    pline.addVertexAt(3, new AcGePoint2d(0, 8))
    pline.closed = true

    const outcome = acdbFilletTwoEntities(
      pline,
      { x: 5, y: 0, z: 0 },
      pline,
      { x: 5, y: 8, z: 0 },
      { radius: 1 }
    )
    expect(outcome.ok).toBe(false)
  })
})

describe('acdbChamferTwoEntities', () => {
  it('chamfers two perpendicular lines', () => {
    const a = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(10, 0, 0))
    const b = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(0, 10, 0))
    a.layer = '0'
    b.layer = '0'

    const outcome = acdbChamferTwoEntities(
      a,
      { x: 5, y: 0, z: 0 },
      b,
      { x: 0, y: 5, z: 0 },
      {
        mode: { method: 'distance', distance1: 2, distance2: 2 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.created).toHaveLength(1)
    expect(outcome.result.created[0]).toBeInstanceOf(AcDbLine)
    expectPoint(a.startPoint, { x: 2, y: 0 })
    expectPoint(a.endPoint, { x: 10, y: 0 })
    expectPoint(b.startPoint, { x: 0, y: 2 })
    expectPoint(b.endPoint, { x: 0, y: 10 })
  })

  it('chamfers only the shared corner on one polyline', () => {
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0))
    pline.addVertexAt(1, new AcGePoint2d(10, 0))
    pline.addVertexAt(2, new AcGePoint2d(10, 8))
    pline.addVertexAt(3, new AcGePoint2d(0, 8))
    pline.closed = true

    const outcome = acdbChamferTwoEntities(
      pline,
      { x: 5, y: 0, z: 0 },
      pline,
      { x: 10, y: 4, z: 0 },
      {
        mode: { method: 'distance', distance1: 1, distance2: 1 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(pline.numberOfVertices).toBe(5)
  })
})
