import { AcCmColor } from '@mlightcad/common'
import { AcGeMatrix3d, AcGePoint3d } from '@mlightcad/geometry-engine'
import {
  AcGiContext,
  AcGiEntity,
  AcGiRenderer
} from '@mlightcad/graphic-interface'

import { acdbHostApplicationServices, AcDbOpenMode } from '../src/base'
import {
  AcDbBlockTableRecord,
  AcDbDatabase,
  AcDbLayerTableRecord
} from '../src/database'
import { AcDbBlockReference, AcDbLine } from '../src/entity'
import { AcDbRenderingCache } from '../src/misc'

// This graphics port captures the actual native entity coordinates. It qualifies
// data-model cache selection/invalidation, not Three geometry or GPU ownership.
interface CapturedGraphic extends AcGiEntity {
  points: AcGePoint3d[]
  isCompacted: boolean
  dispose: jest.Mock
  fastDeepClone(): CapturedGraphic
}

function graphic(points: AcGePoint3d[] = []): CapturedGraphic {
  const result: CapturedGraphic = {
    objectId: '',
    ownerId: '',
    layerName: '',
    visible: true,
    userData: {},
    points: points.map(point => point.clone()),
    isCompacted: true,
    highlight() {},
    unhighlight() {},
    dispose: jest.fn(),
    applyMatrix(matrix: AcGeMatrix3d) {
      result.points.forEach(point => point.applyMatrix4(matrix))
    },
    addChild(child: AcGiEntity) {
      result.points.push(
        ...(child as unknown as ReturnType<typeof graphic>).points
      )
    },
    fastDeepClone() {
      return graphic(result.points)
    }
  }
  return result
}

const contexts: AcGiContext[] = []
function renderer() {
  const context = new AcGiContext()
  contexts.push(context)
  const port = {
    context,
    subEntityTraits: {},
    lines: jest.fn((points: AcGePoint3d[]) => graphic(points)),
    group: jest.fn((children: ReturnType<typeof graphic>[]) =>
      graphic(children.flatMap(child => child.points))
    )
  }
  return port as unknown as AcGiRenderer
}

function source(length: number) {
  const database = new AcDbDatabase()
  database.createDefaultData()
  acdbHostApplicationServices().workingDatabase = database
  const block = new AcDbBlockTableRecord({ name: 'SHARED_NAME' })
  database.tables.blockTable.add(block)
  const line = new AcDbLine({ x: 0, y: 0, z: 0 }, { x: length, y: 0, z: 0 })
  block.appendEntity(line)
  const insert = new AcDbBlockReference(block.name)
  database.tables.blockTable.modelSpace.appendEntity(insert)
  return { database, block, line, insert }
}

function endpoint(insert: AcDbBlockReference, port: AcGiRenderer) {
  return (insert.worldDraw(port) as unknown as ReturnType<typeof graphic>)
    .points[1].x
}

const initialDatabase = new AcDbDatabase()
acdbHostApplicationServices().workingDatabase = initialDatabase
afterEach(() => {
  contexts
    .splice(0)
    .forEach(context => AcDbRenderingCache.releaseContext(context))
  acdbHostApplicationServices().workingDatabase = initialDatabase
})

