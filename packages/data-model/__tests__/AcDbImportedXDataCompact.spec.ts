import { AcGePoint3d } from '@mlightcad/geometry-engine'

import {
  AcDbDxfCode,
  AcDbDxfFiler,
  acdbHostApplicationServices,
  AcDbResultBuffer
} from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbLine } from '../src/entity'

const imported = () => [
  { code: AcDbDxfCode.ExtendedDataRegAppName, value: 'MYAPP' },
  { code: AcDbDxfCode.ExtendedDataAsciiString, value: 'hello-xdata' },
  { code: AcDbDxfCode.ExtendedDataInteger16, value: 42 }
]

describe('compact imported XData', () => {
  it('materializes losslessly and preserves mutable getXData semantics', () => {
    const line = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(1, 0, 0)
    )
    line.setImportedXData(imported() as never)

    const xdata = line.getXData('MYAPP')
    expect(xdata?.toArray()).toEqual(imported())

    xdata!.at(1)!.value = 'changed'
    expect(line.getXData('MYAPP')?.at(1)?.value).toBe('changed')
  })

  it('lets setXData replace imported data and removeXData remove it', () => {
    const line = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(1, 0, 0)
    )
    line.setImportedXData(imported() as never)

    line.setXData(
      new AcDbResultBuffer([
        {
          code: AcDbDxfCode.ExtendedDataRegAppName,
          value: 'MYAPP'
        },
        {
          code: AcDbDxfCode.ExtendedDataAsciiString,
          value: 'replacement'
        }
      ])
    )

    expect(line.getXData('MYAPP')?.at(1)?.value).toBe('replacement')
    line.removeXData('MYAPP')
    expect(line.getXData('MYAPP')).toBeUndefined()
  })

  it('clones/restores compact imported XData without data loss', () => {
    const line = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(1, 0, 0)
    )
    line.setImportedXData(imported() as never)

    const snapshot = line.clonePreservingIdentity()
    line.removeXData('MYAPP')
    line.restoreFrom(snapshot)

    expect(line.getXData('MYAPP')?.toArray()).toEqual(imported())
  })

  it('streams compact imported XData to DXF output', () => {
    // AcDbEntity.dxfOutFields reads database-backed entity state.
    // The previous version of this test created a detached line without
    // installing a working database, so it failed before XData output ran.
    const db = new AcDbDatabase()
    db.createDefaultData()
    acdbHostApplicationServices().workingDatabase = db

    const line = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(1, 0, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(line)
    line.setImportedXData(imported() as never)

    const filer = new AcDbDxfFiler({ database: db })
    line.dxfOut(filer, true)
    const dxf = filer.toString()

    expect(dxf).toContain('1001\nMYAPP\n')
    expect(dxf).toContain('1000\nhello-xdata\n')
    expect(dxf).toContain('1070\n42\n')
  })
})
