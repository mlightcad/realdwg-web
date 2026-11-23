import {
  AcCmColor,
  AcCmColorMethod,
  AcCmTransparency,
  AcCmTransparencyMethod
} from '@mlightcad/common'
import {
  AcGeMatrix3d,
  AcGePoint2d,
  AcGePoint3d,
  AcGePolyline2d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'
import {
  AcGiLineWeight,
  AcGiMTextAttachmentPoint
} from '@mlightcad/graphic-interface'

import {
  AcDbBlockTableRecord,
  AcDbDatabase,
  AcDbDimStyleTableRecord
} from '../src/database'
import {
  AcDb2dPolyline,
  AcDb3dPolyline,
  AcDbAlignedDimension,
  AcDbArc,
  AcDbAttribute,
  AcDbAttributeDefinition,
  AcDbBlockReference,
  AcDbCircle,
  AcDbEllipse,
  AcDbEntity,
  AcDbFace,
  AcDbHatch,
  AcDbLeader,
  AcDbLine,
  AcDbMInsertBlock,
  AcDbMLeader,
  AcDbMText,
  acdbMTextToPlainParagraphs,
  AcDbPoint,
  AcDbPoly2dType,
  AcDbPoly3dType,
  AcDbPolyFaceMesh,
  AcDbPolygonMesh,
  AcDbPolyline,
  acdbTessellateHatchPattern,
  AcDbText,
  AcDbTextHorizontalMode,
  acdbTransformForExplode
} from '../src/entity'
import { setupWorkingDatabase } from '../test-utils/entityTestUtils'

const expectPoint = (
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z?: number }
) => {
  expect(actual.x).toBeCloseTo(expected.x, 9)
  expect(actual.y).toBeCloseTo(expected.y, 9)
  expect(actual.z).toBeCloseTo(expected.z ?? 0, 9)
}

const ellipsePointAt = (ellipse: AcDbEllipse, angle: number) => {
  const major = new AcGeVector3d(ellipse.majorAxis).normalize()
  const minor = new AcGeVector3d()
    .crossVectors(new AcGeVector3d(ellipse.normal), major)
    .normalize()
  return new AcGePoint3d(ellipse.center)
    .addScaledVector(major, ellipse.majorAxisRadius * Math.cos(angle))
    .addScaledVector(minor, ellipse.minorAxisRadius * Math.sin(angle))
}

const addBlock = (db: AcDbDatabase, name: string, entities: AcDbEntity[]) => {
  const block = new AcDbBlockTableRecord()
  block.name = name
  db.tables.blockTable.add(block)
  entities.forEach(entity => block.appendEntity(entity))
  return block
}