describe('native database/render-context cache ownership', () => {
  it('retains templates across top-level INSERT appends but invalidates block additions', () => {
    const a = source(10)
    const port = renderer()
    expect(endpoint(a.insert, port)).toBe(10)
    const cache = AcDbRenderingCache.forContext(port.context, a.database)
    const template = cache.peek(a.block.name)
    const generation = cache.generation
    const added = new AcDbBlockReference(a.block.name)
    a.database.tables.blockTable.modelSpace.appendEntity(added)
    expect(endpoint(added, port)).toBe(10)
    expect(cache.peek(a.block.name)).toBe(template)
    expect(cache.generation).toBe(generation)
    expect(cache.stats.retiredEntries).toBe(0)
    a.database.transactionManager.runUndoable('Extend block', () => {
      a.block.appendEntity(
        new AcDbLine({ x: 0, y: 1, z: 0 }, { x: 20, y: 1, z: 0 })
      )
    })
    expect(cache.has(a.block.name)).toBe(false)
    expect(cache.generation).toBeGreaterThan(generation)
  })
  it.each([false, true])(
    'renders equal names in distinct databases (reverse=%s)',
    reverse => {
      const a = source(10)
      const b = source(100)
      const port = renderer()
      const order = reverse ? [b, a] : [a, b]
      expect(order.map(item => endpoint(item.insert, port))).toEqual(
        reverse ? [100, 10] : [10, 100]
      )
      expect(endpoint(a.insert, port)).toBe(10)
      expect(endpoint(b.insert, port)).toBe(100)
      expect(AcDbRenderingCache.forContext(port.context, a.database)).not.toBe(
        AcDbRenderingCache.forContext(port.context, b.database)
      )
    }
  )

  it('isolates renderer contexts and releases only the selected database', () => {
    const a = source(10)
    const b = source(100)
    const port = renderer()
    const other = renderer()
    endpoint(a.insert, port)
    endpoint(b.insert, port)
    endpoint(a.insert, other)
    const cacheA = AcDbRenderingCache.forContext(port.context, a.database)
    const cacheB = AcDbRenderingCache.forContext(port.context, b.database)
    const otherCache = AcDbRenderingCache.forContext(other.context, a.database)
    const templateA = cacheA.peek(a.block.name) as unknown as ReturnType<
      typeof graphic
    >
    const templateB = cacheB.peek(b.block.name) as unknown as ReturnType<
      typeof graphic
    >
    expect(cacheA).not.toBe(otherCache)
    AcDbRenderingCache.releaseDatabase(port.context, a.database)
    expect(templateA.dispose).toHaveBeenCalledTimes(1)
    expect(templateB.dispose).not.toHaveBeenCalled()
    expect(endpoint(b.insert, port)).toBe(100)
    expect(endpoint(a.insert, other)).toBe(10)
    expect(cacheA.stats.retainedBytes).toBe(0)
    expect(() => cacheA.get(a.block.name)).toThrow('disposed')
  })

  it('invalidates native committed block edits and undo without invalidating another source', () => {
    const a = source(10)
    const b = source(100)
    const port = renderer()
    expect(endpoint(a.insert, port)).toBe(10)
    expect(endpoint(b.insert, port)).toBe(100)
    const cacheA = AcDbRenderingCache.forContext(port.context, a.database)
    const cacheB = AcDbRenderingCache.forContext(port.context, b.database)
    const oldTemplate = cacheA.peek(a.block.name) as unknown as ReturnType<
      typeof graphic
    >
    const otherGeneration = cacheB.generation
    a.database.transactionManager.runUndoable(
      'Extend block line',
      transaction => {
        const line = transaction.getObject<AcDbLine>(
          a.line.objectId,
          AcDbOpenMode.kForWrite
        )!
        line.endPoint = new AcGePoint3d(25, 0, 0)
      }
    )
    expect(oldTemplate.dispose).not.toHaveBeenCalled()
    expect(endpoint(a.insert, port)).toBe(25)
    expect(cacheA.stats.retiredEntries).toBe(1)
    expect(cacheB.generation).toBe(otherGeneration)
    a.database.transactionManager.undo()
    expect(endpoint(a.insert, port)).toBe(10)
    AcDbRenderingCache.releaseDatabase(port.context, a.database)
    expect(oldTemplate.dispose).toHaveBeenCalledTimes(1)
  })

  it('invalidates layer edits and detaches mutation listeners on release', () => {
    const a = source(10)
    const port = renderer()
    const listeners = a.database.events.layerModified.listenerCount
    endpoint(a.insert, port)
    const cache = AcDbRenderingCache.forContext(port.context, a.database)
    expect(a.database.events.layerModified.listenerCount).toBe(listeners + 1)
    const generation = cache.generation
    const layer = a.database.tables.layerTable.getAt('0')!
    a.database.transactionManager.runUndoable('Change layer', transaction => {
      const writable = transaction.getObject<AcDbLayerTableRecord>(
        layer.objectId,
        AcDbOpenMode.kForWrite
      )!
      writable.color = new AcCmColor().setRGBValue(0xff0000)
    })
    expect(cache.generation).toBeGreaterThan(generation)
    expect(cache.has(a.block.name)).toBe(false)
    AcDbRenderingCache.releaseContext(port.context)
    expect(a.database.events.layerModified.listenerCount).toBe(listeners)
    expect(() =>
      AcDbRenderingCache.forContext(port.context, a.database)
    ).toThrow('released context')
  })

  it('redraws current geometry even when the view listener predates the cache', () => {
    const a = source(10)
    const port = renderer()
    const observed: number[] = []
    // Existing host-view listeners can survive a renderer/cache reset.
    a.database.events.entityModified.addEventListener(() => {
      observed.push(endpoint(a.insert, port))
    })
    expect(endpoint(a.insert, port)).toBe(10)
    const cache = AcDbRenderingCache.forContext(port.context, a.database)
    const generation = cache.generation
    a.database.transactionManager.runUndoable(
      'Extend block line',
      transaction => {
        const line = transaction.getObject<AcDbLine>(
          a.line.objectId,
          AcDbOpenMode.kForWrite
        )!
        line.endPoint = new AcGePoint3d(35, 0, 0)
      }
    )
    expect(observed).toEqual([35])
    expect(cache.generation).toBe(generation + 1)
    expect(cache.has(a.block.name)).toBe(true)
    expect(endpoint(a.insert, port)).toBe(35)
  })
})
