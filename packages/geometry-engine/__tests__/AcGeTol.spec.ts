import { AcGeTol } from '../src'

describe('AcGeTol', () => {
  it('compares values and points with tolerance', () => {
    const tol = new AcGeTol()
    expect(tol.equalPoint2d({ x: 1, y: 1 }, { x: 1 + 1e-9, y: 1 })).toBe(true)
    expect(AcGeTol.equal(1, 1 + 1e-9)).toBe(true)
    expect(AcGeTol.equalToZero(1e-12)).toBe(true)
    expect(AcGeTol.great(2, 1)).toBe(true)
    expect(AcGeTol.great(1, 2)).toBe(false)
    expect(AcGeTol.less(1, 2)).toBe(true)
    expect(AcGeTol.less(2, 1)).toBe(false)
  })
})
