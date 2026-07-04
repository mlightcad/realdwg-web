import { AcCmColor, AcCmColorMethod } from '@mlightcad/common'

import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbLayerTableRecord } from '../src/database/AcDbLayerTableRecord'
import { AcDbTextStyleTableRecord } from '../src/database/AcDbTextStyleTableRecord'
import { DEFAULT_TEXT_STYLE } from '../src/misc/AcDbConstants'
import { AcDbSystemVariables } from '../src/database/AcDbSystemVariables'
import { AcDbSysVarManager } from '../src/database/AcDbSysVarManager'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbDatabase', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbDatabase())
  })

  it('assigns sequential default DWGNAME values to new databases', () => {
    const db1 = new AcDbDatabase()
    const db2 = new AcDbDatabase()

    expect(db1.dwgname).toMatch(/^Drawing\d+\.dwg$/)
    expect(db2.dwgname).toMatch(/^Drawing\d+\.dwg$/)
    expect(db1.dwgname).not.toBe(db2.dwgname)
  })

  it('updates DWGNAME when setDwgName is called', () => {
    const db = new AcDbDatabase()
    const manager = AcDbSysVarManager.instance()

    db.setDwgName('Site Plan.dxf')
    expect(db.dwgname).toBe('Site Plan.dxf')
    expect(manager.getVar(AcDbSystemVariables.DWGNAME, db)).toBe(
      'Site Plan.dxf'
    )
  })

  it('reassigns symbol-table handles that collide across tables', () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db
    const textStyle = new AcDbTextStyleTableRecord({
      name: DEFAULT_TEXT_STYLE,
      font: 'SimKai'
    })
    db.tables.textStyleTable.add(textStyle)

    const layer = new AcDbLayerTableRecord({
      name: '0',
      isOff: false,
      isPlottable: true,
      color: new AcCmColor(AcCmColorMethod.ByACI, 7),
      linetype: 'Continuous'
    })
    layer.objectId = textStyle.objectId
    const preferredLayerId = layer.objectId
    db.tables.layerTable.add(layer)

    expect(layer.objectId).toBe(preferredLayerId)
    expect(textStyle.objectId).not.toBe(layer.objectId)
    expect(db.tables.layerTable.getIdAt(layer.objectId)).toBe(layer)
    expect(db.tables.textStyleTable.getIdAt(textStyle.objectId)).toBe(textStyle)
  })

  it('initializes handle seed from hexadecimal HANDSEED values', () => {
    const db = new AcDbDatabase()
    db.initializeHandleSeed('FFFF')
    expect(db.generateHandle()).toBe('FFFF')
  })
})
