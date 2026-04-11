import { AcGeLine2d } from '../src'

describe('AcGeLine2d', () => {
  it('computes length', () => {
    const line = new AcGeLine2d({ x: 0, y: 0 }, { x: 3, y: 4 })
    expect(line.length).toBe(5)
  })
})
