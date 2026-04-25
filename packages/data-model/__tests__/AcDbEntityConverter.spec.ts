import { AcDbEntityConverter } from '../src/converter/AcDbEntitiyConverter'
import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import {
  AcDbAlignedDimension,
  AcDbArc,
  AcDbCircle,
  AcDbPolyline,
  AcDbRotatedDimension
} from '../src/entity'

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

  it('maps aligned and rotated dimension subclass markers to the matching AcDb classes', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()

    const baseDimensionPayload = {
      type: 'DIMENSION',
      definitionPoint: { x: 3, y: 4, z: 0 },
      subDefinitionPoint1: { x: 0, y: 0, z: 0 },
      subDefinitionPoint2: { x: 10, y: 0, z: 0 },
      insertionPoint: { x: 1, y: 2 },
      rotationAngle: 30,
      textPoint: { x: 5, y: 2, z: 0 },
      styleName: 'Standard',
      text: '10.000',
      measurement: 10,
      extrusionDirection: { x: 0, y: 0, z: 1 }
    }

    const aligned = converter.convert({
      ...baseDimensionPayload,
      subclassMarker: 'AcDbAlignedDimension'
    } as any)

    const rotated = converter.convert({
      ...baseDimensionPayload,
      subclassMarker: 'AcDbRotatedDimension'
    } as any)

    expect(aligned).toBeInstanceOf(AcDbAlignedDimension)
    expect(rotated).toBeInstanceOf(AcDbRotatedDimension)
  })

  it('converts ARC/CIRCLE OCS geometry into WCS when extrusion points to -Z', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()

    const arc = converter.convert({
      type: 'ARC',
      center: { x: 1, y: 2, z: 0 },
      radius: 1,
      startAngle: 0,
      endAngle: 90,
      extrusionDirection: { x: 0, y: 0, z: -1 }
    } as any)

    const circle = converter.convert({
      type: 'CIRCLE',
      center: { x: 1, y: 2, z: 0 },
      radius: 1,
      extrusionDirection: { x: 0, y: 0, z: -1 }
    } as any)

    expect(arc).toBeInstanceOf(AcDbArc)
    expect(circle).toBeInstanceOf(AcDbCircle)

    const dbArc = arc as AcDbArc
    const dbCircle = circle as AcDbCircle

    expect(dbArc.center).toMatchObject({ x: -1, y: 2, z: 0 })
    expect(dbArc.startPoint).toMatchObject({ x: -2, y: 2, z: 0 })
    expect(dbArc.endPoint).toMatchObject({ x: -1, y: 3, z: 0 })
    expect(dbCircle.center).toMatchObject({ x: -1, y: 2, z: 0 })
  })
})
