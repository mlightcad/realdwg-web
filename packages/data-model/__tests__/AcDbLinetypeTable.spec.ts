import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbLinetypeTable } from '../src/database/AcDbLinetypeTable'
import { AcDbLinetypeTableRecord } from '../src/database/AcDbLinetypeTableRecord'
import type { AcGiBaseLineStyle } from '@mlightcad/graphic-interface'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbLinetypeTable', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbLinetypeTable(new AcDbDatabase()))
  })

  it('supports inherited symbol table operations', () => {
    const db = new AcDbDatabase()
    const table = db.tables.linetypeTable
    const style = {
      name: 'DASHED',
      standardFlag: 0,
      description: 'Dashed',
      totalPatternLength: 1,
      pattern: [{ elementLength: 0.5, elementTypeFlag: 0 }]
    } as AcGiBaseLineStyle
    const record = new AcDbLinetypeTableRecord(style)
    table.add(record)

    expect(table.getAt('DASHED')).toBe(record)
    expect(table.removeId(record.objectId)).toBe(true)
    expect(table.getAt('DASHED')).toBeUndefined()
  })
})
