import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { AcDbOrdinateDimension } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbOrdinateDimension', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbOrdinateDimension(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
    )
  })
})
