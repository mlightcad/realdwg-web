import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbDatabase', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbDatabase())
  })
})
