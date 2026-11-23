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
