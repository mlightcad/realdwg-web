import {
  AcDbDatabase,
  acdbHostApplicationServices,
  AcDbLine
} from '@mlightcad/data-model'
import type { DwgEntity } from '@mlightcad/libredwg-web'

import { AcDbEntityConverter } from '../src/AcDbEntitiyConverter'

describe('LibreDWG compact XData import', () => {
  it('preserves both entity XData and extensionDictionary', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()

    const line = converter.convert({
      type: 'LINE',
      handle: 'A1',
      layer: '0',
      ownerBlockRecordSoftId: 'MS',
      ownerDictionaryHardId: 'ABCD',
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 1, y: 0, z: 0 },
      xdata: {
        appName: 'MYAPP',
        value: [
          { code: 1000, value: 'hello-xdata' },
          { code: 1070, value: 42 }
        ]
      }
    } as unknown as DwgEntity) as AcDbLine

    expect(line).toBeInstanceOf(AcDbLine)
    expect(line.extensionDictionary).toBe('ABCD')
    expect(line.getXData('MYAPP')?.toArray()).toEqual([
      { code: 1001, value: 'MYAPP' },
      { code: 1000, value: 'hello-xdata' },
      { code: 1070, value: 42 }
    ])
  })
})
