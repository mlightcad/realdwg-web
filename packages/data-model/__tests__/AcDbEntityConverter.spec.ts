import { AcDbEntityConverter } from '../src/converter/AcDbEntitiyConverter'
import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import {
  AcDbAlignedDimension,
  AcDbArc,
  AcDbCircle,
  AcDbLeader,
  AcDbMLeader,
  AcDbMLeaderContentType,
  AcDbMLeaderLineType,
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

  it('converts LEADER DXF fields into AcDbLeader state', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()
    const result = converter.convert({
      type: 'LEADER',
      styleName: 'Standard',
      isArrowheadEnabled: true,
      isSpline: true,
      leaderCreationFlag: 0,
      isHooklineSameDirection: true,
      isHooklineExists: true,
      textHeight: 2.5,
      textWidth: 7,
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 1, z: 0 }
      ],
      byBlockColor: 256,
      associatedAnnotation: 'AA',
      normal: { x: 0, y: 0, z: 1 },
      horizontalDirection: { x: 1, y: 0, z: 0 },
      offsetFromBlock: { x: 0.5, y: 0, z: 0 },
      offsetFromAnnotation: { x: 1, y: 0, z: 0 }
    } as any)

    expect(result).toBeInstanceOf(AcDbLeader)
    const leader = result as AcDbLeader
    expect(leader.numVertices).toBe(2)
    expect(leader.isSplined).toBe(true)
    expect(leader.isHookLineSameDirection).toBe(true)
    expect(leader.textHeight).toBe(2.5)
    expect(leader.textWidth).toBe(7)
    expect(leader.byBlockColor).toBe(256)
    expect(leader.associatedAnnotation).toBe('AA')
    expect(leader.offsetFromAnnotation).toMatchObject({ x: 1, y: 0, z: 0 })
  })

  it('converts dxf-json MULTILEADER text and leaderSections shape', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()
    const result = converter.convert({
      type: 'MULTILEADER',
      version: 2,
      leaderStyleId: 'STYLE',
      leaderLineType: AcDbMLeaderLineType.StraightLeader,
      leaderLineColor: 256,
      doglegEnabled: true,
      doglegLength: 2,
      landingEnabled: true,
      contentType: AcDbMLeaderContentType.MTextContent,
      textContent: 'Note',
      textAnchor: { x: 10, y: 5, z: 0 },
      textHeight: 0,
      arrowheadSize: 4,
      contentBasePosition: { x: 10, y: 5, z: 0 },
      textLineSpacingStyle: 1,
      textFrameEnabled: true,
      arrowheadOverrides: [{ index: 0, handle: 'A1' }],
      blockAttributes: [{ id: 'ATT', index: 1, width: 4, text: 'VAL' }],
      leaderSections: [
        {
          lastLeaderLinePoint: { x: 8, y: 5, z: 0 },
          lastLeaderLinePointSet: true,
          doglegVector: { x: 1, y: 0, z: 0 },
          doglegVectorSet: true,
          doglegLength: 2,
          leaderBranchIndex: 3,
          breaks: [
            {
              start: { x: 7, y: 4, z: 0 },
              end: { x: 7.5, y: 4.5, z: 0 }
            }
          ],
          leaderLines: [
            {
              leaderLineIndex: 9,
              breakPointIndexes: [0],
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 8, y: 5, z: 0 }
              ],
              breaks: [
                {
                  index: 0,
                  start: { x: 1, y: 1, z: 0 },
                  end: { x: 2, y: 2, z: 0 }
                }
              ]
            }
          ]
        }
      ]
    } as any)

    expect(result).toBeInstanceOf(AcDbMLeader)
    const mleader = result as AcDbMLeader
    expect(mleader.contents).toBe('Note')
    expect(mleader.textLocation).toMatchObject({ x: 10, y: 5, z: 0 })
    expect(mleader.version).toBe(2)
    expect(mleader.leaderStyleId).toBe('STYLE')
    expect(mleader.leaderLineType).toBe(AcDbMLeaderLineType.StraightLeader)
    expect(mleader.textHeight).toBe(4)
    expect(mleader.landingEnabled).toBe(true)
    expect(mleader.textFrameEnabled).toBe(true)
    expect(mleader.textLineSpacingStyle).toBe(1)
    expect(mleader.contentBasePosition).toMatchObject({ x: 10, y: 5, z: 0 })
    expect(mleader.arrowheadOverrides).toEqual([{ index: 0, handle: 'A1' }])
    expect(mleader.blockAttributes).toEqual([
      { id: 'ATT', index: 1, width: 4, text: 'VAL' }
    ])
    expect(mleader.numberOfLeaders).toBe(1)
    expect(mleader.leaders[0].lastLeaderLinePoint).toMatchObject({
      x: 8,
      y: 5,
      z: 0
    })
    expect(mleader.leaders[0].lastLeaderLinePointSet).toBe(true)
    expect(mleader.leaders[0].doglegVectorSet).toBe(true)
    expect(mleader.leaders[0].leaderBranchIndex).toBe(3)
    expect(mleader.leaders[0].breaks).toHaveLength(1)
    expect(mleader.leaders[0].leaderLines[0].vertices).toHaveLength(2)
    expect(mleader.leaders[0].leaderLines[0].leaderLineIndex).toBe(9)
    expect(mleader.leaders[0].leaderLines[0].breakPointIndexes).toEqual([0])
    expect(mleader.leaders[0].leaderLines[0].breaks[0].index).toBe(0)
  })
})
