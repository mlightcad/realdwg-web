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
    expect(manager.getAllDescriptors().length).toBeGreaterThan(0)
    expect(() => manager.getDefaultValue('__NOT_FOUND__')).toThrow(
      'System variable __not_found__ not found!'
    )
  })
})
