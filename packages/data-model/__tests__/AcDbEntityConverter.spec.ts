import { AcDbEntityConverter } from '../src/converter/AcDbEntitiyConverter'
import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'

describe('AcDbEntityConverter', () => {
  it('returns null for unsupported type', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()
    const result = converter.convert({ type: 'UNKNOWN' } as any)
    expect(result).toBeNull()
  })

  it('converts simple line entity with common attrs', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()
    const result = converter.convert({
      type: 'LINE',
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 1, y: 1, z: 0 },
      layer: 'L1',
      handle: '10',
      ownerBlockRecordSoftId: '20',
      lineType: 'Continuous',
      lineweight: 25,
      lineTypeScale: 2,
      color: 0xff0000,
      colorIndex: 1,
      colorName: 'red',
      isVisible: true,
      transparency: 0x020000ff
    } as any)

    expect(result).toBeTruthy()
    expect(result?.type).toBe('Line')
    expect(result?.layer).toBe('L1')
    expect(result?.objectId).toBe('10')
    expect(result?.ownerId).toBe('20')
  })
})
