import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { AcDbDiametricDimension } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbDiametricDimension', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbDiametricDimension(
          new AcGePoint3d(1, 0, 0),
          new AcGePoint3d(-1, 0, 0),
          1
        )
    )
  })
})
