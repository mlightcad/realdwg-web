import {
  acgeNurbsClosestParam,
  type AcGeNurbsCurveData,
  acgeNurbsEvaluate,
  acgeNurbsExtractSegment,
  acgeNurbsInsertKnot,
  acgeNurbsJoin,
  acgeNurbsLengthTo,
  acgeNurbsParameterRange,
  acgeNurbsSplitAt
} from '../src'

const cubic = (weights = [1, 1, 1, 1, 1, 1]): AcGeNurbsCurveData => ({
  degree: 3,
  knots: [0, 0, 0, 0, 0.4, 0.7, 1, 1, 1, 1],
  controlPoints: [
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 4, z: 1 },
    { x: 5, y: -2, z: 0 },
    { x: 7, y: 3, z: 2 },
    { x: 9, y: 0, z: 0 },
    { x: 12, y: 2, z: 1 }
  ],
  weights
})

const pointAt = (curve: AcGeNurbsCurveData, u: number) =>
  acgeNurbsEvaluate(curve, u).point

const expectSamePoint = (a: number[], b: number[], digits = 9) => {
  expect(a[0]).toBeCloseTo(b[0], digits)
  expect(a[1]).toBeCloseTo(b[1], digits)
  expect(a[2]).toBeCloseTo(b[2], digits)
}

describe('AcGeNurbsSplitUtil', () => {
  const variants = [cubic(), cubic([1, 2, 0.5, 1.5, 1, 0.8])]

  it('inserts knots without changing the shape', () => {
    for (const curve of variants) {
      const refined = acgeNurbsInsertKnot(curve, 0.55, 2)
      expect(refined.knots.filter(k => k === 0.55)).toHaveLength(2)
      expect(refined.controlPoints).toHaveLength(8)
      for (const u of [0, 0.1, 0.4, 0.55, 0.62, 0.9, 1]) {
        expectSamePoint(pointAt(refined, u), pointAt(curve, u))
      }
      // Multiplicity never exceeds the degree.
      const capped = acgeNurbsInsertKnot(curve, 0.4, 5)
      expect(capped.knots.filter(k => k === 0.4)).toHaveLength(3)
    }
  })

  it('splits and extracts clamped pieces', () => {
    for (const curve of variants) {
      const [left, right] = acgeNurbsSplitAt(curve, 0.5)!
      expect(acgeNurbsParameterRange(left)).toEqual({ start: 0, end: 0.5 })
      expect(acgeNurbsParameterRange(right)).toEqual({ start: 0.5, end: 1 })
      for (const u of [0, 0.2, 0.5]) {
        expectSamePoint(pointAt(left, u), pointAt(curve, u))
      }
      for (const u of [0.5, 0.75, 1]) {
        expectSamePoint(pointAt(right, u), pointAt(curve, u))
      }
      const middle = acgeNurbsExtractSegment(curve, 0.2, 0.8)!
      expectSamePoint(pointAt(middle, 0.2), pointAt(curve, 0.2))
      expectSamePoint(pointAt(middle, 0.6), pointAt(curve, 0.6))
      expectSamePoint(pointAt(middle, 0.8), pointAt(curve, 0.8))
      expect(acgeNurbsSplitAt(curve, 0)).toBeUndefined()
    }
  })

  it('joins pieces back into the original geometry', () => {
    for (const curve of variants) {
      const [left, right] = acgeNurbsSplitAt(curve, 0.3)!
      const joined = acgeNurbsJoin(left, right)!
      for (const u of [0, 0.15, 0.3, 0.65, 1]) {
        expectSamePoint(pointAt(joined, u), pointAt(curve, u))
      }
    }
  })

  it('finds the closest parameter and partial lengths', () => {
    const curve = cubic()
    const target = pointAt(curve, 0.37)
    const u = acgeNurbsClosestParam(curve, {
      x: target[0],
      y: target[1],
      z: target[2]
    })
    expect(u).toBeCloseTo(0.37, 7)
    const total = acgeNurbsLengthTo(curve, 1)
    expect(acgeNurbsLengthTo(curve, 0.5)).toBeLessThan(total)
    expect(acgeNurbsLengthTo(curve, 0)).toBe(0)
  })
})
