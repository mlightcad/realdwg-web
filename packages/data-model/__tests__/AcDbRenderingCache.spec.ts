jest.mock('../src/database', () => ({
  AcDbBlockTableRecord: class MockBlockTableRecord {}
}))

jest.mock('../src/entity', () => ({
  AcDbEntity: class MockEntity {}
}))

import { AcCmColor } from '@mlightcad/common'

import { AcDbRenderingCache } from '../src/misc/AcDbRenderingCache'

describe('AcDbRenderingCache', () => {
  it('manages cached values and draw fallback', () => {
    const cache = new AcDbRenderingCache()
    expect(AcDbRenderingCache.instance).toBeInstanceOf(AcDbRenderingCache)

    const color = new AcCmColor().setRGBValue(0xff0000)
    const key = cache.createKey('B1', color)
    expect(key).toBe('B1_RGB:255,0,0')

    const foreground = new AcCmColor().setForeground()
    expect(cache.createKey('B1', foreground)).toBe('B1_7')

    const black = new AcCmColor().setRGBValue(0x000000)
    expect(cache.createKey('B1', black)).toBe('B1_RGB:0,0,0')

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

    const drawn = cache.draw(renderer, null as any, new AcCmColor())
    expect(drawn).toBeDefined()

    cache.clear()
    expect(cache.has(key)).toBe(false)
  })
})