describe('AcDbEntity.explode', () => {
  let db: AcDbDatabase
  beforeEach(() => {
    db = setupWorkingDatabase()
  })

  it('returns no entities for primitives that cannot be exploded', () => {
    expect(
      new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0)).explode()
    ).toEqual([])
    expect(new AcDbCircle(new AcGePoint3d(), 1).explode()).toEqual([])
    expect(new AcDbText().explode()).toEqual([])
  })

  it('copies general properties with setPropertiesFrom', () => {
    const source = new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
    source.layer = 'WALL'
    source.color = new AcCmColor(AcCmColorMethod.ByACI, 1)
    source.lineType = 'DASHED'
    source.linetypeScale = 2
    const target = new AcDbLine(new AcGePoint3d(), new AcGePoint3d(0, 1, 0))
    target.setPropertiesFrom(source)
    expect(target.layer).toBe('WALL')
    expect(target.color.colorIndex).toBe(1)
    expect(target.lineType).toBe('DASHED')
    expect(target.linetypeScale).toBe(2)
    // The color is copied, not shared.
    target.color = new AcCmColor(AcCmColorMethod.ByACI, 3)
    expect(source.color.colorIndex).toBe(1)
  })

  describe('AcDbPolyline', () => {
    it('explodes into one line or arc per segment, including the closing one', () => {
      const pline = new AcDbPolyline()
      pline.addVertexAt(0, new AcGePoint2d(0, 0))
      pline.addVertexAt(1, new AcGePoint2d(10, 0), 1)
      pline.addVertexAt(2, new AcGePoint2d(10, 10))
      pline.closed = true
      pline.layer = 'P'
      pline.elevation = 5

      const parts = pline.explode()
      expect(parts.map(p => p.constructor)).toEqual([
        AcDbLine,
        AcDbArc,
        AcDbLine
      ])
      parts.forEach(p => expect(p.layer).toBe('P'))

      const arc = parts[1] as AcDbArc
      // Bulge 1 = semicircle bulging to the right of the chord (CCW).
      expectPoint(arc.center, { x: 10, y: 5, z: 5 })
      expect(arc.radius).toBeCloseTo(5)
      expectPoint(arc.startPoint, { x: 10, y: 0, z: 5 })
      expectPoint(arc.endPoint, { x: 10, y: 10, z: 5 })
      expectPoint(arc.midPoint, { x: 15, y: 5, z: 5 })

      const closing = parts[2] as AcDbLine
      expectPoint(closing.startPoint, { x: 10, y: 10, z: 5 })
      expectPoint(closing.endPoint, { x: 0, y: 0, z: 5 })
    })

    it('stores clockwise (negative bulge) arcs counter-clockwise', () => {
      const pline = new AcDbPolyline()
      pline.addVertexAt(0, new AcGePoint2d(0, 0), -1)
      pline.addVertexAt(1, new AcGePoint2d(10, 0))
      const [arc] = pline.explode() as AcDbArc[]
      expect(arc).toBeInstanceOf(AcDbArc)
      expectPoint(arc.center, { x: 5, y: 0 })
      // Clockwise from (0,0) to (10,0) passes above the chord.
      expectPoint(arc.midPoint, { x: 5, y: 5 })
    })

    it('skips zero-length segments and cannot explode a single vertex', () => {
      const pline = new AcDbPolyline()
      pline.addVertexAt(0, new AcGePoint2d(0, 0))
      expect(pline.explode()).toEqual([])
      pline.addVertexAt(1, new AcGePoint2d(0, 0))
      pline.addVertexAt(2, new AcGePoint2d(3, 4))
      expect(pline.explode()).toHaveLength(1)
    })

    it('exposes bulge and widths like ObjectARX', () => {
      const pline = new AcDbPolyline()
      pline.addVertexAt(0, new AcGePoint2d(0, 0), 0.5, 1, 2)
      expect(pline.getBulgeAt(0)).toBe(0.5)
      expect(pline.getStartWidthAt(0)).toBe(1)
      expect(pline.getEndWidthAt(0)).toBe(2)
      expect(pline.getBulgeAt(5)).toBe(0)
    })
  })

  it('explodes 2D and 3D polylines', () => {
    const p2d = new AcDb2dPolyline(
      AcDbPoly2dType.SimplePoly,
      [
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 0 }
      ],
      0,
      false,
      0,
      0,
      [1, 0]
    )
    const [arc] = p2d.explode()
    expect(arc).toBeInstanceOf(AcDbArc)

    const p3d = new AcDb3dPolyline(
      AcDbPoly3dType.SimplePoly,
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 1 },
        { x: 1, y: 1, z: 2 }
      ],
      true
    )
    const lines = p3d.explode() as AcDbLine[]
    expect(lines).toHaveLength(3)
    expectPoint(lines[1].endPoint, { x: 1, y: 1, z: 2 })
  })

  describe('AcDbBlockReference', () => {
    it('explodes one level and keeps the properties of the block entities', () => {
      const inner = new AcDbLine(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(1, 0, 0)
      )
      inner.layer = '0'
      inner.color = new AcCmColor(AcCmColorMethod.ByBlock)
      addBlock(db, 'INNER', [new AcDbCircle(new AcGePoint3d(), 1)])
      const nested = new AcDbBlockReference('INNER')
      addBlock(db, 'OUTER', [inner, nested])

      const ref = new AcDbBlockReference('OUTER')
      ref.position = new AcGePoint3d(10, 20, 3)
      ref.rotation = Math.PI / 2
      ref.scaleFactors = new AcGePoint3d(2, 2, 2)
      ref.layer = 'REF'
      db.tables.blockTable.modelSpace.appendEntity(ref)

      const parts = ref.explode()
      expect(parts).toHaveLength(2)
      const line = parts[0] as AcDbLine
      expectPoint(line.startPoint, { x: 10, y: 20, z: 3 })
      expectPoint(line.endPoint, { x: 10, y: 22, z: 3 })
      expect(line.layer).toBe('0')
      expect(line.color.isByBlock).toBe(true)
      expect(parts[1]).toBeInstanceOf(AcDbBlockReference)
      expect((parts[1] as AcDbBlockReference).blockName).toBe('INNER')
      // Exploding never touches the original entity.
      expect(db.tables.blockTable.modelSpace.newIterator().toArray()).toEqual([
        ref
      ])
    })

    it('honours the block base point', () => {
      const block = addBlock(db, 'B', [
        new AcDbLine(new AcGePoint3d(5, 5, 0), new AcGePoint3d(6, 5, 0))
      ])
      block.origin = new AcGePoint3d(5, 5, 0)
      const ref = new AcDbBlockReference('B')
      db.tables.blockTable.modelSpace.appendEntity(ref)
      const [line] = ref.explode() as AcDbLine[]
      expectPoint(line.startPoint, { x: 0, y: 0 })
    })

    it('turns circles and arcs into ellipses under non-uniform scale', () => {
      addBlock(db, 'C', [
        new AcDbCircle(new AcGePoint3d(1, 0, 0), 1),
        new AcDbArc(new AcGePoint3d(), 1, 0, Math.PI / 2)
      ])
      const ref = new AcDbBlockReference('C')
      ref.scaleFactors = new AcGePoint3d(3, 1, 1)
      db.tables.blockTable.modelSpace.appendEntity(ref)
      const [circle, arc] = ref.explode() as AcDbEllipse[]
      expect(circle).toBeInstanceOf(AcDbEllipse)
      expectPoint(circle.center, { x: 3, y: 0 })
      expect(circle.majorAxisRadius).toBeCloseTo(3)
      expect(circle.minorAxisRadius).toBeCloseTo(1)
      expect(circle.closed).toBe(true)

      expect(arc).toBeInstanceOf(AcDbEllipse)
      expectPoint(ellipsePointAt(arc, arc.startAngle), { x: 3, y: 0 })
      expectPoint(ellipsePointAt(arc, arc.endAngle), { x: 0, y: 1 })
    })

    it('keeps circles under uniform and mirrored scale', () => {
      addBlock(db, 'C', [new AcDbCircle(new AcGePoint3d(1, 0, 0), 1)])
      const ref = new AcDbBlockReference('C')
      ref.scaleFactors = new AcGePoint3d(-2, 2, 1)
      db.tables.blockTable.modelSpace.appendEntity(ref)
      const [circle] = ref.explode() as AcDbCircle[]
      expect(circle).toBeInstanceOf(AcDbCircle)
      expectPoint(circle.center, { x: -2, y: 0 })
      expect(circle.radius).toBeCloseTo(2)
    })

    it('fixes the axes of ellipses under skewing transforms', () => {
      // Semi-axes 2 (along 45°) and 1, then scaled by 2 along X: the image is
      // an ellipse whose axes are no longer the images of the source axes.
      const ellipse = new AcDbEllipse(
        new AcGePoint3d(),
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 1, z: 0 },
        2,
        1,
        0,
        Math.PI * 2
      )
      addBlock(db, 'E', [ellipse])
      const ref = new AcDbBlockReference('E')
      ref.scaleFactors = new AcGePoint3d(2, 1, 1)
      db.tables.blockTable.modelSpace.appendEntity(ref)
      const [result] = ref.explode() as AcDbEllipse[]
      const R = result.majorAxisRadius
      const r = result.minorAxisRadius
      // Area scales with the determinant (2) and the sum of the squared
      // conjugate semi-diameters is invariant: |a|² + |b|² = 10 + 2.5.
      expect(R * r).toBeCloseTo(4, 9)
      expect(R * R + r * r).toBeCloseTo(12.5, 9)
    })

    it('drops attributes and brings back attribute definitions', () => {
      const attdef = new AcDbAttributeDefinition()
      attdef.tag = 'TAG'
      attdef.textString = 'default'
      addBlock(db, 'A', [attdef])
      const ref = new AcDbBlockReference('A')
      db.tables.blockTable.modelSpace.appendEntity(ref)
      const attrib = new AcDbAttribute()
      attrib.tag = 'TAG'
      attrib.textString = 'value'
      ref.appendAttributes(attrib)

      const parts = ref.explode()
      expect(parts).toHaveLength(1)
      expect(parts[0]).toBeInstanceOf(AcDbAttributeDefinition)
      expect((parts[0] as AcDbAttributeDefinition).tag).toBe('TAG')
    })

    it('refuses MINSERT, unexplodable and xref-dependent blocks', () => {
      const block = addBlock(db, 'N', [
        new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
      ])
      const minsert = new AcDbMInsertBlock('N', 2, 2, 5, 5)
      db.tables.blockTable.modelSpace.appendEntity(minsert)
      expect(minsert.isExplodable).toBe(false)
      expect(minsert.explode()).toEqual([])

      const ref = new AcDbBlockReference('N')
      db.tables.blockTable.modelSpace.appendEntity(ref)
      expect(ref.explode()).toHaveLength(1)
      block.explodability = 0
      expect(ref.isExplodable).toBe(false)
      expect(ref.explode()).toEqual([])

      expect(new AcDbBlockReference('MISSING').explode()).toEqual([])
    })
  })

  it('transforms polylines with arcs into lines and elliptical arcs', () => {
    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 0), 1)
    pline.addVertexAt(1, new AcGePoint2d(2, 0))
    addBlock(db, 'P', [pline])
    const ref = new AcDbBlockReference('P')
    ref.scaleFactors = new AcGePoint3d(1, 2, 1)
    db.tables.blockTable.modelSpace.appendEntity(ref)
    const [arc] = ref.explode()
    expect(arc).toBeInstanceOf(AcDbEllipse)
    // Uniform scale keeps the polyline.
    const uniform = acdbTransformForExplode(
      pline,
      new AcGeMatrix3d().makeScale(2, 2, 2)
    )
    expect(uniform[0]).toBeInstanceOf(AcDbPolyline)
  })

  it('explodes dimensions with layer 0 / ByBlock resolved to the dimension', () => {
    const dimLine = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(5, 0, 0)
    )
    dimLine.layer = '0'
    dimLine.color = new AcCmColor(AcCmColorMethod.ByBlock)
    addBlock(db, '*D1', [dimLine])
    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(5, 0, 0),
      new AcGePoint3d(0, 2, 0)
    )
    dim.dimBlockId = '*D1'
    dim.layer = 'DIMS'
    dim.color = new AcCmColor(AcCmColorMethod.ByACI, 2)
    db.tables.blockTable.modelSpace.appendEntity(dim)
    const parts = dim.explode()
    expect(parts).toHaveLength(1)
    expect(parts[0].layer).toBe('DIMS')
    expect(parts[0].color.colorIndex).toBe(2)
  })

  it('generates dimension geometry when the dimension has no block', () => {
    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(0, 3, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(dim)
    dim.dimBlockId = null
    const parts = dim.explode()
    expect(parts.some(p => p instanceof AcDbLine)).toBe(true)
    expect(parts.some(p => p instanceof AcDbMText)).toBe(true)
  })

  describe('AcDbMText', () => {
    it('converts contents into plain paragraphs', () => {
      expect(
        acdbMTextToPlainParagraphs(
          '{\\fArial|b1;Bold}\\Pline \\L2\\l\\~x\\\\y \\S1^2; \\U+00B0'
        )
      ).toEqual(['Bold', 'line 2 x\\y 1/2 °'])
    })

    it('explodes into one text per line with matching justification', () => {
      const mtext = new AcDbMText()
      mtext.contents = 'first\\Psecond\\P\\Pfourth'
      mtext.height = 2
      mtext.location = new AcGePoint3d(10, 10, 0)
      mtext.attachmentPoint = AcGiMTextAttachmentPoint.TopCenter
      mtext.layer = 'TXT'
      const texts = mtext.explode() as AcDbText[]
      expect(texts.map(t => t.textString)).toEqual([
        'first',
        'second',
        'fourth'
      ])
      texts.forEach(t => {
        expect(t.height).toBe(2)
        expect(t.layer).toBe('TXT')
        expect(t.horizontalMode).toBe(AcDbTextHorizontalMode.CENTER)
      })
      const step = 2 * (5 / 3)
      expectPoint(texts[0].alignmentPoint, { x: 10, y: 8 })
      expectPoint(texts[1].alignmentPoint, { x: 10, y: 8 - step })
      expectPoint(texts[2].alignmentPoint, { x: 10, y: 8 - 3 * step })
    })

    it('wraps paragraphs to the defined width', () => {
      const mtext = new AcDbMText()
      mtext.contents = 'aaaa bbbb cccc'
      mtext.height = 1
      mtext.width = 4
      const texts = mtext.explode() as AcDbText[]
      expect(texts.map(t => t.textString)).toEqual(['aaaa', 'bbbb', 'cccc'])
    })
  })

  it('explodes polyface meshes into faces, lines and points', () => {
    const mesh = new AcDbPolyFaceMesh(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 }
      ],
      [[1, 2, -3, 4], [1, 2, 3], [1, 3], [2]]
    )
    const parts = mesh.explode()
    expect(parts.map(p => p.constructor)).toEqual([
      AcDbFace,
      AcDbFace,
      AcDbLine,
      AcDbPoint
    ])
    const quad = parts[0] as AcDbFace
    expect(quad.isEdgeVisibleAt(1)).toBe(true)
    expect(quad.isEdgeVisibleAt(2)).toBe(false)
    const tri = parts[1] as AcDbFace
    expectPoint(tri.getVertexAt(3), { x: 1, y: 1 })
  })

  it('hides the closing edge of a polyface triangle', () => {
    const mesh = new AcDbPolyFaceMesh(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 }
      ],
      [[1, 2, -3]]
    )
    const tri = mesh.explode()[0] as AcDbFace
    expect(tri.isEdgeVisibleAt(0)).toBe(true)
    expect(tri.isEdgeVisibleAt(1)).toBe(true)
    expect(tri.isEdgeVisibleAt(3)).toBe(false)
  })

  it('explodes polygon meshes into one face per cell', () => {
    const vertices = []
    for (let m = 0; m < 3; m++) {
      for (let n = 0; n < 2; n++) vertices.push({ x: n, y: m, z: 0 })
    }
    expect(new AcDbPolygonMesh(3, 2, vertices).explode()).toHaveLength(2)
    expect(
      new AcDbPolygonMesh(3, 2, vertices, true, true).explode()
    ).toHaveLength(6)
  })

  describe('AcDbHatch', () => {
    const createHatch = () => {
      const hatch = new AcDbHatch()
      hatch.add(
        new AcGePolyline2d(
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ],
          true
        )
      )
      return hatch
    }

    it('explodes a pattern hatch into clipped lines', () => {
      const hatch = createHatch()
      hatch.patternName = 'USER'
      hatch.isSolidFill = false
      hatch.definitionLines.length = 0
      hatch.definitionLines.push({
        angle: 0,
        base: { x: 0, y: 0 },
        offset: { x: 0, y: 1 },
        dashLengths: []
      })
      hatch.layer = 'H'
      const lines = hatch.explode() as AcDbLine[]
      expect(lines.length).toBeGreaterThanOrEqual(9)
      lines.forEach(line => {
        expect(line).toBeInstanceOf(AcDbLine)
        expect(line.layer).toBe('H')
        expect(line.startPoint.x).toBeGreaterThanOrEqual(-1e-9)
        expect(line.endPoint.x).toBeLessThanOrEqual(10 + 1e-9)
        expect(line.startPoint.distanceTo(line.endPoint)).toBeCloseTo(10)
      })
    })

    it('cannot explode a solid fill hatch', () => {
      const hatch = createHatch()
      hatch.patternName = 'SOLID'
      expect(hatch.explode()).toEqual([])
    })

    it('generates dashes and dots from the pattern', () => {
      const segments = acdbTessellateHatchPattern(
        [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 0.5 },
            { x: 0, y: 0.5 }
          ]
        ],
        [
          {
            angle: 0,
            base: { x: 0, y: 0.25 },
            offset: { x: 0, y: 10 },
            dashLengths: [2, -1, 0, -1]
          }
        ]
      )
      const dashes = segments.filter(([a, b]) => a.x !== b.x)
      const dots = segments.filter(([a, b]) => a.x === b.x)
      expect(dashes.length).toBeGreaterThan(0)
      expect(dots.length).toBeGreaterThan(0)
      dashes.forEach(([a, b]) =>
        expect(b.x - a.x).toBeLessThanOrEqual(2 + 1e-9)
      )
    })
  })

  describe('ByBlock / ByLayer properties', () => {
    const byBlockTransparency = () => {
      const t = new AcCmTransparency()
      t.method = AcCmTransparencyMethod.ByBlock
      return t
    }

    it('keeps ByBlock transparency of block reference parts', () => {
      const inner = new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
      inner.transparency = byBlockTransparency()
      addBlock(db, 'TB', [inner])
      const ref = new AcDbBlockReference('TB')
      ref.transparency = new AcCmTransparency(128)
      db.tables.blockTable.modelSpace.appendEntity(ref)
      expect(ref.explode()[0].transparency.isByBlock).toBe(true)
    })

    it('resolves ByBlock linetype, lineweight and transparency of dimension parts', () => {
      const dimLine = new AcDbLine(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(5, 0, 0)
      )
      dimLine.layer = '0'
      dimLine.lineType = 'BYBLOCK'
      dimLine.lineWeight = AcGiLineWeight.ByBlock
      dimLine.transparency = byBlockTransparency()
      const byLayerLine = new AcDbLine(
        new AcGePoint3d(0, 1, 0),
        new AcGePoint3d(5, 1, 0)
      )
      byLayerLine.layer = '0'
      byLayerLine.color = new AcCmColor(AcCmColorMethod.ByLayer)
      addBlock(db, '*D2', [dimLine, byLayerLine])
      const dim = new AcDbAlignedDimension(
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(5, 0, 0),
        new AcGePoint3d(0, 2, 0)
      )
      dim.dimBlockId = '*D2'
      dim.layer = 'DIMS'
      dim.lineType = 'DASHED'
      dim.lineWeight = AcGiLineWeight.LineWeight050
      dim.transparency = new AcCmTransparency(100)
      db.tables.blockTable.modelSpace.appendEntity(dim)

      const [line, layerLine] = dim.explode()
      expect(line.lineType).toBe('DASHED')
      expect(line.lineWeight).toBe(AcGiLineWeight.LineWeight050)
      expect(line.transparency.isByAlpha).toBe(true)
      expect(line.transparency.alpha).toBe(100)
      // ByLayer stays ByLayer and follows the dimension's layer.
      expect(layerLine.layer).toBe('DIMS')
      expect(layerLine.color.isByLayer).toBe(true)
    })

    const createLeader = (style: string, byBlockColor?: number) => {
      const leader = new AcDbLeader()
      leader.appendVertex(new AcGePoint3d(0, 0, 0))
      leader.appendVertex(new AcGePoint3d(10, 0, 0))
      leader.hasArrowHead = false
      leader.dimensionStyle = style
      leader.byBlockColor = byBlockColor
      leader.layer = 'LEADERS'
      leader.color = new AcCmColor(AcCmColorMethod.ByACI, 1)
      db.tables.blockTable.modelSpace.appendEntity(leader)
      return leader
    }
    const addDimStyle = (name: string, dimclrd: number) => {
      const style = new AcDbDimStyleTableRecord()
      style.name = name
      style.dimclrd = dimclrd
      db.tables.dimStyleTable.add(style)
    }

    it('keeps DIMCLRD ByLayer as ByLayer when exploding a leader', () => {
      addDimStyle('L_BYLAYER', 256)
      const parts = createLeader('L_BYLAYER').explode()
      expect(parts.length).toBeGreaterThan(0)
      parts.forEach(part => {
        expect(part.layer).toBe('LEADERS')
        expect(part.color.isByLayer).toBe(true)
      })
    })

    it('resolves DIMCLRD ByBlock of an exploded leader', () => {
      addDimStyle('L_BYBLOCK', 0)
      createLeader('L_BYBLOCK')
        .explode()
        .forEach(part => expect(part.color.colorIndex).toBe(1))
      createLeader('L_BYBLOCK', 256)
        .explode()
        .forEach(part => expect(part.color.isByLayer).toBe(true))
      createLeader('L_BYBLOCK', 5)
        .explode()
        .forEach(part => expect(part.color.colorIndex).toBe(5))
    })

    it('uses the explicit DIMCLRD color of an exploded leader', () => {
      addDimStyle('L_RED', 1)
      const leader = createLeader('L_RED')
      leader.color = new AcCmColor(AcCmColorMethod.ByACI, 3)
      leader.explode().forEach(part => expect(part.color.colorIndex).toBe(1))
    })

    it('resolves a ByBlock leader linetype of an exploded multileader', () => {
      const mleader = new AcDbMLeader()
      const leaderIndex = mleader.addLeader()
      mleader.addLeaderLine(leaderIndex, [
        new AcGePoint3d(0, 0, 0),
        new AcGePoint3d(5, 0, 0)
      ])
      mleader.lineType = 'DASHED'
      mleader.color = new AcCmColor(AcCmColorMethod.ByACI, 4)
      // The default multileader style uses ByBlock color / linetype.
      db.tables.blockTable.modelSpace.appendEntity(mleader)
      const lines = mleader.explode().filter(part => part instanceof AcDbLine)
      expect(lines.length).toBeGreaterThan(0)
      lines.forEach(line => {
        expect(line.lineType).toBe('DASHED')
        expect(line.color.colorIndex).toBe(4)
      })
    })
  })
})
