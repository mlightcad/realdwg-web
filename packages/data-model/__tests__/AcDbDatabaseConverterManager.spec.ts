import { AcDbDxfConverter } from '../src/converter/AcDbDxfConverter'
import {
  AcDbDatabaseConverterManager,
  AcDbFileType
} from '../src/database/AcDbDatabaseConverterManager'

describe('AcDbDatabaseConverterManager', () => {
  it('creates singleton instance with default dxf converter', () => {
    const manager = AcDbDatabaseConverterManager.instance
    expect(AcDbDatabaseConverterManager.createInstance()).toBe(manager)
    expect(manager.get(AcDbFileType.DXF)).toBeInstanceOf(AcDbDxfConverter)

    const fileTypes = Array.from(manager.fileTypes)
    expect(fileTypes).toContain(AcDbFileType.DXF)
  })

  it('registers and unregisters converters with events', () => {
    const manager = AcDbDatabaseConverterManager.instance
    const custom = new AcDbDxfConverter()

    const registered: string[] = []
    const unregistered: string[] = []

    manager.events.registered.addEventListener(evt =>
      registered.push(evt.fileType)
    )
    manager.events.unregistered.addEventListener(evt =>
      unregistered.push(evt.fileType)
    )

    manager.register('custom', custom)
    expect(manager.get('custom')).toBe(custom)
    expect(registered).toContain('custom')

    manager.unregister('custom')
    expect(manager.get('custom')).toBeUndefined()
    expect(unregistered).toContain('custom')

    manager.unregister('missing')
  })
})
