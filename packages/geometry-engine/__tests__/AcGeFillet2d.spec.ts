import {
  acgeChamferCurves2d,
  acgeFilletCurves2d,
  AcGeFilletLine2d
} from '../src'

function line(
  start: [number, number],
  end: [number, number]
): AcGeFilletLine2d {
  return {
    kind: 'line',
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] }
  }
}

describe('acgeFilletCurves2d', () => {
  it('fillets two perpendicular lines with radius 1', () => {
    const outcome = acgeFilletCurves2d(
      line([0, 0], [10, 0]),
      line([0, 0], [0, 10]),
      {
        radius: 1,
        hintA: { x: 5, y: 0 },
        hintB: { x: 0, y: 5 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.radius).toBeCloseTo(1)
    expect(outcome.result.arc).toBeDefined()
    expect(outcome.result.trimA.x).toBeCloseTo(1)
    expect(outcome.result.trimA.y).toBeCloseTo(0)
    expect(outcome.result.trimB.x).toBeCloseTo(0)
    expect(outcome.result.trimB.y).toBeCloseTo(1)
    expect(outcome.result.center!.x).toBeCloseTo(1)
    expect(outcome.result.center!.y).toBeCloseTo(1)
  })

  it('creates a sharp corner when radius is 0', () => {
    const outcome = acgeFilletCurves2d(
      line([0, 0], [10, 0]),
      line([5, -5], [5, 5]),
      { radius: 0 }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.arc).toBeUndefined()
    expect(outcome.result.trimA.x).toBeCloseTo(5)
    expect(outcome.result.trimA.y).toBeCloseTo(0)
    expect(outcome.result.radius).toBe(0)
  })

  it('fillets parallel lines with a semicircle', () => {
    const outcome = acgeFilletCurves2d(
      line([0, 0], [10, 0]),
      line([0, 2], [10, 2]),
      {
        radius: 5,
        hintA: { x: 5, y: 0 },
        hintB: { x: 5, y: 2 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.radius).toBeCloseTo(1)
    expect(outcome.result.arc).toBeDefined()
  })

  it('fillets a line and a circle', () => {
    const outcome = acgeFilletCurves2d(
      line([0, 0], [20, 0]),
      {
        kind: 'circArc',
        center: { x: 10, y: 5 },
        radius: 3,
        startAngle: 0,
        endAngle: Math.PI * 2,
        closed: true
      },
      {
        radius: 1,
        hintA: { x: 10, y: 0 },
        hintB: { x: 10, y: 2 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.arc).toBeDefined()
    expect(outcome.result.radius).toBeCloseTo(1)
  })

  it('rejects a negative radius', () => {
    const outcome = acgeFilletCurves2d(
      line([0, 0], [10, 0]),
      line([0, 0], [0, 10]),
      { radius: -1 }
    )
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error).toBe('invalidRadius')
  })
})

describe('acgeChamferCurves2d', () => {
  it('chamfers two perpendicular lines with equal distances', () => {
    const outcome = acgeChamferCurves2d(
      line([0, 0], [10, 0]),
      line([0, 0], [0, 10]),
      {
        mode: { method: 'distance', distance1: 2, distance2: 2 },
        hintA: { x: 5, y: 0 },
        hintB: { x: 0, y: 5 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.isCornerOnly).toBe(false)
    expect(outcome.result.trimA.x).toBeCloseTo(2)
    expect(outcome.result.trimA.y).toBeCloseTo(0)
    expect(outcome.result.trimB.x).toBeCloseTo(0)
    expect(outcome.result.trimB.y).toBeCloseTo(2)
  })

  it('applies distance1 to the first line and distance2 to the second', () => {
    // AutoCAD: distances follow selection order, not screen position.
    const outcome = acgeChamferCurves2d(
      line([0, 0], [10, 0]),
      line([0, 0], [0, 10]),
      {
        mode: { method: 'distance', distance1: 3, distance2: 1 },
        hintA: { x: 5, y: 0 },
        hintB: { x: 0, y: 5 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.trimA.x).toBeCloseTo(3)
    expect(outcome.result.trimA.y).toBeCloseTo(0)
    expect(outcome.result.trimB.x).toBeCloseTo(0)
    expect(outcome.result.trimB.y).toBeCloseTo(1)
  })

  it('swaps cut lengths when the selection order is reversed', () => {
    const outcome = acgeChamferCurves2d(
      line([0, 0], [0, 10]),
      line([0, 0], [10, 0]),
      {
        mode: { method: 'distance', distance1: 3, distance2: 1 },
        hintA: { x: 0, y: 5 },
        hintB: { x: 5, y: 0 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.trimA.x).toBeCloseTo(0)
    expect(outcome.result.trimA.y).toBeCloseTo(3)
    expect(outcome.result.trimB.x).toBeCloseTo(1)
    expect(outcome.result.trimB.y).toBeCloseTo(0)
  })

  it('uses pick hints to choose which sector of crossing lines to chamfer', () => {
    // X-crossing "八"/X: lines (-10,-10)-(10,10) and (-10,10)-(10,-10).
    // Picks on the upper halves keep the chamfer in the top sector.
    const a = line([-10, -10], [10, 10])
    const b = line([-10, 10], [10, -10])
    const upper = acgeChamferCurves2d(a, b, {
      mode: { method: 'distance', distance1: 2, distance2: 2 },
      hintA: { x: -5, y: -5 },
      hintB: { x: -5, y: 5 }
    })
    const lower = acgeChamferCurves2d(a, b, {
      mode: { method: 'distance', distance1: 2, distance2: 2 },
      hintA: { x: 5, y: 5 },
      hintB: { x: 5, y: -5 }
    })
    expect(upper.ok).toBe(true)
    expect(lower.ok).toBe(true)
    if (!upper.ok || !lower.ok) return
    expect(upper.result.corner.x).toBeCloseTo(0)
    expect(upper.result.corner.y).toBeCloseTo(0)
    // Upper sector: both trim points have negative X (left of the crossing).
    expect(upper.result.trimA.x).toBeLessThan(0)
    expect(upper.result.trimB.x).toBeLessThan(0)
    // Lower/opposite sector: both trim points have positive X.
    expect(lower.result.trimA.x).toBeGreaterThan(0)
    expect(lower.result.trimB.x).toBeGreaterThan(0)
  })

  it('chamfers a separated 八 by extending to the virtual intersection', () => {
    // Diverging arms that meet at (0,0) when extended downward.
    const outcome = acgeChamferCurves2d(
      line([-2, 2], [-10, 10]),
      line([2, 2], [10, 10]),
      {
        mode: { method: 'distance', distance1: 2, distance2: 2 },
        hintA: { x: -6, y: 6 },
        hintB: { x: 6, y: 6 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.corner.x).toBeCloseTo(0)
    expect(outcome.result.corner.y).toBeCloseTo(0)
    const invSqrt2 = 1 / Math.SQRT2
    expect(outcome.result.trimA.x).toBeCloseTo(-2 * invSqrt2)
    expect(outcome.result.trimA.y).toBeCloseTo(2 * invSqrt2)
    expect(outcome.result.trimB.x).toBeCloseTo(2 * invSqrt2)
    expect(outcome.result.trimB.y).toBeCloseTo(2 * invSqrt2)
  })

  it('creates a sharp corner when both distances are 0', () => {
    const outcome = acgeChamferCurves2d(
      line([0, 0], [10, 0]),
      line([0, 0], [0, 10]),
      {
        mode: { method: 'distance', distance1: 0, distance2: 0 },
        hintA: { x: 5, y: 0 },
        hintB: { x: 0, y: 5 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.isCornerOnly).toBe(true)
    expect(outcome.result.trimA.x).toBeCloseTo(0)
    expect(outcome.result.trimA.y).toBeCloseTo(0)
  })

  it('extends separated lines to a sharp corner when both distances are 0', () => {
    const outcome = acgeChamferCurves2d(
      line([-2, 2], [-10, 10]),
      line([2, 2], [10, 10]),
      {
        mode: { method: 'distance', distance1: 0, distance2: 0 },
        hintA: { x: -6, y: 6 },
        hintB: { x: 6, y: 6 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.isCornerOnly).toBe(true)
    expect(outcome.result.trimA.x).toBeCloseTo(0)
    expect(outcome.result.trimA.y).toBeCloseTo(0)
    expect(outcome.result.trimB.x).toBeCloseTo(0)
    expect(outcome.result.trimB.y).toBeCloseTo(0)
  })

  it('supports angle method', () => {
    const outcome = acgeChamferCurves2d(
      line([0, 0], [10, 0]),
      line([0, 0], [0, 10]),
      {
        mode: { method: 'angle', length: 2, angle: Math.PI / 4 },
        hintA: { x: 5, y: 0 },
        hintB: { x: 0, y: 5 }
      }
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.trimA.x).toBeCloseTo(2)
    expect(outcome.result.trimB.y).toBeCloseTo(2)
  })

  it('rejects parallel lines', () => {
    const outcome = acgeChamferCurves2d(
      line([0, 0], [10, 0]),
      line([0, 1], [10, 1]),
      {
        mode: { method: 'distance', distance1: 1, distance2: 1 }
      }
    )
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error).toBe('parallel')
  })
})
