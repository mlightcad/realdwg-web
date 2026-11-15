import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbBlockTableRecord } from '../src/database/AcDbBlockTableRecord'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbLine } from '../src/entity/AcDbLine'
import { AcDbAlignedDimension } from '../src/entity/dimension/AcDbAlignedDimension'
import { acdbDimFeatureScale } from '../src/entity/dimension/AcDbDimFeatureScale'
import {
  acdbGetAnnotationScaleContexts,
  acdbMatchAnnotationScaleContext
} from '../src/misc/AcDbAnnotationScale'
import { AcDbDictionary } from '../src/object/AcDbDictionary'
import { AcDbDimensionObjectContextData } from '../src/object/AcDbDimensionObjectContextData'
import { AcDbScale } from '../src/object/AcDbScale'

function createDb() {
  const db = new AcDbDatabase()
  db.createDefaultData()
  return db
}

function createScale(db: AcDbDatabase, name: string, factor: number) {
  const scale = new AcDbScale()
  scale.database = db
  scale.scaleName = name
  scale.paperUnits = 1
  scale.drawingUnits = factor
  db.objects.scale.setAt(name, scale)
  return scale
}

function wireAnnotativeContexts(
  db: AcDbDatabase,
  dim: AcDbAlignedDimension,
  entries: Array<{
    scale: AcDbScale
    blockName: string
    defPt: AcGePoint3d
    isDefault?: boolean
  }>
) {
  const extId = db.createExtensionDictionaryFor(dim)!
  const extDict = db.getObjectById(extId) as AcDbDictionary

  const manager = new AcDbDictionary(db)
  manager.database = db
  extDict.setAt('AcDbContextDataManager', manager)

  const scalesDict = new AcDbDictionary(db)
  scalesDict.database = db
  manager.setAt('ACDB_ANNOTATIONSCALES', scalesDict)

  entries.forEach((entry, index) => {
    const ctx = new AcDbDimensionObjectContextData()
    ctx.database = db
    ctx.scaleId = entry.scale.objectId
    ctx.isDefault = !!entry.isDefault
    ctx.blockName = entry.blockName
    ctx.definitionPoint = entry.defPt
    db.objects.objectContextData.setAt(`ctx${index}`, ctx)
    scalesDict.setAt(entry.scale.scaleName, ctx)
  })
}

describe('annotative dimension object-level contexts', () => {
  it('picks the per-scale dim block at CANNOSCALE', () => {
    const db = createDb()
    const scale50 = createScale(db, '1:50', 50)
    const scale100 = createScale(db, '1:100', 100)
    db.cannoscale = '1:100'

    const btr50 = new AcDbBlockTableRecord()
    btr50.name = '*D50'
    db.tables.blockTable.add(btr50)
    const btr100 = new AcDbBlockTableRecord()
    btr100.name = '*D100'
    db.tables.blockTable.add(btr100)

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(100, 0, 0),
      new AcGePoint3d(50, 20, 0)
    )
    dim.dimBlockId = '*D50'
    dim.dimBlockPosition = new AcGePoint3d(10, 10, 0)
    db.tables.blockTable.modelSpace.appendEntity(dim)
    dim.annotative = true

    wireAnnotativeContexts(db, dim, [
      {
        scale: scale50,
        blockName: '*D50',
        defPt: new AcGePoint3d(10, 10, 0),
        isDefault: true
      },
      {
        scale: scale100,
        blockName: '*D100',
        defPt: new AcGePoint3d(20, 30, 0)
      }
    ])

    const contexts = acdbGetAnnotationScaleContexts(dim)
    expect(contexts).toHaveLength(2)
    expect(
      contexts.every(
        c => c.contextData instanceof AcDbDimensionObjectContextData
      )
    ).toBe(true)

    const matched = acdbMatchAnnotationScaleContext(contexts, '1:100')
    expect(matched?.scale.scaleName).toBe('1:100')
    expect(
      (matched?.contextData as AcDbDimensionObjectContextData).blockName
    ).toBe('*D100')

    const presentation = dim.resolveAnnotativePresentation()
    expect(presentation.dimBlockId).toBe('*D100')
    // Per-scale blocks are in WCS: the insert stays at the dimension's own
    // block position, not at the context's definition point.
    expect(presentation.blockPosition.x).toBeCloseTo(10, 6)
    expect(presentation.blockPosition.y).toBeCloseTo(10, 6)
    expect(presentation.annotationScale).toMatchObject({
      drawnScaleFactor: 100,
      drawnScaleName: '1:100',
      supportedScaleFactors: expect.arrayContaining([50, 100])
    })
    expect(presentation.featureScale).toBe(100)
    expect(acdbDimFeatureScale(dim.dimensionStyle, dim)).toBe(100)

    db.cannoscale = '1:50'
    const at50 = dim.resolveAnnotativePresentation()
    expect(at50.dimBlockId).toBe('*D50')
    expect(at50.featureScale).toBe(50)
  })

  it('keeps DWG dims in place when the context stores the text location', () => {
    // Mirrors a DWG read by the commercial parser: the default context
    // repeats the main *D block (already in WCS) and its def point is the
    // dimension text position, not a block insertion offset.
    const db = createDb()
    const scale = createScale(db, '1:1', 1)
    db.cannoscale = '1:1'

    const btr = new AcDbBlockTableRecord()
    btr.name = '*D20'
    db.tables.blockTable.add(btr)
    btr.appendEntity(
      new AcDbLine(
        new AcGePoint3d(2305, 8511, 0),
        new AcGePoint3d(3965, 8511, 0)
      )
    )

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(2305, 8361, 0),
      new AcGePoint3d(3965, 8361, 0),
      new AcGePoint3d(3965, 8511, 0)
    )
    dim.dimBlockId = '*D20'
    dim.textPosition = new AcGePoint3d(3126, 8511, 0)
    db.tables.blockTable.modelSpace.appendEntity(dim)
    dim.annotative = true

    wireAnnotativeContexts(db, dim, [
      {
        scale,
        blockName: '*D20',
        defPt: new AcGePoint3d(3126, 8511, 0),
        isDefault: true
      }
    ])

    const presentation = dim.resolveAnnotativePresentation()
    expect(presentation.dimBlockId).toBe('*D20')
    expect(presentation.blockPosition.x).toBeCloseTo(0, 6)
    expect(presentation.blockPosition.y).toBeCloseTo(0, 6)

    const extents = dim.geometricExtents
    expect(extents.min.x).toBeCloseTo(2305, 6)
    expect(extents.max.x).toBeCloseTo(3965, 6)
    expect(extents.min.y).toBeCloseTo(8511, 6)
    expect(extents.max.y).toBeCloseTo(8511, 6)
  })
})
