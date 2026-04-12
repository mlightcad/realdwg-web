import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { AcDb3PointAngularDimension } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDb3PointAngularDimension', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDb3PointAngularDimension(
          new AcGePoint3d(),
          new AcGePoint3d(1, 0, 0),
          new AcGePoint3d(0, 1, 0),
          new AcGePoint3d(1, 1, 0)
        )
    )
  })
})
