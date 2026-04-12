import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { AcDbAlignedDimension } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

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
})
