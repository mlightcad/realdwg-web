import { AcDbTextStyleTableRecord } from '../src/database/AcDbTextStyleTableRecord'
import type { AcGiTextStyle } from '@mlightcad/graphic-interface'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbTextStyleTableRecord', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbTextStyleTableRecord({
          name: 'Standard',
          fixedTextHeight: 0,
          widthFactor: 1,
          obliqueAngle: 0,
          textGenerationFlag: 0,
          lastHeight: 0.2,
          font: 'SimKai',
          bigFont: '',
          extendedFont: 'SimKai'
        } as AcGiTextStyle)
    )
  })
})
