import { AcDbEntityConverter } from '../src/converter/AcDbEntitiyConverter'
import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbPolyline } from '../src/entity'

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

  it('applies LWPOLYLINE constantWidth to vertex widths when vertex widths are absent', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()
    const result = converter.convert({
      type: 'LWPOLYLINE',
      subclassMarker: 'AcDbPolyline',
      numberOfVertices: 2,
      flag: 0,
      constantWidth: 4,
      elevation: 0,
      thickness: 0,
      extrusionDirection: { x: 0, y: 0, z: 1 },
      vertices: [
        { id: 1, x: 0, y: 0, bulge: 0 },
        { id: 2, x: 10, y: 0, bulge: 0 }
      ]
    } as any)

    expect(result).toBeInstanceOf(AcDbPolyline)
    const polyline = result as AcDbPolyline
    const vertices = polyline.properties.groups
      .find(group => group.groupName === 'geometry')
      ?.properties.find(property => property.name === 'vertices')
      ?.accessor.get() as Array<{
      startWidth?: number
      endWidth?: number
    }>

    expect(vertices).toHaveLength(2)
    expect(vertices[0]).toMatchObject({ startWidth: 4, endWidth: 4 })
    expect(vertices[1]).toMatchObject({ startWidth: 4, endWidth: 4 })
  })
})
