import { AcGePoint2d, AcGePoint3d } from '@mlightcad/geometry-engine'

import {
  AcDbArc,
  acdbChamferPolyline,
  acdbChamferTwoEntities,
  acdbFilletPolyline,
  acdbFilletTwoEntities,
  AcDbLine,
  AcDbPolyline,
  acdbPreviewChamferTwoEntities,
  acdbPreviewFilletTwoEntities
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

describe('acdbPreviewFilletTwoEntities / acdbPreviewChamferTwoEntities', () => {
  it('returns a fillet arc without mutating the operands', () => {
    const a = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(10, 0, 0))
    const b = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(0, 10, 0))
    a.layer = '0'
    b.layer = '0'

    const preview = acdbPreviewFilletTwoEntities(
      a,
      { x: 5, y: 0, z: 0 },
      b,
      { x: 0, y: 5, z: 0 },
      { radius: 1 }
    )
    expect(preview).toHaveLength(1)
    expect(preview[0]).toBeInstanceOf(AcDbArc)
    expectPoint(a.startPoint, { x: 0, y: 0 })
    expectPoint(a.endPoint, { x: 10, y: 0 })
    expectPoint(b.startPoint, { x: 0, y: 0 })
    expectPoint(b.endPoint, { x: 0, y: 10 })
  })

  it('returns a chamfer segment without mutating the operands', () => {
    const a = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(10, 0, 0))
    const b = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(0, 10, 0))
    a.layer = '0'
    b.layer = '0'

    const preview = acdbPreviewChamferTwoEntities(
      a,
      { x: 5, y: 0, z: 0 },
      b,
      { x: 0, y: 5, z: 0 },
      { mode: { method: 'distance', distance1: 1, distance2: 1 } }
    )
    expect(preview).toHaveLength(1)
    expect(preview[0]).toBeInstanceOf(AcDbLine)
    expectPoint(a.startPoint, { x: 0, y: 0 })
    expectPoint(a.endPoint, { x: 10, y: 0 })
  })
})

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

  it('trims a line–arc fillet while keeping the pick-side of the arc', () => {
    // Horizontal line through origin; quarter-circle from (10,0) to (0,10)
    // centered at origin. Pick on the right of the line and mid-arc.
    const line = new AcDbLine(
      new AcGePoint3d(-10, 0, 0),
      new AcGePoint3d(10, 0, 0)
    )
    const arc = new AcDbArc(
      new AcGePoint3d(0, 0, 0),
      10,
      0,
      Math.PI / 2
    )
    line.layer = '0'
    arc.layer = '0'
    const startBefore = arc.startAngle
    const endBefore = arc.endAngle

    const outcome = acdbFilletTwoEntities(
      line,
      { x: 5, y: 0, z: 0 },
      arc,
      { x: 7, y: 7, z: 0 },
      { radius: 2 }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.created).toHaveLength(1)
    expect(outcome.result.created[0]).toBeInstanceOf(AcDbArc)
    // One arc endpoint moved to the fillet tangent; the other stays put.
    const startMoved = Math.abs(arc.startAngle - startBefore) > 1e-6
    const endMoved = Math.abs(arc.endAngle - endBefore) > 1e-6
    expect(startMoved !== endMoved).toBe(true)
    // Pick was mid-arc → remaining sweep should still contain ~45°.
    const mid = Math.PI / 4
    const onSweep =
      ((mid - arc.startAngle + Math.PI * 2) % (Math.PI * 2)) <=
      ((arc.endAngle - arc.startAngle + Math.PI * 2) % (Math.PI * 2)) + 1e-6
    expect(onSweep).toBe(true)
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

  it('skips arc-segment corners when FILLETPOLYARC is off', () => {
    const pline = new AcDbPolyline()
    // Line → arc → line: the two corners involving the arc must be skipped.
    pline.addVertexAt(0, new AcGePoint2d(0, 0), 0)
    pline.addVertexAt(1, new AcGePoint2d(10, 0), 0.5)
    pline.addVertexAt(2, new AcGePoint2d(20, 0), 0)
    pline.addVertexAt(3, new AcGePoint2d(20, 10), 0)

    const before = pline.numberOfVertices
    const stats = acdbFilletPolyline(pline, {
      radius: 1,
      filletPolyArc: false
    })
    expect(stats.filleted).toBe(0)
    expect(stats.skipped).toBeGreaterThan(0)
    expect(pline.numberOfVertices).toBe(before)
  })

  it('fillets a straight–arc corner when FILLETPOLYARC is on', () => {
    // Open L with an arc on the vertical leg: line (0,0)-(10,0) then
    // quarter-circle bulge to (10,10). Fillet at the (10,0) corner.
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0), 0)
    pline.addVertexAt(1, new AcGePoint2d(10, 0), 1) // bulge 1 = 90° arc
    pline.addVertexAt(2, new AcGePoint2d(10, 10), 0)

    const before = pline.numberOfVertices
    const stats = acdbFilletPolyline(pline, {
      radius: 1,
      filletPolyArc: true
    })
    expect(stats.filleted).toBe(1)
    expect(pline.numberOfVertices).toBeGreaterThan(before)
    // Remaining inbound segment should keep a non-zero bulge (trimmed arc).
    const midBulges = []
    for (let i = 0; i < pline.numberOfVertices - 1; i++) {
      midBulges.push(pline.getBulgeAt(i))
    }
    expect(midBulges.some(b => Math.abs(b) > 1e-6)).toBe(true)
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

  it('applies distance1/distance2 in selection order', () => {
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
        mode: { method: 'distance', distance1: 4, distance2: 1 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const chamfer = outcome.result.created[0] as AcDbLine
    expectPoint(chamfer.startPoint, { x: 4, y: 0 })
    expectPoint(chamfer.endPoint, { x: 0, y: 1 })
    expectPoint(a.startPoint, { x: 4, y: 0 })
    expectPoint(b.startPoint, { x: 0, y: 1 })
  })

  it('keeps the pick-side half when trimming an X-crossing 八', () => {
    // Crossing diagonals; picks on the left halves → chamfer in left sector.
    const a = new AcDbLine(
      new AcGePoint3d(-10, -10, 0),
      new AcGePoint3d(10, 10, 0)
    )
    const b = new AcDbLine(
      new AcGePoint3d(-10, 10, 0),
      new AcGePoint3d(10, -10, 0)
    )
    a.layer = '0'
    b.layer = '0'

    const outcome = acdbChamferTwoEntities(
      a,
      { x: -5, y: -5, z: 0 },
      b,
      { x: -5, y: 5, z: 0 },
      {
        mode: { method: 'distance', distance1: 2, distance2: 2 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const chamfer = outcome.result.created[0] as AcDbLine
    expect(chamfer.startPoint.x).toBeLessThan(0)
    expect(chamfer.endPoint.x).toBeLessThan(0)
    // Trim keeps the picked (left) halves.
    expect(a.startPoint.x).toBeLessThan(0)
    expect(a.endPoint.x).toBeLessThan(0)
    expect(b.startPoint.x).toBeLessThan(0)
    expect(b.endPoint.x).toBeLessThan(0)
  })

  it('extends a separated 八 to the chamfer when TRIMMODE is on', () => {
    const a = new AcDbLine(new AcGePoint3d(-2, 2, 0), new AcGePoint3d(-10, 10, 0))
    const b = new AcDbLine(new AcGePoint3d(2, 2, 0), new AcGePoint3d(10, 10, 0))
    a.layer = '0'
    b.layer = '0'
    const startA = { ...a.startPoint }
    const startB = { ...b.startPoint }

    const outcome = acdbChamferTwoEntities(
      a,
      { x: -6, y: 6, z: 0 },
      b,
      { x: 6, y: 6, z: 0 },
      {
        mode: { method: 'distance', distance1: 2, distance2: 2 },
        trim: true
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.created).toHaveLength(1)
    // Near ends move toward the virtual intersection / chamfer points.
    expect(a.startPoint.distanceTo(new AcGePoint3d(startA.x, startA.y, 0))).toBeGreaterThan(
      0.1
    )
    expect(b.startPoint.distanceTo(new AcGePoint3d(startB.x, startB.y, 0))).toBeGreaterThan(
      0.1
    )
  })

  it('leaves original endpoints unchanged when trim is off', () => {
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
        mode: { method: 'distance', distance1: 2, distance2: 2 },
        trim: false
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.created).toHaveLength(1)
    expect(outcome.result.modified).toHaveLength(0)
    expectPoint(a.startPoint, { x: 0, y: 0 })
    expectPoint(a.endPoint, { x: 10, y: 0 })
    expectPoint(b.startPoint, { x: 0, y: 0 })
    expectPoint(b.endPoint, { x: 0, y: 10 })
    const chamfer = outcome.result.created[0] as AcDbLine
    expectPoint(chamfer.startPoint, { x: 2, y: 0 })
    expectPoint(chamfer.endPoint, { x: 0, y: 2 })
  })

  it('creates no chamfer segment when both distances are 0', () => {
    const a = new AcDbLine(new AcGePoint3d(-2, 2, 0), new AcGePoint3d(-10, 10, 0))
    const b = new AcDbLine(new AcGePoint3d(2, 2, 0), new AcGePoint3d(10, 10, 0))

    const outcome = acdbChamferTwoEntities(
      a,
      { x: -6, y: 6, z: 0 },
      b,
      { x: 6, y: 6, z: 0 },
      {
        mode: { method: 'distance', distance1: 0, distance2: 0 },
        trim: true
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.created).toHaveLength(0)
    // Lines extend/trim to the shared corner (0,0).
    expectPoint(a.startPoint, { x: 0, y: 0 })
    expectPoint(b.startPoint, { x: 0, y: 0 })
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

describe('acdbChamferPolyline', () => {
  it('chamfers every vertex of a closed polyline in drawing order', () => {
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0))
    pline.addVertexAt(1, new AcGePoint2d(10, 0))
    pline.addVertexAt(2, new AcGePoint2d(10, 8))
    pline.addVertexAt(3, new AcGePoint2d(0, 8))
    pline.closed = true

    const stats = acdbChamferPolyline(pline, {
      mode: { method: 'distance', distance1: 1, distance2: 1 }
    })
    expect(stats.chamfered).toBe(4)
    // Each corner becomes two vertices → 8.
    expect(pline.numberOfVertices).toBe(8)
  })

  it('follows open-polyline vertex order without needing end picks', () => {
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0))
    pline.addVertexAt(1, new AcGePoint2d(10, 0))
    pline.addVertexAt(2, new AcGePoint2d(10, 10))

    const stats = acdbChamferPolyline(pline, {
      mode: { method: 'distance', distance1: 2, distance2: 2 }
    })
    expect(stats.chamfered).toBe(1)
    expect(pline.numberOfVertices).toBe(4)
    expectPoint(pline.getPoint2dAt(0), { x: 0, y: 0 })
    expectPoint(pline.getPoint2dAt(1), { x: 8, y: 0 })
    expectPoint(pline.getPoint2dAt(2), { x: 10, y: 2 })
    expectPoint(pline.getPoint2dAt(3), { x: 10, y: 10 })
  })
})
