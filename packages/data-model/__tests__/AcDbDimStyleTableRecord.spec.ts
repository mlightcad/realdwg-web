import { AcDbDxfFiler, acdbHostApplicationServices } from '../src/base'
import {
  AcDbDatabase,
  AcDbDimStyleTableRecord
} from '../src/database'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbDimStyleTableRecord', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbDimStyleTableRecord())
  })

  it('round-trips dimtfill, dimtfillclr, and dimtxtdirection through DXF', () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db

    const written = new AcDbDimStyleTableRecord({
      name: 'FillStyle',
      dimtfill: 2,
      dimtfillclr: 3,
      dimtxtdirection: 1
    })
    written.objectId = 'FF01'
    db.tables.dimStyleTable.add(written)

    const outFiler = new AcDbDxfFiler({ database: db })
    written.dxfOut(outFiler)
    const dxf = outFiler.toString()

    expect(dxf).toContain('\n69\n2\n')
    expect(dxf).toMatch(/\n70\n0\n[\s\S]*\n70\n3\n/)
    expect(dxf).toContain('\n295\n1\n')

    const snippet = [
      '0',
      'DIMSTYLE',
      '105',
      'FF02',
      '100',
      'AcDbSymbolTableRecord',
      '100',
      'AcDbDimStyleTableRecord',
      '2',
      'FillStyle',
      '70',
      '0',
      '69',
      '2',
      '70',
      '3',
      '295',
      '1'
    ].join('\n')
    const inFiler = AcDbDxfFiler.fromString(snippet, { database: db })
    expect(inFiler.readItem()?.value).toBe('DIMSTYLE')

    const read = new AcDbDimStyleTableRecord()
    read.dxfIn(inFiler)
    expect(read.name).toBe('FillStyle')
    expect(read.dimtfill).toBe(2)
    expect(read.dimtfillclr).toBe(3)
    expect(read.dimtxtdirection).toBe(1)
  })

  it('accepts DIMTXTDIRECTION from group code 294', () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db

    const snippet = [
      '0',
      'DIMSTYLE',
      '105',
      'FF03',
      '100',
      'AcDbSymbolTableRecord',
      '100',
      'AcDbDimStyleTableRecord',
      '2',
      'Rtl',
      '70',
      '0',
      '294',
      '1'
    ].join('\n')
    const filer = AcDbDxfFiler.fromString(snippet, { database: db })
    expect(filer.readItem()?.value).toBe('DIMSTYLE')

    const read = new AcDbDimStyleTableRecord()
    read.dxfIn(filer)
    expect(read.dimtxtdirection).toBe(1)
  })
})
