jest.mock('../src/database', () => ({
  AcDbBlockTableRecord: class MockBlockTableRecord {}
}))

jest.mock('../src/entity', () => ({
  AcDbEntity: class MockEntity {}
}))

import { AcDbRenderingCache } from '../src/misc/AcDbRenderingCache'

describe('AcDbRenderingCache', () => {
  it('manages cached values and draw fallback', () => {
    const cache = new AcDbRenderingCache()
    expect(AcDbRenderingCache.instance).toBeInstanceOf(AcDbRenderingCache)

    const key = cache.createKey('B1', 7)
    expect(key).toBe('B1_7')

    const group = {
      fastDeepClone() {
        return { ...this }
      }
    } as any

    const stored = cache.set(key, group)
    expect(stored).not.toBe(group)
    expect(cache.has(key)).toBe(true)
    expect(cache.get(key)).toBeDefined()

    const renderer = {
      group: (items: unknown[]) => ({ items, fastDeepClone: () => ({ items }) })
    } as any

    const drawn = cache.draw(renderer, null as any, 0)
    expect(drawn).toBeDefined()

    cache.clear()
    expect(cache.has(key)).toBe(false)
  })
})
