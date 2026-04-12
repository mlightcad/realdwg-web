import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { AcDbRadialDimension } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbRadialDimension', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbRadialDimension(new AcGePoint3d(), new AcGePoint3d(1, 0, 0), 1)
    )
  })
})
