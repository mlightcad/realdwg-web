import { AcDbLinetypeTableRecord } from '../src/database/AcDbLinetypeTableRecord'
import type { AcGiBaseLineStyle } from '@mlightcad/graphic-interface'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbLinetypeTableRecord', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbLinetypeTableRecord({
          name: 'CONTINUOUS',
          standardFlag: 0,
          description: '',
          totalPatternLength: 0
        } as AcGiBaseLineStyle)
    )
  })
})
