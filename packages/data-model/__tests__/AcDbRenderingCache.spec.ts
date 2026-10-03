import { AcCmColor } from '@mlightcad/common'
import {
  AcGeMatrix3d,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import { AcDbRenderingCache } from '../src/misc/AcDbRenderingCache'

import { AcGiContext } from '@mlightcad/graphic-interface'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { acdbHostApplicationServices } from '../src/base'

let database: AcDbDatabase
const contexts: AcGiContext[] = []
beforeEach(() => {
  database = new AcDbDatabase()
  database.createDefaultData()
  acdbHostApplicationServices().workingDatabase = database
})
afterEach(() => {
  contexts
    .splice(0)
    .forEach(context => AcDbRenderingCache.releaseContext(context))
})
function scopedCache() {
  const context = new AcGiContext({ database })
  contexts.push(context)
  return AcDbRenderingCache.forContext(context, database)
}

function createMockGroup(overrides: Record<string, unknown> = {}) {
  const group = {
    applyMatrix: jest.fn(),
    addChild: jest.fn(),
    isCompacted: false,
    userData: {} as { blockCacheKey?: string },
    compactForInstancing: jest.fn(function (this: { isCompacted: boolean }) {
      this.isCompacted = true
    }),
    prepareCacheTemplate: jest.fn(),
    dispose: jest.fn(),
    fastDeepClone() {
      return createMockGroup({
        ...overrides,
        isCompacted: group.isCompacted,
        userData: { ...group.userData }
      })
    },
    ...overrides
  }
  return group
}

describe('AcDbRenderingCache', () => {
  it('manages cached values and draw fallback', () => {
    const cache = scopedCache()

    const color = new AcCmColor().setRGBValue(0xff0000)
    const key = cache.createKey('B1', color)
    expect(key).toBe('B1_RGB:255,0,0')

    const foreground = new AcCmColor().setForeground()
    expect(cache.createKey('B1', foreground)).toBe('B1_7')

    const black = new AcCmColor().setRGBValue(0x000000)
    expect(cache.createKey('B1', black)).toBe('B1_RGB:0,0,0')

    const group = createMockGroup()

    const stored = cache.set(key, group as never)
    expect(stored).toBe(group)
    expect(cache.has(key)).toBe(true)
    expect(cache.get(key)).toBeDefined()

    const renderer = {
      group: (items: unknown[]) => ({
        items,
        compactForInstancing: jest.fn(),
        fastDeepClone: () => ({ items })
      })
    } as any

    const drawn = cache.draw(renderer, null as any, new AcCmColor())
    expect(drawn).toBeDefined()

    cache.dispose()
    expect(cache.has(key)).toBe(false)
  })

  it('uses color-independent keys when the block has no ByBlock entities', () => {
    const cache = scopedCache()
    const color = new AcCmColor().setRGBValue(0xff0000)
    expect(cache.createCacheKey('Door', color, false)).toBe('Door')
    expect(cache.createCacheKey('Door', color, true)).toBe('Door_RGB:255,0,0')
  })

  it('defers mid-size compact until the first cache hit', () => {
    const cache = scopedCache()
    const blockGroup = createMockGroup({ childCount: 10 })
    const compact = blockGroup.compactForInstancing as jest.Mock

    const renderer = {
      group: jest.fn(() => blockGroup)
    }

    let iterations = 0
    const blockRecord = {
      name: 'WALL',
      database,
      newIterator: function* () {
        iterations++
        yield {
          visibility: true,
          color: new AcCmColor().setRGBValue(0xffffff),
          worldDraw: () => ({ id: 'line' })
        }
      }
    }

    cache.draw(
      renderer as never,
      blockRecord as never,
      new AcCmColor().setRGBValue(0xff0000),
      [],
      true
    )

    expect(compact).not.toHaveBeenCalled()
    expect(cache.has('WALL')).toBe(true)
    expect(iterations).toBe(1)

    // Second INSERT hits the template and triggers lazy compact.
    cache.draw(
      renderer as never,
      blockRecord as never,
      new AcCmColor().setRGBValue(0x00ff00),
      [],
      true
    )
    expect(compact).toHaveBeenCalledTimes(1)
    expect(renderer.group).toHaveBeenCalledTimes(1)
    expect(iterations).toBe(1)
  })

  it('compacts huge templates eagerly on cache miss', () => {
    const cache = scopedCache()
    const blockGroup = createMockGroup({ childCount: 40 })
    const compact = blockGroup.compactForInstancing as jest.Mock

    const renderer = {
      group: jest.fn(() => blockGroup)
    }

    const blockRecord = {
      name: 'HUGE',
      database,
      newIterator: function* () {
        yield {
          visibility: true,
          color: new AcCmColor().setRGBValue(0xffffff),
          worldDraw: () => ({ id: 'line' })
        }
      }
    }

    cache.draw(
      renderer as never,
      blockRecord as never,
      new AcCmColor().setRGBValue(0xff0000),
      [],
      true
    )

    expect(compact).toHaveBeenCalledTimes(1)
    expect(cache.has('HUGE')).toBe(true)
  })

  it('skips compactForInstancing for tiny block templates', () => {
    const cache = scopedCache()
    const blockGroup = createMockGroup({ childCount: 1 })
    const compact = blockGroup.compactForInstancing as jest.Mock
    const renderer = {
      group: jest.fn(() => blockGroup)
    }
    const blockRecord = {
      name: 'TINY',
      database,
      newIterator: function* () {
        yield {
          visibility: true,
          color: new AcCmColor().setRGBValue(0xffffff),
          worldDraw: () => ({ id: 'line' })
        }
      }
    }

    cache.draw(
      renderer as never,
      blockRecord as never,
      new AcCmColor().setRGBValue(0xffffff),
      [],
      true
    )
    cache.draw(
      renderer as never,
      blockRecord as never,
      new AcCmColor().setRGBValue(0xffffff),
      [],
      true
    )

    expect(compact).not.toHaveBeenCalled()
    expect(cache.has('TINY')).toBe(true)
  })

  it('keys ByBlock blocks by color and does not share templates', () => {
    const cache = scopedCache()
    const renderer = {
      group: jest.fn(() => createMockGroup())
    }

    const blockRecord = {
      name: 'TITLE',
      database,
      newIterator: function* () {
        yield {
          visibility: true,
          color: new AcCmColor().setByBlock(),
          worldDraw: () => ({ id: 'line' })
        }
      }
    }

    const red = new AcCmColor().setRGBValue(0xff0000)
    const green = new AcCmColor().setRGBValue(0x00ff00)
    cache.draw(renderer as never, blockRecord as never, red, [], true)
    cache.draw(renderer as never, blockRecord as never, green, [], true)

    expect(renderer.group).toHaveBeenCalledTimes(2)
    expect(cache.has(cache.createKey('TITLE', red))).toBe(true)
    expect(cache.has(cache.createKey('TITLE', green))).toBe(true)
    expect(cache.has('TITLE')).toBe(false)
  })

  it('does not cache anonymous *U blocks', () => {
    const cache = scopedCache()
    const renderer = {
      group: jest.fn(() => createMockGroup())
    }
    const blockRecord = {
      name: '*U12',
      database,
      newIterator: function* () {
        yield {
          visibility: true,
          color: new AcCmColor().setRGBValue(0xffffff),
          worldDraw: () => ({ id: 'line' })
        }
      }
    }

    cache.draw(
      renderer as never,
      blockRecord as never,
      new AcCmColor().setRGBValue(0xffffff),
      [],
      true
    )
    expect(cache.has('*U12')).toBe(false)
  })

  it('disposes cached templates on final release', () => {
    const cache = scopedCache()
    const dispose = jest.fn()
    const group = createMockGroup({
      dispose,
      fastDeepClone() {
        return createMockGroup({ dispose })
      }
    })
    cache.set('B1', group as never)
    cache.dispose()
    expect(dispose).toHaveBeenCalled()
    expect(cache.has('B1')).toBe(false)
  })

  it('prebuildAll builds color-independent blocks and reports progress', async () => {
    const cache = scopedCache()
    const renderer = {
      group: jest.fn(() => createMockGroup())
    }
    const progress = jest.fn()

    const wall = {
      name: 'WALL',
      database,
      newIterator: function* () {
        yield {
          visibility: true,
          color: new AcCmColor().setRGBValue(0xffffff),
          worldDraw: () => ({ id: 'line' })
        }
      }
    }
    const modelSpace = {
      name: '*Model_Space',
      database,
      newIterator: function* () {
        yield {
          visibility: true,
          color: new AcCmColor().setRGBValue(0xffffff),
          worldDraw: () => ({ id: 'line' })
        }
      }
    }
    const byBlock = {
      name: 'TITLE',
      database,
      newIterator: function* () {
        yield {
          visibility: true,
          color: new AcCmColor().setByBlock(),
          worldDraw: () => ({ id: 'line' })
        }
      }
    }
    const empty = {
      name: 'EMPTY',
      database,
      newIterator: function* () {
        /* empty */
      }
    }

    await cache.prebuildAll(
      renderer as never,
      [wall, modelSpace, byBlock, empty] as never,
      progress
    )

    expect(cache.has('WALL')).toBe(true)
    expect(cache.has('*Model_Space')).toBe(false)
    expect(cache.has('TITLE')).toBe(false)
    expect(cache.has('EMPTY')).toBe(false)
    expect(progress).toHaveBeenCalledWith(1, 1, 'WALL')
  })

  it('converts WCS attributes to block-local space instead of baking block transform', () => {
    const cache = scopedCache()
    const blockTransform = new AcGeMatrix3d().makeTranslation(10, 20, 0)
    const normal = new AcGeVector3d(0, 0, 1)
    const blockGeometry = { id: 'line' }
    const attribute = {
      id: 'attr',
      applyMatrix: jest.fn(),
      addChild: jest.fn(),
      fastDeepClone: jest.fn()
    }

    const blockGroup = createMockGroup()

    const renderer = {
      group: jest.fn((items: unknown[]) => {
        expect(items).toEqual([blockGeometry])
        return blockGroup
      })
    }

    const blockRecord = {
      name: 'ATTR_BLOCK',
      database,
      newIterator: function* () {
        yield {
          visibility: true,
          color: new AcCmColor().setRGBValue(0xffffff),
          worldDraw: () => blockGeometry
        }
      }
    }

    cache.draw(
      renderer as never,
      blockRecord as never,
      new AcCmColor().setRGBValue(0xffffff),
      [attribute as never],
      false,
      blockTransform,
      normal
    )

    expect(blockGroup.applyMatrix).toHaveBeenCalledTimes(1)
    const appliedTransform = blockGroup.applyMatrix.mock
      .calls[0][0] as AcGeMatrix3d
    expect(appliedTransform.elements).toEqual(blockTransform.elements)
    expect(attribute.applyMatrix).toHaveBeenCalledTimes(1)

    const inverse = attribute.applyMatrix.mock.calls[0][0] as AcGeMatrix3d
    const localPoint = new AcGePoint3d(15, 25, 0).applyMatrix4(inverse)
    expect(localPoint).toMatchObject({ x: 5, y: 5, z: 0 })
    expect(blockGroup.addChild).toHaveBeenCalledWith(attribute)
  })

  it('evicts least-recently-used entries beyond the entry cap', () => {
    AcDbRenderingCache.lruEnabled = true
    AcDbRenderingCache.lruMaxEntries = 2
    AcDbRenderingCache.lruMaxEstimatedBytes = 0
    const cache = scopedCache()

    const a = createMockGroup()
    const b = createMockGroup()
    cache.set('A', a as never)
    cache.set('B', b as never)
    expect(cache.has('A')).toBe(true)

    cache.set('C', createMockGroup() as never)
    expect(cache.has('A')).toBe(false)
    expect(cache.has('B')).toBe(true)
    expect(a.dispose).toHaveBeenCalled()

    // Touching B makes it most-recent, so C is evicted next instead of B.
    cache.get('B')
    cache.set('D', createMockGroup() as never)
    expect(cache.has('B')).toBe(true)
    expect(cache.has('C')).toBe(false)

    AcDbRenderingCache.lruMaxEntries = 512
  })

  it('evicts by estimated byte budget', () => {
    AcDbRenderingCache.lruMaxEntries = 0
    AcDbRenderingCache.lruMaxEstimatedBytes = 1000
    const cache = scopedCache()

    const big = createMockGroup({
      geometry: { attributes: { position: { array: new Float32Array(1000) } } }
    })
    const small = createMockGroup({
      geometry: { attributes: { position: { array: new Float32Array(10) } } }
    })
    cache.set('big', big as never)
    cache.set('small', small as never)

    expect(cache.has('big')).toBe(false)
    expect(cache.has('small')).toBe(true)

    AcDbRenderingCache.lruMaxEstimatedBytes = 64 * 1024 * 1024
  })

  it('retires compacted templates instead of disposing at eviction', () => {
    AcDbRenderingCache.lruMaxEntries = 1
    AcDbRenderingCache.lruMaxEstimatedBytes = 0
    const cache = scopedCache()

    const compacted = createMockGroup({ isCompacted: true })
    cache.set('C', compacted as never)
    cache.set('X', createMockGroup() as never) // evicts C

    expect(compacted.dispose).not.toHaveBeenCalled()
    expect(cache.has('C')).toBe(false)

    cache.dispose() // disposes retired + remaining entries
    expect(compacted.dispose).toHaveBeenCalled()

    AcDbRenderingCache.lruMaxEntries = 512
  })

  it('never evicts while LRU is disabled', () => {
    AcDbRenderingCache.lruEnabled = false
    AcDbRenderingCache.lruMaxEntries = 1
    AcDbRenderingCache.lruMaxEstimatedBytes = 0
    const cache = scopedCache()

    cache.set('A', createMockGroup() as never)
    cache.set('B', createMockGroup() as never)
    expect(cache.has('A')).toBe(true)
    expect(cache.has('B')).toBe(true)

    AcDbRenderingCache.lruEnabled = true
    AcDbRenderingCache.lruMaxEntries = 512
  })

  it('stamps blockCacheKey on get clones and exposes peek without cloning', () => {
    const cache = scopedCache()
    const template = createMockGroup()
    cache.set('Door', template as never)

    expect(cache.peek('Door')).toBe(template)

    const clone = cache.get('Door') as unknown as ReturnType<
      typeof createMockGroup
    >
    expect(clone).not.toBe(template)
    expect(clone.userData.blockCacheKey).toBe('Door')
    expect(
      (template.userData as { blockCacheKey?: string }).blockCacheKey
    ).toBe(undefined)
  })

  it('invokes onInvalidated when disposed', () => {
    const cache = scopedCache()
    cache.set('A', createMockGroup() as never)
    const onCleared = jest.fn()
    cache.onInvalidated = onCleared
    cache.dispose()
    expect(onCleared).toHaveBeenCalledTimes(1)
  })

  it('counts retired and shared backing buffers even with LRU disabled', () => {
    const previous = AcDbRenderingCache.lruEnabled
    AcDbRenderingCache.lruEnabled = false
    const cache = scopedCache()
    try {
      const backing = new Float32Array(24)
      const template = createMockGroup({
        isCompacted: true,
        geometry: {
          attributes: {
            position: { array: backing.subarray(0, 12) },
            normal: { array: backing.subarray(12) }
          }
        }
      })
      cache.set('old', template as never)
      const clone = cache.get('old') as unknown as ReturnType<
        typeof createMockGroup
      >
      expect(cache.stats.retainedBytes).toBe(96)
      cache.invalidate()
      expect(cache.stats).toMatchObject({
        cachedEntries: 0,
        cachedBytes: 0,
        retiredEntries: 1,
        retiredBytes: 96,
        retainedBytes: 96
      })
      expect(template.dispose).not.toHaveBeenCalled()
      expect(
        (clone.userData as { blockCacheGeneration?: number })
          .blockCacheGeneration
      ).not.toBe(cache.generation)
      cache.set(
        'new',
        createMockGroup({
          isCompacted: true,
          geometry: { attributes: { position: { array: backing } } }
        }) as never
      )
      expect(cache.stats.retainedBytes).toBe(96)
      cache.dispose()
      expect(template.dispose).toHaveBeenCalledTimes(1)
      expect(cache.stats.retainedBytes).toBe(0)
    } finally {
      cache.dispose()
      AcDbRenderingCache.lruEnabled = previous
    }
  })

  it('does not read a cached template when caching is disabled for a draw', () => {
    const cache = scopedCache()
    const renderer = { group: jest.fn(() => createMockGroup()) }
    const block = { database, name: 'NO_CACHE', newIterator: function* () {} }
    cache.draw(renderer as never, block as never, new AcCmColor())
    cache.draw(renderer as never, block as never, new AcCmColor(), [], false)
    expect(renderer.group).toHaveBeenCalledTimes(2)
    cache.dispose()
  })
})
