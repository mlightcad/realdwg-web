import { AcGeNurbsCurve } from '../src'

describe('AcGeNurbsCurve', () => {
  it('samples points along curve', () => {
    const nurbs = AcGeNurbsCurve.byKnotsControlPointsWeights(
      3,
      [0, 0, 0, 0, 1, 1, 1, 1],
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
    )

    expect(nurbs.degree()).toBe(3)
    expect(nurbs.getPoints(10)).toHaveLength(11)
  })
})
