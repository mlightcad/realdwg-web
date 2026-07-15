import { AcDbBlockTableRecord, AcDbBlockTableRecordFlag } from '../src/database/AcDbBlockTableRecord'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbBlockTableRecord', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbBlockTableRecord())
  })

  it('detects unresolved xrefs from flags and empty content', () => {
    const xref = new AcDbBlockTableRecord()
    xref.name = 'BASE'
    xref.flags = AcDbBlockTableRecordFlag.Xref
    xref.pathName = 'C:\\drawings\\base.dwg'
    expect(xref.isXref).toBe(true)
    expect(xref.isOverlayReference).toBe(false)
    expect(xref.isUnresolvedXref).toBe(true)

    const overlay = new AcDbBlockTableRecord()
    overlay.flags =
      AcDbBlockTableRecordFlag.XrefOverlay | AcDbBlockTableRecordFlag.Resolved
    expect(overlay.isXref).toBe(true)
    expect(overlay.isOverlayReference).toBe(true)
    expect(overlay.isUnresolvedXref).toBe(false)
  })
})
