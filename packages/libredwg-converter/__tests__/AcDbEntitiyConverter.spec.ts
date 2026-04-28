import {
  AcDbArc,
  AcDbAttribute,
  AcDbBlockReference,
  AcDbCircle,
  AcDbDatabase,
  acdbHostApplicationServices
} from '@mlightcad/data-model'

import { AcDbEntityConverter } from '../src/AcDbEntitiyConverter'

const baseAttrib = (overrides: Record<string, unknown> = {}) => ({
  type: 'ATTRIB',
  handle: 'A1',
  layer: 'TAGS',
  ownerBlockRecordSoftId: 'INSERT_HANDLE',
  color: 0xff0000,
  lineType: 'CONTINUOUS',
  lineweight: 25,
  lineTypeScale: 1,
  text: {
    text: 'ROOM-101',
    styleName: 'STANDARD',
    textHeight: 2.5,
    startPoint: { x: 10, y: 20, z: 0 },
    rotation: 0,
    obliqueAngle: 0,
    thickness: 0,
    halign: 0,
    valign: 0,
    xScale: 1
  },
  tag: 'COMODO',
  fieldLength: 0,
  flags: 0,
  mtextFlag: 0,
  lockPositionFlag: false,
  isReallyLocked: false,
  ...overrides
})

describe('libredwg AcDbEntityConverter', () => {
  it('converts ARC/CIRCLE OCS centers into WCS when extrusion points to -Z', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()

    const arc = converter.convert({
      type: 'ARC',
      center: { x: 1, y: 2, z: 0 },
      radius: 1,
      startAngle: 0,
      endAngle: Math.PI / 2,
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

  describe('ATTRIB common attribute propagation (issue #183 follow-up)', () => {
    beforeEach(() => {
      acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    })

    it('routes a top-level ATTRIB through convert() so common attrs are set', () => {
      const converter = new AcDbEntityConverter()
      const dbAttrib = converter.convert(baseAttrib() as any)

      expect(dbAttrib).toBeInstanceOf(AcDbAttribute)
      const attr = dbAttrib as AcDbAttribute
      // Common attrs from processCommonAttrs
      expect(attr.layer).toBe('TAGS')
      expect(attr.objectId).toBe('A1')
      expect(attr.ownerId).toBe('INSERT_HANDLE')
      expect(attr.lineType).toBe('CONTINUOUS')
      expect(attr.lineWeight).toBe(25)
      // ATTRIB-specific attrs from convertAttributeCommon
      expect(attr.tag).toBe('COMODO')
      expect(attr.textString).toBe('ROOM-101')
      expect(attr.styleName).toBe('STANDARD')
      expect(attr.height).toBe(2.5)
    })

    it('appends ATTRIBs of an INSERT through convert() preserving common attrs', () => {
      const converter = new AcDbEntityConverter()
      const dbInsert = converter.convert({
        type: 'INSERT',
        handle: 'INSERT_HANDLE',
        layer: 'BLOCKS',
        ownerBlockRecordSoftId: 'MS',
        name: 'CARIMBO',
        insertionPoint: { x: 0, y: 0, z: 0 },
        xScale: 1,
        yScale: 1,
        zScale: 1,
        rotation: 0,
        extrusionDirection: { x: 0, y: 0, z: 1 },
        attribs: [
          baseAttrib({ handle: 'A1', tag: 'COMODO', layer: 'TAGS' }),
          baseAttrib({
            handle: 'A2',
            tag: 'AREA',
            layer: 'AREAS',
            color: 0x00ff00,
            text: {
              ...(baseAttrib().text as any),
              text: '23.45 m2'
            }
          })
        ]
      } as any) as AcDbBlockReference

      expect(dbInsert).toBeInstanceOf(AcDbBlockReference)
      const attrs = Array.from(dbInsert.attributeIterator())
      expect(attrs.length).toBe(2)
      // Each ATTRIB carries its OWN layer/color (not inherited from INSERT),
      // so per-attrib layer toggles can take effect downstream.
      const tag = attrs.find(a => a.tag === 'COMODO') as AcDbAttribute
      const area = attrs.find(a => a.tag === 'AREA') as AcDbAttribute
      expect(tag.layer).toBe('TAGS')
      expect(area.layer).toBe('AREAS')
      // Each ATTRIB has its own DWG handle (objectId), so they don't collide
      // in `_attribs` Map keyed by objectId.
      expect(tag.objectId).toBe('A1')
      expect(area.objectId).toBe('A2')
      // ATTRIB.ownerId points at the INSERT, not at the BTR — matches
      // ObjectARX semantics.
      expect(tag.ownerId).toBe('INSERT_HANDLE')
      expect(area.ownerId).toBe('INSERT_HANDLE')
    })
  })
})
