import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbViewportTable } from '../src/database/AcDbViewportTable'
import { AcDbViewportTableRecord } from '../src/database/AcDbViewportTableRecord'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbViewportTable', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbViewportTable(new AcDbDatabase()))
  })

  it('supports inherited symbol table operations', () => {
    const db = new AcDbDatabase()
    const table = db.tables.viewportTable
    const record = new AcDbViewportTableRecord()
    record.name = '*Active'
    table.add(record)

    expect(table.has('*Active')).toBe(true)
    expect(table.remove('*Active')).toBe(true)
    expect(table.getAt('*Active')).toBeUndefined()
  })
})
