import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { acdbHostApplicationServices } from '../src/base'
import { AcDbBlockTableRecord, AcDbDatabase } from '../src/database'
import { AcDbAlignedDimension, AcDbLine } from '../src/entity'
import { AcDbOsnapMode } from '../src/misc'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

const createDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

describe('AcDbAlignedDimension', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbAlignedDimension(
          new AcGePoint3d(),
          new AcGePoint3d(1, 0, 0),
          new AcGePoint3d(0, 1, 0)
        )
    )
  })

  it('resolves osnap points through its anonymous dimension block', () => {
    const db = createDb()

    const dimBlock = new AcDbBlockTableRecord()
    dimBlock.name = '*D_TEST'
    const line = new AcDbLine(
      new AcGePoint3d(1, 2, 0),
      new AcGePoint3d(4, 2, 0)
    )
    dimBlock.appendEntity(line)
    db.tables.blockTable.add(dimBlock)

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(5, 0, 0),
      new AcGePoint3d(5, 1, 0)
    )
    dim.dimBlockId = '*D_TEST'
    dim.dimBlockPosition = new AcGePoint3d(10, 20, 0)
    db.tables.blockTable.modelSpace.appendEntity(dim)

    const snapsByGsMark: AcGePoint3d[] = []
    dim.subGetOsnapPoints(
      AcDbOsnapMode.EndPoint,
      new AcGePoint3d(),
      new AcGePoint3d(),
      snapsByGsMark,
      line.objectId
    )

    expect(snapsByGsMark).toHaveLength(2)
    expect(snapsByGsMark[0]).toMatchObject({ x: 11, y: 22, z: 0 })
    expect(snapsByGsMark[1]).toMatchObject({ x: 14, y: 22, z: 0 })

    const snapsWithoutGsMark: AcGePoint3d[] = []
    dim.subGetOsnapPoints(
      AcDbOsnapMode.EndPoint,
      new AcGePoint3d(),
      new AcGePoint3d(),
      snapsWithoutGsMark
    )
    expect(snapsWithoutGsMark.length).toBeGreaterThanOrEqual(2)
  })

  it('returns transformed geometric extents from dimension block', () => {
    const db = createDb()

    const dimBlock = new AcDbBlockTableRecord()
    dimBlock.name = '*D_EXTENTS'
    dimBlock.appendEntity(
      new AcDbLine(new AcGePoint3d(1, 2, 0), new AcGePoint3d(4, 6, 0))
    )
    db.tables.blockTable.add(dimBlock)

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(5, 0, 0),
      new AcGePoint3d(5, 1, 0)
    )
    dim.dimBlockId = '*D_EXTENTS'
    dim.dimBlockPosition = new AcGePoint3d(10, 20, 0)
    db.tables.blockTable.modelSpace.appendEntity(dim)

    const extents = dim.geometricExtents
    expect(extents.isEmpty()).toBe(false)
    expect(extents.min).toMatchObject({ x: 11, y: 22, z: 0 })
    expect(extents.max).toMatchObject({ x: 14, y: 26, z: 0 })
  })
})
