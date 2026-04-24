import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbRotatedDimension } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbRotatedDimension', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbRotatedDimension(
          new AcGePoint3d(),
          new AcGePoint3d(1, 0, 0),
          new AcGePoint3d(0, 1, 0)
        )
    )
  })

  it('writes AcDbRotatedDimension subclass marker in DXF output', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()

    const rotated = new AcDbRotatedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(5, 2, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(rotated)

    const dxf = db.dxfOut(undefined, 6)
    expect(dxf).toContain('100\nAcDbRotatedDimension\n')
  })
})
