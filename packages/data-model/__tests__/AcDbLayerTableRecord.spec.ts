import { AcDbLayerTableRecord } from '../src/database/AcDbLayerTableRecord'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbLayerTableRecord', () => {
  it('thaws a frozen layer without clearing unrelated native flags', () => {
    const layer = new AcDbLayerTableRecord({ standardFlags: 0x24 })

    layer.isFrozen = true
    expect(layer.isFrozen).toBe(true)
    expect(layer.standardFlags).toBe(0x25)

    layer.isFrozen = false
    expect(layer.isFrozen).toBe(false)
    expect(layer.standardFlags).toBe(0x24)

    layer.isFrozen = false
    expect(layer.standardFlags).toBe(0x24)
  })

  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbLayerTableRecord())
  })
})
