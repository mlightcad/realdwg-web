import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbOpenMode } from '../src/base'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbChangeRecorder } from '../src/database/transaction/AcDbChangeRecorder'
import { AcDbEntity } from '../src/entity/AcDbEntity'
import { AcDbLine } from '../src/entity/AcDbLine'

/**
 * Large edits (e.g. importing a page-sized PDF, ~340k entities) used to be
 * quadratic in the recorder and in undo, and overflowed the call stack when
 * batched events were spread into `push(...)`.
 */

/** Above V8's spread-argument limit (~125k), so `push(...items)` throws. */
const LARGE = 150_000

const createLines = (count: number) => {
  const lines: AcDbLine[] = []
  for (let i = 0; i < count; i++) {
    lines.push(new AcDbLine(new AcGePoint3d(i, 0, 0), new AcGePoint3d(i, 1, 0)))
  }
  return lines
}

const modelSpaceCount = (db: AcDbDatabase) =>
  [...db.tables.blockTable.modelSpace.newIterator()].length

const eventSize = (entity: AcDbEntity | AcDbEntity[]) =>
  Array.isArray(entity) ? entity.length : 1

describe('transaction scaling', () => {
  it('undoes and redoes a very large append in one record', () => {
    const db = new AcDbDatabase()
    const ms = db.tables.blockTable.modelSpace
    const tm = db.transactionManager
    const before = modelSpaceCount(db)
    let erased = 0
    let appended = 0
    db.events.entityErased.addEventListener(args => {
      erased += eventSize(args.entity)
    })
    db.events.entityAppended.addEventListener(args => {
      appended += eventSize(args.entity)
    })

    tm.startUndoMark('import')
    tm.startTransaction()
    ms.appendEntity(createLines(LARGE))
    tm.commitTransaction()
    tm.endUndoMark()
    expect(modelSpaceCount(db)).toBe(before + LARGE)

    appended = 0
    expect(tm.undo()).toBe(true)
    expect(modelSpaceCount(db)).toBe(before)
    expect(erased).toBe(LARGE)

    expect(tm.redo()).toBe(true)
    expect(modelSpaceCount(db)).toBe(before + LARGE)
    expect(appended).toBe(LARGE)
  }, 60_000)

  it('aborts a very large append', () => {
    const db = new AcDbDatabase()
    const tm = db.transactionManager
    const before = modelSpaceCount(db)

    tm.startTransaction()
    db.tables.blockTable.modelSpace.appendEntity(createLines(LARGE))
    tm.abortTransaction()

    expect(modelSpaceCount(db)).toBe(before)
  }, 60_000)

  it('records appends and modifies in linear time', () => {
    const time = (count: number) => {
      const db = new AcDbDatabase()
      const lines = createLines(count)
      const tm = db.transactionManager
      const start = performance.now()
      const tr = tm.startTransaction()
      db.tables.blockTable.modelSpace.appendEntity(lines)
      for (const line of lines) {
        tr.getObject(line.objectId, AcDbOpenMode.kForWrite)
      }
      tm.commitTransaction()
      return performance.now() - start
    }
    time(5_000) // warm up the JIT
    const small = time(20_000)
    const large = time(80_000)
    // 4x the work: linear stays near 4x, quadratic lands near 16x.
    expect(large / small).toBeLessThan(10)
  }, 60_000)
})

describe('AcDbChangeRecorder', () => {
  const container = { type: 'blockTableRecord' as const, ownerId: 'ms' }

  it('cancels an append with a later remove of the same object', () => {
    const db = new AcDbDatabase()
    const [a, b] = createLines(2)
    db.tables.blockTable.modelSpace.appendEntity([a, b])
    const recorder = new AcDbChangeRecorder()

    recorder.recordAppend(container, a)
    recorder.recordAppend(container, b)
    recorder.recordRemove(container, a)

    const changes = recorder.getChanges()
    expect(changes).toHaveLength(1)
    const [only] = changes
    expect(only.kind === 'append' && only.object.objectId).toBe(b.objectId)
  })

  it('keeps one modify entry per object and answers hasModify', () => {
    const db = new AcDbDatabase()
    const [a] = createLines(1)
    db.tables.blockTable.modelSpace.appendEntity(a)
    const recorder = new AcDbChangeRecorder()

    recorder.recordModify(a)
    recorder.recordModify(a)

    expect(recorder.getChanges()).toHaveLength(1)
    expect(recorder.hasModify(a.objectId)).toBe(true)
    recorder.clear()
    expect(recorder.hasModify(a.objectId)).toBe(false)
    expect(recorder.getChanges()).toHaveLength(0)
  })

  it('cancels merged structural changes from a child recorder', () => {
    const db = new AcDbDatabase()
    const [a] = createLines(1)
    db.tables.blockTable.modelSpace.appendEntity(a)
    const parent = new AcDbChangeRecorder()
    const child = new AcDbChangeRecorder()

    parent.recordAppend(container, a)
    child.recordRemove(container, a)
    parent.mergeFrom(child)

    expect(parent.getChanges()).toHaveLength(0)
  })
})
