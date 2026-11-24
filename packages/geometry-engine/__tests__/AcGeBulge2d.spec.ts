import { AcGeCircArc2d } from '../src'
import {
  acgeBulgeArcTangentAtEnd,
  acgeBulgeArcTangentAtStart,
  acgeBulgeFromCenter,
  acgeBulgeFromCenterWithTangent,
  acgeBulgeFromCircArc2d,
  acgeBulgeFromStartEndDirection,
  acgeBulgeFromThreePoints,
  acgeCenterFromBulge,
  acgeComplementBulge
} from '../src'

const angleNear = (
  actual: number | undefined,
  expected: number,
  eps = 1e-9
) => {
  expect(actual).toBeDefined()
  let delta = ((actual! - expected + Math.PI) % (Math.PI * 2)) - Math.PI
  if (delta <= -Math.PI) delta += Math.PI * 2
  expect(Math.abs(delta)).toBeLessThan(eps)
}

describe('AcGeBulge2d', () => {
  const start = { x: 0, y: 0 }
  const end90 = { x: 1, y: 1 }
  const bulge90 = Math.tan(Math.PI / 8)

  it('computes the true arc center from bulge (not the sagitta)', () => {
    const center = acgeCenterFromBulge(start, end90, bulge90)
    expect(center).toBeDefined()
    expect(center!.x).toBeCloseTo(0, 9)
    expect(center!.y).toBeCloseTo(1, 9)
  })

  it('returns the exit tangent of a 90° CCW arc as +Y', () => {
    angleNear(acgeBulgeArcTangentAtEnd(start, end90, bulge90), Math.PI / 2)
  })

  it('returns the start tangent of a 90° CCW arc as +X', () => {
    angleNear(acgeBulgeArcTangentAtStart(start, end90, bulge90), 0)
  })

  it('keeps G1 when building an arc from start-end-direction', () => {
    const tangent = 0
    const end = { x: 1, y: 1 }
    const bulge = acgeBulgeFromStartEndDirection(start, end, tangent)
    expect(bulge).toBeDefined()
    angleNear(acgeBulgeArcTangentAtStart(start, end, bulge!), tangent)
  })

  it('keeps G1 across successive arcs', () => {
    const p1 = { x: 10, y: 0 }
    const p2 = { x: 11, y: 1 }
    const firstBulge = acgeBulgeFromStartEndDirection(p1, p2, 0)
    expect(firstBulge).toBeDefined()

    const exit = acgeBulgeArcTangentAtEnd(p1, p2, firstBulge!)
    expect(exit).toBeDefined()

    const p3 = { x: 10, y: 2 }
    const secondBulge = acgeBulgeFromStartEndDirection(p2, p3, exit!)
    expect(secondBulge).toBeDefined()
    angleNear(acgeBulgeArcTangentAtStart(p2, p3, secondBulge!), exit!)
  })

  it('complements a minor CCW bulge to the major CW arc', () => {
    const complement = acgeComplementBulge(bulge90)
    expect(complement).toBeCloseTo(-Math.tan((3 * Math.PI) / 8), 12)
    expect(acgeComplementBulge(complement)).toBeCloseTo(bulge90, 12)
  })

  it('round-trips bulge through AcGeCircArc2d for minor, major, and CW', () => {
    const cases = [bulge90, -bulge90, 2, -2, 1, -1]
    for (const bulge of cases) {
      const arc = new AcGeCircArc2d(start, end90, bulge)
      expect(acgeBulgeFromCircArc2d(arc)).toBeCloseTo(bulge, 12)
      const center = acgeCenterFromBulge(start, end90, bulge)
      expect(center).toBeDefined()
      expect(center!.x).toBeCloseTo(arc.center.x, 9)
      expect(center!.y).toBeCloseTo(arc.center.y, 9)
    }
  })

  it('returns undefined for zero bulge and coincident endpoints', () => {
    expect(acgeCenterFromBulge(start, end90, 0)).toBeUndefined()
    expect(acgeCenterFromBulge(start, start, bulge90)).toBeUndefined()
    expect(acgeBulgeArcTangentAtStart(start, end90, 0)).toBeUndefined()
  })

  it('encodes major arcs when a start tangent is supplied', () => {
    const center = { x: 0, y: 1 }
    // 90° CCW from (0,0)→(1,1) around (0,1) has start tangent +X.
    expect(acgeBulgeFromCenter(start, end90, center)).toBeCloseTo(bulge90, 12)

    // Same center with -X start tangent selects the major CW arc.
    const major = acgeBulgeFromCenterWithTangent(start, end90, center, Math.PI)
    expect(major).toBeDefined()
    expect(major!).toBeLessThan(0)
    expect(Math.abs(major!)).toBeGreaterThan(1)
    expect(major!).toBeCloseTo(-Math.tan((3 * Math.PI) / 8), 12)
  })

  it('honors reverseDirection on three-point arcs', () => {
    const mid = { x: 0, y: 1 }
    const end = { x: 1, y: 1 }
    const bulge = acgeBulgeFromThreePoints(start, mid, end)
    const reversed = acgeBulgeFromThreePoints(start, mid, end, true)
    expect(bulge).toBeDefined()
    expect(reversed).toBeDefined()
    expect(reversed!).toBeCloseTo(acgeComplementBulge(bulge!), 12)
  })
})
