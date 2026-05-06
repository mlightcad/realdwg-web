import { AcCmColor } from '@mlightcad/common'

import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbSystemVariables } from '../src/database/AcDbSystemVariables'
import { AcDbSysVarManager } from '../src/database/AcDbSysVarManager'

describe('AcDbSysVarManager', () => {
  it('gets and sets db/non-db vars with conversion and events', () => {
    const db = new AcDbDatabase()
    const manager = AcDbSysVarManager.instance()

    const unknownName = '__unit_test_unknown__'
    expect(() => manager.getVar(unknownName, db)).toThrow(
      'System variable __unit_test_unknown__ not found!'
    )

    const oldPickbox = manager.getVar(AcDbSystemVariables.PICKBOX, db)
    const events: string[] = []
    manager.events.sysVarChanged.addEventListener(e => events.push(e.name))

    manager.setVar(AcDbSystemVariables.PICKBOX, '12', db)
    expect(manager.getVar(AcDbSystemVariables.PICKBOX, db)).toBe(12)

    manager.setVar(AcDbSystemVariables.DYNPROMPT, 'false', db)
    expect(manager.getVar(AcDbSystemVariables.DYNPROMPT, db)).toBe(false)

    manager.setVar(AcDbSystemVariables.MEASUREMENTCOLOR, 'red', db)
    expect(
      manager.getVar(AcDbSystemVariables.MEASUREMENTCOLOR, db)
    ).toBeInstanceOf(AcCmColor)

    expect(events).toContain(AcDbSystemVariables.PICKBOX.toLowerCase())

    manager.setVar(AcDbSystemVariables.CLAYER, '0', db)
    expect(manager.getVar(AcDbSystemVariables.CLAYER, db)).toBe('0')

    manager.setVar(AcDbSystemVariables.CMLSTYLE, 'FILL', db)
    expect(manager.getVar(AcDbSystemVariables.CMLSTYLE, db)).toBe('FILL')
    manager.setVar(AcDbSystemVariables.CMLSCALE, 20, db)
    expect(manager.getVar(AcDbSystemVariables.CMLSCALE, db)).toBe(20)

    manager.setVar(AcDbSystemVariables.CMLEADERSTYLE, 'ANNOTATION', db)
    expect(manager.getVar(AcDbSystemVariables.CMLEADERSTYLE, db)).toBe(
      'ANNOTATION'
    )
    manager.setVar(AcDbSystemVariables.HPCOLOR, 'RGB:10,20,30', db)
    expect(manager.getVar(AcDbSystemVariables.HPCOLOR, db)?.toString()).toBe('RGB:10,20,30')
    manager.setVar(AcDbSystemVariables.HPTRANSPARENCY, '35', db)
    expect(manager.getVar(AcDbSystemVariables.HPTRANSPARENCY, db)).toBe('35')

    manager.setVar(AcDbSystemVariables.CELTYPE, 'BYLAYER', db)
    expect(manager.getVar(AcDbSystemVariables.CELTYPE, db)).toBe('ByLayer')

    expect(() =>
      manager.setVar(AcDbSystemVariables.PICKBOX, 'NaN-input', db)
    ).toThrow('Invalid number input!')
    expect(() =>
      manager.setVar(AcDbSystemVariables.MEASUREMENTCOLOR, 'bad-color', db)
    ).toThrow('Invalid color value!')

    manager.setVar(AcDbSystemVariables.PICKBOX, oldPickbox as number, db)
  })

  it('supports registry helpers and defaults', () => {
    const db = new AcDbDatabase()
    const manager = AcDbSysVarManager.instance()

    manager.registerVar({
      name: '__UNIT_BOOL__',
      type: 'boolean',
      isDbVar: false,
      defaultValue: true
    })

    manager.registerMany([
      {
        name: '__UNIT_NUM__',
        type: 'number',
        isDbVar: false,
        defaultValue: 1
      }
    ])

    expect(manager.getDescriptor('__UNIT_BOOL__')?.name).toBe('__unit_bool__')
    expect(manager.getDefaultValue('__UNIT_BOOL__')).toBe(true)
    expect(manager.getVar('__UNIT_BOOL__', db)).toBe(true)
    expect(manager.getDefaultValue(AcDbSystemVariables.CMLSTYLE)).toBe(
      'Standard'
    )
    expect(manager.getDefaultValue(AcDbSystemVariables.CMLSCALE)).toBe(1)
    expect(manager.getDefaultValue(AcDbSystemVariables.CMLEADERSTYLE)).toBe(
      'Standard'
    )
    expect(manager.getDefaultValue(AcDbSystemVariables.HPASSOC)).toBe(1)
    expect(manager.getDefaultValue(AcDbSystemVariables.HPANG)).toBe(0)
    expect(manager.getDefaultValue(AcDbSystemVariables.HPBACKGROUNDCOLOR)?.toString()).toBe(
      'None'
    )
    expect(manager.getDefaultValue(AcDbSystemVariables.HPCOLOR)?.toString()).toBe('ByLayer')
    expect(manager.getDefaultValue(AcDbSystemVariables.HPDOUBLE)).toBe(0)
    expect(manager.getDefaultValue(AcDbSystemVariables.HPISLANDDETECTION)).toBe(
      1
    )
    expect(manager.getDefaultValue(AcDbSystemVariables.HPLAYER)).toBe('.')
    expect(manager.getDefaultValue(AcDbSystemVariables.HPNAME)).toBe('ANGLE')
    expect(manager.getDefaultValue(AcDbSystemVariables.HPSCALE)).toBe(1)
    expect(manager.getDefaultValue(AcDbSystemVariables.HPSEPARATE)).toBe(0)
    expect(manager.getDefaultValue(AcDbSystemVariables.HPTRANSPARENCY)).toBe(
      '.'
    )
    expect(manager.getDefaultValue(AcDbSystemVariables.CELTYPE)).toBe('ByLayer')
    expect(manager.getAllDescriptors().length).toBeGreaterThan(0)
    expect(() => manager.getDefaultValue('__NOT_FOUND__')).toThrow(
      'System variable __not_found__ not found!'
    )
  })
})
