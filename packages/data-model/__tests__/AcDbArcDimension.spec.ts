import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbArcDimension } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbArcDimension', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbArcDimension(
          new AcGePoint3d(),
          new AcGePoint3d(1, 0, 0),
          new AcGePoint3d(0, 1, 0),
          new AcGePoint3d(1, 1, 0)
        )
    )
  })

  it('returns geometricExtents and recomputes when arc point changes', () => {
    const dim = new AcDbArcDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(1, 0, 0),
      new AcGePoint3d(0, 1, 0),
      new AcGePoint3d(1, 1, 0)
    )

    expect(dim.geometricExtents.min).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(dim.geometricExtents.max).toMatchObject({ x: 1, y: 1, z: 0 })

    dim.arcPoint = new AcGePoint3d(10, 20, 0)
    dim.centerPoint = new AcGePoint3d(5, 5, 0)

    expect(dim.geometricExtents.min).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(dim.geometricExtents.max).toMatchObject({ x: 10, y: 20, z: 0 })
  })

  it('measures feature arc length and builds a dim block at dimtxt height', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    acdbHostApplicationServices().workingDatabase = db
    const dim = new AcDbArcDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(0, 10, 0),
      new AcGePoint3d(10, 10, 0)
    )
    dim.dimensionStyle.dimtxt = 3
    dim.dimensionStyle.dimscale = 1
    dim.dimensionStyle.dimdec = 4
    expect(dim.dimensionType & 0x0f).toBe(8)

    const block = dim.createDimBlock('*D1')
    const entities = [...block.newIterator()]
    expect(entities.some(entity => entity.type === 'Arc')).toBe(true)
    const mtext = entities.find(entity => entity.type === 'MText') as
      | { height: number; contents: string }
      | undefined
    expect(mtext?.height).toBeCloseTo(3, 6)
    expect(mtext?.contents).toContain('15.7080')
  })
})
