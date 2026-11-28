import { AcDbViewportTableRecord } from '../src/database/AcDbViewportTableRecord'
import {
  ACDB_VPORT_UCSFOLLOW_FLAG,
  ACDB_VPORT_UCSICON_ON_FLAG,
  ACDB_VPORT_UCSICON_ORIGIN_FLAG
} from '../src/misc/AcDbConstants'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbViewportTableRecord', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbViewportTableRecord())
  })

  it('maps UCSFOLLOW onto ucsFollowMode / standardFlag bit 0x8', () => {
    const record = new AcDbViewportTableRecord()
    expect(record.ucsFollowMode).toBe(false)

    record.ucsFollowMode = true
    expect(record.ucsFollowMode).toBe(true)
    expect(record.standardFlag & ACDB_VPORT_UCSFOLLOW_FLAG).toBe(
      ACDB_VPORT_UCSFOLLOW_FLAG
    )

    record.ucsFollowMode = false
    expect(record.ucsFollowMode).toBe(false)
    expect(record.standardFlag & ACDB_VPORT_UCSFOLLOW_FLAG).toBe(0)
  })

  it('defaults UCSVP / ucsSavedWithViewport to true (AutoCAD default 1)', () => {
    const record = new AcDbViewportTableRecord()
    expect(record.ucsSavedWithViewport).toBe(true)

    record.ucsSavedWithViewport = false
    expect(record.ucsSavedWithViewport).toBe(false)
    record.ucsSavedWithViewport = true
    expect(record.ucsSavedWithViewport).toBe(true)
  })

  it('maps UCSICON onto iconEnabled / iconAtOrigin and related flag bits', () => {
    const record = new AcDbViewportTableRecord()

    record.setUcsIconSysVar(3)
    expect(record.iconEnabled).toBe(true)
    expect(record.iconAtOrigin).toBe(true)
    expect(record.getUcsIconSysVar()).toBe(3)
    expect(record.gsView.ucsIconSetting).toBe(3)
    expect(record.standardFlag & ACDB_VPORT_UCSICON_ON_FLAG).toBe(
      ACDB_VPORT_UCSICON_ON_FLAG
    )
    expect(record.standardFlag & ACDB_VPORT_UCSICON_ORIGIN_FLAG).toBe(
      ACDB_VPORT_UCSICON_ORIGIN_FLAG
    )

    record.setUcsIconSysVar(1)
    expect(record.iconEnabled).toBe(true)
    expect(record.iconAtOrigin).toBe(false)
    expect(record.standardFlag & ACDB_VPORT_UCSICON_ON_FLAG).toBe(
      ACDB_VPORT_UCSICON_ON_FLAG
    )
    expect(record.standardFlag & ACDB_VPORT_UCSICON_ORIGIN_FLAG).toBe(0)

    record.setUcsIconSysVar(0)
    expect(record.iconEnabled).toBe(false)
    expect(record.iconAtOrigin).toBe(false)
    expect(record.standardFlag & ACDB_VPORT_UCSICON_ON_FLAG).toBe(0)
    expect(record.standardFlag & ACDB_VPORT_UCSICON_ORIGIN_FLAG).toBe(0)

    expect(() => {
      record.setUcsIconSysVar(4)
    }).toThrow('Invalid UCSICON value! Valid range is 0 to 3.')
  })
})
